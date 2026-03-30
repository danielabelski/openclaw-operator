import { readFile } from "node:fs/promises";
import { loadavg } from "node:os";
import {
  OrchestratorState,
  ReviewSessionBootstrapHandoffPayload,
  ReviewSessionBucket,
  ReviewSessionDerivedSummary,
  ReviewSessionRecord,
  ReviewTelemetrySample,
} from "./types.js";

const REVIEW_SAMPLE_INTERVAL_MS = 5000;
const REVIEW_MAX_SAMPLES_PER_SESSION = 1440;

type QueueSnapshot = {
  queued: number;
  processing: number;
};

type ReviewSessionServiceOptions = {
  state: OrchestratorState;
  flushState: (tags?: string[]) => Promise<void>;
  getQueueSnapshot: () => QueueSnapshot;
};

type CpuSnapshot = {
  idle: number;
  total: number;
};

async function readCpuSnapshot(): Promise<CpuSnapshot | null> {
  try {
    const raw = await readFile("/proc/stat", "utf-8");
    const line = raw.split("\n").find((item) => item.startsWith("cpu "));
    if (!line) return null;
    const parts = line.trim().split(/\s+/).slice(1).map((value) => Number.parseInt(value, 10));
    if (parts.some((value) => !Number.isFinite(value))) return null;
    const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
    const total = parts.reduce((sum, value) => sum + value, 0);
    return { idle, total };
  } catch {
    return null;
  }
}

async function readMemoryUsageBytes() {
  try {
    const raw = await readFile("/proc/meminfo", "utf-8");
    const lines = raw.split("\n");
    const totalLine = lines.find((line) => line.startsWith("MemTotal:"));
    const availableLine = lines.find((line) => line.startsWith("MemAvailable:"));
    if (!totalLine || !availableLine) return null;
    const totalKb = Number.parseInt(totalLine.replace(/\D+/g, " ").trim().split(/\s+/)[0] ?? "0", 10);
    const availableKb = Number.parseInt(availableLine.replace(/\D+/g, " ").trim().split(/\s+/)[0] ?? "0", 10);
    if (!Number.isFinite(totalKb) || !Number.isFinite(availableKb) || totalKb <= 0) return null;
    return {
      totalBytes: totalKb * 1024,
      usedBytes: Math.max(0, (totalKb - availableKb) * 1024),
    };
  } catch {
    return null;
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeBucketDurations(
  timeline: ReviewSessionRecord["bucketTimeline"],
  endAt: string,
) {
  const durations: Partial<Record<ReviewSessionBucket, number>> = {};
  const ordered = [...timeline].sort(
    (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt),
  );
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const start = Date.parse(current.capturedAt);
    const end = Date.parse(next?.capturedAt ?? endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    durations[current.bucket] = (durations[current.bucket] ?? 0) + Math.round((end - start) / 1000);
  }
  return durations;
}

function createSummary(
  session: ReviewSessionRecord,
  state: OrchestratorState,
): ReviewSessionDerivedSummary {
  const samples = state.reviewTelemetrySamples.filter(
    (sample) => sample.reviewSessionId === session.id,
  );
  const bucketStats: ReviewSessionDerivedSummary["bucketStats"] = {};
  const grouped = new Map<ReviewSessionBucket, ReviewTelemetrySample[]>();
  for (const sample of samples) {
    const current = grouped.get(sample.bucket) ?? [];
    current.push(sample);
    grouped.set(sample.bucket, current);
  }
  const durations = computeBucketDurations(
    session.bucketTimeline,
    session.endedAt ?? new Date().toISOString(),
  );

  for (const [bucket, bucketSamples] of grouped.entries()) {
    const cpu = bucketSamples.map((sample) => sample.host.cpuPercent);
    const mem = bucketSamples.map((sample) => sample.host.memoryUsedBytes / (1024 * 1024));
    bucketStats[bucket] = {
      durationSeconds: durations[bucket] ?? 0,
      sampleCount: bucketSamples.length,
      cpuPercentAvg: bucketSamples.length > 0 ? round2(average(cpu)) : null,
      cpuPercentPeak: bucketSamples.length > 0 ? round2(Math.max(...cpu)) : null,
      memoryUsedMbAvg: bucketSamples.length > 0 ? round2(average(mem)) : null,
      memoryUsedMbPeak: bucketSamples.length > 0 ? round2(Math.max(...mem)) : null,
    };
  }

  const linkedExecutions = state.taskExecutions.filter(
    (execution) =>
      session.linkedRunIds.includes(execution.idempotencyKey) ||
      session.linkedRunIds.includes(execution.taskId),
  );
  const latencies = linkedExecutions
    .map((execution) => execution.accounting?.latencyMs)
    .filter((value): value is number => typeof value === "number");

  return {
    generatedAt: new Date().toISOString(),
    bucketStats,
    linkedRunCount: session.linkedRunIds.length,
    linkedRunCostUsd: round2(
      linkedExecutions.reduce(
        (sum, execution) => sum + (execution.accounting?.costUsd ?? 0),
        0,
      ),
    ),
    linkedRunAverageLatencyMs:
      latencies.length > 0 ? Math.round(average(latencies)) : null,
    observedIncidentCount: state.incidentLedger.filter(
      (incident) => incident.status !== "resolved",
    ).length,
  };
}

function buildMarkdownExport(session: ReviewSessionRecord, samples: ReviewTelemetrySample[]) {
  const summary = session.summary;
  const lines = [
    `# Review Session: ${session.title}`,
    "",
    `- Session ID: ${session.id}`,
    `- State: ${session.state}`,
    `- Created At: ${session.createdAt}`,
    `- Baseline Window: ${session.baselineStartedAt} -> ${session.baselineEndedAt}`,
    `- Startup Started At: ${session.startupStartedAt}`,
    `- Handoff Received At: ${session.handoffReceivedAt ?? "not handed off"}`,
    `- Machine: ${session.machine.hostname} (${session.machine.platform}/${session.machine.arch})`,
    `- CPU: ${session.machine.cpuModel} x${session.machine.cpuCores}`,
    `- Memory: ${session.machine.memoryTotalMb} MB`,
    "",
    "## Baseline Summary",
    "",
    `- CPU Avg: ${session.baselineSummary?.cpuPercentAvg ?? 0}%`,
    `- CPU Peak: ${session.baselineSummary?.cpuPercentPeak ?? 0}%`,
    `- Load Avg 1m: ${session.baselineSummary?.loadAvg1m ?? 0}`,
    `- Memory Avg: ${session.baselineSummary?.memoryUsedMbAvg ?? 0} MB`,
    `- Memory Peak: ${session.baselineSummary?.memoryUsedMbPeak ?? 0} MB`,
    "",
    "## Session Summary",
    "",
    `- Linked Runs: ${summary?.linkedRunCount ?? session.linkedRunIds.length}`,
    `- Linked Run Cost USD: ${summary?.linkedRunCostUsd ?? 0}`,
    `- Linked Run Average Latency Ms: ${summary?.linkedRunAverageLatencyMs ?? "n/a"}`,
    `- Open Incidents Observed: ${summary?.observedIncidentCount ?? 0}`,
  ];

  if (summary?.bucketStats) {
    lines.push("", "## Bucket Stats", "");
    for (const [bucket, stats] of Object.entries(summary.bucketStats)) {
      lines.push(
        `- ${bucket}: ${stats.durationSeconds}s, ${stats.sampleCount} samples, cpu avg ${stats.cpuPercentAvg ?? "n/a"}%, cpu peak ${stats.cpuPercentPeak ?? "n/a"}%`,
      );
    }
  }

  if (session.scenarioNotes.length > 0) {
    lines.push("", "## Notes", "");
    for (const note of session.scenarioNotes) {
      lines.push(`- [${note.bucket}] ${note.capturedAt}: ${note.text}`);
    }
  }

  if (session.linkedRunIds.length > 0) {
    lines.push("", "## Linked Runs", "");
    for (const runId of session.linkedRunIds) {
      lines.push(`- ${runId}`);
    }
  }

  lines.push("", `Samples captured: ${samples.length}`);
  return lines.join("\n");
}

export function createReviewSessionService(options: ReviewSessionServiceOptions) {
  const { state, flushState, getQueueSnapshot } = options;
  let timer: NodeJS.Timeout | null = null;
  let lastCpuSnapshot: CpuSnapshot | null = null;

  function requireActiveSession(session: ReviewSessionRecord, action: string) {
    if (session.state !== "active") {
      throw new Error(`Review session must be active to ${action}: ${session.id}`);
    }
  }

  function resolveLinkedExecution(runId: string) {
    return state.taskExecutions.find(
      (execution) => execution.idempotencyKey === runId || execution.taskId === runId,
    ) ?? null;
  }

  function canonicalLinkedRunId(runId: string) {
    const execution = resolveLinkedExecution(runId);
    if (!execution) {
      throw new Error(`Review session run link target not found: ${runId}`);
    }
    if (typeof execution.idempotencyKey === "string" && execution.idempotencyKey.length > 0) {
      return execution.idempotencyKey;
    }
    return execution.taskId;
  }

  function getSession(id: string) {
    return state.reviewSessions.find((session) => session.id === id) ?? null;
  }

  function listSessions() {
    return [...state.reviewSessions].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
  }

  function ensureSingleActiveSession(nextSessionId?: string) {
    const active = state.reviewSessions.find(
      (session) => session.state === "active" && session.id !== nextSessionId,
    );
    if (active) {
      throw new Error(`Review session already active: ${active.id}`);
    }
  }

  function enforceSessionSampleLimit(sessionId: string) {
    const sessionSamples = state.reviewTelemetrySamples.filter(
      (sample) => sample.reviewSessionId === sessionId,
    );
    if (sessionSamples.length <= REVIEW_MAX_SAMPLES_PER_SESSION) return;
    const overflow = sessionSamples.length - REVIEW_MAX_SAMPLES_PER_SESSION;
    let removed = 0;
    state.reviewTelemetrySamples = state.reviewTelemetrySamples.filter((sample) => {
      if (sample.reviewSessionId !== sessionId) return true;
      if (removed < overflow) {
        removed += 1;
        return false;
      }
      return true;
    });
  }

  async function captureSampleForSession(session: ReviewSessionRecord) {
    const memory = await readMemoryUsageBytes();
    const cpuSnapshot = await readCpuSnapshot();
    const load = loadavg();
    let cpuPercent = 0;
    if (lastCpuSnapshot && cpuSnapshot) {
      const idleDelta = cpuSnapshot.idle - lastCpuSnapshot.idle;
      const totalDelta = cpuSnapshot.total - lastCpuSnapshot.total;
      if (totalDelta > 0) {
        cpuPercent = round2((1 - idleDelta / totalDelta) * 100);
      }
    }
    if (cpuSnapshot) {
      lastCpuSnapshot = cpuSnapshot;
    }

    const queue = getQueueSnapshot();
    const activeRuns = state.taskExecutions.filter((execution) =>
      execution.status === "running" ||
      execution.status === "pending" ||
      execution.status === "retrying",
    );
    const now = new Date().toISOString();
    const processMemory = process.memoryUsage();

    state.reviewTelemetrySamples.push({
      reviewSessionId: session.id,
      capturedAt: now,
      bucket: session.activeBucket,
      source: "orchestrator",
      host: {
        cpuPercent,
        load1: round2(load[0] ?? 0),
        load5: round2(load[1] ?? 0),
        load15: round2(load[2] ?? 0),
        memoryUsedBytes: memory?.usedBytes ?? 0,
        memoryTotalBytes: memory?.totalBytes ?? 0,
      },
      process: {
        rssBytes: processMemory.rss,
        heapUsedBytes: processMemory.heapUsed,
        heapTotalBytes: processMemory.heapTotal,
        uptimeSec: process.uptime(),
      },
      activity: {
        openIncidents: state.incidentLedger.filter((incident) => incident.status !== "resolved").length,
        queueDepth: queue.queued + queue.processing,
        activeRuns: activeRuns.length,
        recentRunIds: activeRuns.slice(-5).map((execution) => execution.idempotencyKey),
      },
      tags: [session.activeBucket],
    });
    enforceSessionSampleLimit(session.id);
  }

  async function sampleActiveSessions() {
    const sessions = state.reviewSessions.filter((session) => session.state === "active");
    for (const session of sessions) {
      await captureSampleForSession(session);
    }
    if (sessions.length > 0) {
      await flushState(["runtime-state"]);
    }
  }

  function ensureSampler() {
    const hasActive = state.reviewSessions.some((session) => session.state === "active");
    if (hasActive && !timer) {
      timer = setInterval(() => {
        void sampleActiveSessions();
      }, REVIEW_SAMPLE_INTERVAL_MS);
    }
    if (!hasActive && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  async function bootstrapHandoff(payload: ReviewSessionBootstrapHandoffPayload) {
    ensureSingleActiveSession(payload.reviewSessionId);
    const existing = getSession(payload.reviewSessionId);
    if (!existing) {
      throw new Error(`Review session must exist in pending_handoff before bootstrap handoff: ${payload.reviewSessionId}`);
    }
    if (existing.state !== "pending_handoff") {
      throw new Error(`Review session must be pending_handoff before bootstrap handoff: ${payload.reviewSessionId}`);
    }

    const handoffReceivedAt = new Date().toISOString();
    const session = existing;

    session.state = "active";
    session.handoffReceivedAt = handoffReceivedAt;
    session.title = payload.title;
    session.createdAt = payload.createdAt;
    session.startedAt = payload.startupStartedAt;
    session.endedAt = null;
    session.baselineStartedAt = payload.baselineStartedAt;
    session.baselineEndedAt = payload.baselineEndedAt;
    session.startupStartedAt = payload.startupStartedAt;
    session.activeBucket = payload.initialBucket;
    session.machine = payload.machine;
    session.baselineSummary = payload.baselineSummary;
    session.summary = null;
    session.failureReason = null;
    session.bucketTimeline = [
      { bucket: "baseline_idle", capturedAt: payload.baselineStartedAt, note: "baseline capture started" },
      { bucket: payload.initialBucket, capturedAt: payload.startupStartedAt, note: "startup began" },
      { bucket: payload.initialBucket, capturedAt: handoffReceivedAt, note: "orchestrator accepted ownership" },
    ];
    session.scenarioNotes = payload.notes;

    state.reviewTelemetrySamples = state.reviewTelemetrySamples.filter(
      (sample) => !(sample.reviewSessionId === payload.reviewSessionId && sample.source === "bootstrap"),
    );
    for (const sample of payload.baselineSamples) {
      state.reviewTelemetrySamples.push({
        reviewSessionId: payload.reviewSessionId,
        capturedAt: sample.capturedAt,
        bucket: "baseline_idle",
        source: "bootstrap",
        host: {
          cpuPercent: sample.cpuPercent,
          load1: sample.loadAvg1m,
          load5: sample.loadAvg1m,
          load15: sample.loadAvg1m,
          memoryUsedBytes: Math.round(sample.memoryUsedMb * 1024 * 1024),
          memoryTotalBytes: Math.round(sample.memoryTotalMb * 1024 * 1024),
        },
        process: {
          rssBytes: null,
          heapUsedBytes: null,
          heapTotalBytes: null,
          uptimeSec: null,
        },
        activity: {
          openIncidents: 0,
          queueDepth: 0,
          activeRuns: 0,
          recentRunIds: [],
        },
        tags: ["baseline_idle", "bootstrap"],
      });
    }
    enforceSessionSampleLimit(payload.reviewSessionId);
    ensureSampler();
    await flushState(["runtime-state"]);
    return session;
  }

  function overview() {
    const sessions = listSessions();
    return {
      generatedAt: new Date().toISOString(),
      activeSession: sessions.find((session) => session.state === "active") ?? null,
      sessions,
    };
  }

  function detail(id: string) {
    const session = getSession(id);
    if (!session) return null;
    return {
      generatedAt: new Date().toISOString(),
      session,
      samples: state.reviewTelemetrySamples.filter(
        (sample) => sample.reviewSessionId === id,
      ),
    };
  }

  async function switchBucket(id: string, bucket: ReviewSessionBucket, note?: string) {
    const session = getSession(id);
    if (!session) throw new Error(`Review session not found: ${id}`);
    requireActiveSession(session, "switch buckets");
    session.activeBucket = bucket;
    const now = new Date().toISOString();
    session.bucketTimeline.push({
      bucket,
      capturedAt: now,
      note: note ?? null,
    });
    if (note) {
      session.scenarioNotes.push({ capturedAt: now, bucket, text: note });
    }
    await flushState(["runtime-state"]);
    return session;
  }

  async function addNote(id: string, bucket: ReviewSessionBucket, text: string) {
    const session = getSession(id);
    if (!session) throw new Error(`Review session not found: ${id}`);
    requireActiveSession(session, "add notes");
    session.scenarioNotes.push({
      capturedAt: new Date().toISOString(),
      bucket,
      text,
    });
    await flushState(["runtime-state"]);
    return session;
  }

  async function linkRun(id: string, runId: string) {
    const session = getSession(id);
    if (!session) throw new Error(`Review session not found: ${id}`);
    requireActiveSession(session, "link runs");
    const canonicalRunId = canonicalLinkedRunId(runId);
    if (!session.linkedRunIds.includes(canonicalRunId)) {
      session.linkedRunIds.push(canonicalRunId);
      await flushState(["runtime-state"]);
    }
    return session;
  }

  async function stop(id: string) {
    const session = getSession(id);
    if (!session) throw new Error(`Review session not found: ${id}`);
    requireActiveSession(session, "stop");
    session.endedAt = new Date().toISOString();
    session.state = "completed";
    session.summary = createSummary(session, state);
    ensureSampler();
    await flushState(["runtime-state"]);
    return session;
  }

  async function failHandoff(reviewSessionId: string, reason: string) {
    const session = getSession(reviewSessionId);
    if (!session) return null;
    if (session.state !== "pending_handoff") return session;
    session.state = "handoff_failed";
    session.endedAt = session.endedAt ?? new Date().toISOString();
    session.failureReason = reason;
    await flushState(["runtime-state"]);
    return session;
  }

  function exportSession(id: string, format: "json" | "markdown") {
    const session = getSession(id);
    if (!session) throw new Error(`Review session not found: ${id}`);
    if (!session.summary) {
      session.summary = createSummary(session, state);
    }
    const samples = state.reviewTelemetrySamples.filter(
      (sample) => sample.reviewSessionId === id,
    );
    if (format === "markdown") {
      return buildMarkdownExport(session, samples);
    }
    return {
      generatedAt: new Date().toISOString(),
      session,
      samples,
    };
  }

  ensureSampler();

  return {
    overview,
    detail,
    bootstrapHandoff,
    switchBucket,
    addNote,
    linkRun,
    stop,
    failHandoff,
    exportSession,
    ensureSampler,
  };
}