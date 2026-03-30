import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, "..", "..");
const openclawRoot = resolve(workspaceRoot, "..");
const orchestratorRoot = resolve(workspaceRoot, "orchestrator");
const orchestratorConfigPath = resolve(workspaceRoot, "orchestrator_config.json");

function stripWrappingQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function loadDotEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) {
        continue;
      }
      const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());
      process.env[key] = value;
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function loadBootstrapEnv() {
  const envPaths = [
    process.env.OPENCLAW_ENV_FILE,
    resolve(workspaceRoot, ".env"),
    resolve(orchestratorRoot, ".env"),
    resolve(openclawRoot, ".env"),
  ].filter((value, index, items) => typeof value === "string" && value.length > 0 && items.indexOf(value) === index);

  for (const envPath of envPaths) {
    await loadDotEnvFile(envPath);
  }
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "true";
      continue;
    }

    values[key] = next;
    index += 1;
  }
  return values;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function readCpuSnapshot() {
  try {
    const raw = await readFile("/proc/stat", "utf-8");
    const line = raw.split("\n").find((item) => item.startsWith("cpu "));
    if (!line) {
      return null;
    }

    const values = line.trim().split(/\s+/).slice(1).map((item) => Number.parseInt(item, 10));
    if (values.some((item) => !Number.isFinite(item))) {
      return null;
    }

    const idle = (values[3] ?? 0) + (values[4] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    return { idle, total };
  } catch {
    return null;
  }
}

async function readMemoryUsageMb() {
  try {
    const raw = await readFile("/proc/meminfo", "utf-8");
    const lines = raw.split("\n");
    const totalLine = lines.find((line) => line.startsWith("MemTotal:"));
    const availableLine = lines.find((line) => line.startsWith("MemAvailable:"));
    if (!totalLine || !availableLine) {
      return null;
    }

    const totalKb = Number.parseInt(totalLine.match(/\d+/)?.[0] ?? "0", 10);
    const availableKb = Number.parseInt(availableLine.match(/\d+/)?.[0] ?? "0", 10);
    if (totalKb <= 0 || availableKb < 0) {
      return null;
    }

    return {
      usedMb: Math.round((totalKb - availableKb) / 1024),
      totalMb: Math.round(totalKb / 1024),
    };
  } catch {
    return null;
  }
}

function resolveAuthToken() {
  const now = Date.now();
  if (process.env.API_KEY_ROTATION) {
    try {
      const parsed = JSON.parse(process.env.API_KEY_ROTATION);
      if (Array.isArray(parsed)) {
        const rotatedKey = parsed.find((entry) => {
          if (!entry || typeof entry !== "object") {
            return false;
          }
          const key = typeof entry.key === "string" ? entry.key.trim() : "";
          if (!key || entry.active === false) {
            return false;
          }
          if (typeof entry.expiresAt === "string") {
            const expiry = Date.parse(entry.expiresAt);
            if (Number.isFinite(expiry) && expiry <= now) {
              return false;
            }
          }
          return true;
        });
        if (typeof rotatedKey?.key === "string" && rotatedKey.key.trim().length > 0) {
          return rotatedKey.key.trim();
        }
      }
    } catch {
      // Fall through to API_KEY.
    }
  }

  if (process.env.API_KEY && process.env.API_KEY.trim().length > 0) {
    return process.env.API_KEY.trim();
  }

  return null;
}

async function assertStackOff(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) {
      throw new Error(`OpenClaw appears to be running already at ${baseUrl}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("appears to be running")) {
      throw error;
    }
  }
}

async function captureBaseline(windowMs, intervalMs) {
  const baselineStartedAt = new Date().toISOString();
  const samples = [];
  let previousCpu = await readCpuSnapshot();
  const count = Math.max(1, Math.floor(windowMs / intervalMs));

  for (let index = 0; index < count; index += 1) {
    await sleep(intervalMs);
    const currentCpu = await readCpuSnapshot();
    const memory = await readMemoryUsageMb();
    const [load1] = os.loadavg();

    let cpuPercent = 0;
    if (previousCpu && currentCpu) {
      const idleDelta = currentCpu.idle - previousCpu.idle;
      const totalDelta = currentCpu.total - previousCpu.total;
      if (totalDelta > 0) {
        cpuPercent = round2((1 - idleDelta / totalDelta) * 100);
      }
    }
    previousCpu = currentCpu;

    samples.push({
      capturedAt: new Date().toISOString(),
      cpuPercent,
      loadAvg1m: round2(load1 ?? 0),
      memoryUsedMb: memory?.usedMb ?? 0,
      memoryTotalMb: memory?.totalMb ?? Math.round(os.totalmem() / (1024 * 1024)),
    });
  }

  return {
    baselineStartedAt,
    baselineEndedAt: new Date().toISOString(),
    baselineSamples: samples,
    baselineSummary: {
      cpuPercentAvg: round2(average(samples.map((sample) => sample.cpuPercent))),
      cpuPercentPeak: round2(Math.max(...samples.map((sample) => sample.cpuPercent))),
      loadAvg1m: round2(average(samples.map((sample) => sample.loadAvg1m))),
      memoryUsedMbAvg: round2(average(samples.map((sample) => sample.memoryUsedMb))),
      memoryUsedMbPeak: round2(Math.max(...samples.map((sample) => sample.memoryUsedMb))),
    },
  };
}

function buildMachineProfile(memoryTotalMb) {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? "unknown",
    cpuCores: cpus.length,
    memoryTotalMb,
  };
}

async function resolveStateFilePath() {
  const raw = await readFile(orchestratorConfigPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (typeof parsed?.stateFile !== "string" || parsed.stateFile.length === 0) {
    throw new Error(`Missing stateFile in ${orchestratorConfigPath}`);
  }
  return parsed.stateFile;
}

function isMongoStateTarget(target) {
  return typeof target === "string" && target.startsWith("mongo:");
}

function resolveMongoStateKey(target) {
  const key = target.slice("mongo:".length).trim();
  if (!key) {
    throw new Error("mongo state target must include a key");
  }
  return key;
}

async function withMongoStateCollection(callback) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(
    process.env.DATABASE_URL || "mongodb://mongo:27017/orchestrator",
  );
  await client.connect();
  try {
    const db = client.db(process.env.DB_NAME || "orchestrator");
    return await callback(db.collection("system_state"));
  } finally {
    await client.close();
  }
}

async function readStateFile(stateFilePath) {
  if (isMongoStateTarget(stateFilePath)) {
    return withMongoStateCollection(async (collection) => {
      const doc = await collection.findOne({ key: resolveMongoStateKey(stateFilePath) });
      return doc?.value && typeof doc.value === "object" ? doc.value : {};
    });
  }

  try {
    const raw = await readFile(stateFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeStateFile(stateFilePath, state) {
  if (isMongoStateTarget(stateFilePath)) {
    await withMongoStateCollection(async (collection) => {
      const key = resolveMongoStateKey(stateFilePath);
      const existing = await collection.findOne({ key });
      if (existing) {
        await collection.updateOne(
          { key },
          {
            $set: {
              value: state,
              version: Number(existing.version ?? 0) + 1,
              updatedAt: new Date(),
            },
          },
        );
        return;
      }

      await collection.insertOne({
        key,
        value: state,
        version: 1,
        updatedAt: new Date(),
      });
    });
    return;
  }

  await writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf-8");
}

function buildBootstrapSamples(reviewSessionId, baselineSamples) {
  return baselineSamples.map((sample) => ({
    reviewSessionId,
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
  }));
}

async function persistPendingHandoff(stateFilePath, payload) {
  const state = await readStateFile(stateFilePath);
  const reviewSessions = Array.isArray(state.reviewSessions) ? state.reviewSessions : [];
  const reviewTelemetrySamples = Array.isArray(state.reviewTelemetrySamples)
    ? state.reviewTelemetrySamples
    : [];

  state.reviewSessions = reviewSessions.filter((session) => session?.id !== payload.reviewSessionId);
  state.reviewSessions.push({
    id: payload.reviewSessionId,
    source: "bootstrap_handoff",
    state: "pending_handoff",
    title: payload.title,
    createdAt: payload.createdAt,
    startedAt: payload.startupStartedAt,
    endedAt: null,
    baselineStartedAt: payload.baselineStartedAt,
    baselineEndedAt: payload.baselineEndedAt,
    startupStartedAt: payload.startupStartedAt,
    handoffReceivedAt: null,
    activeBucket: payload.initialBucket,
    machine: payload.machine,
    baselineSummary: payload.baselineSummary,
    bucketTimeline: [
      { bucket: "baseline_idle", capturedAt: payload.baselineStartedAt, note: "baseline capture started" },
      { bucket: payload.initialBucket, capturedAt: payload.startupStartedAt, note: "startup began" },
    ],
    scenarioNotes: payload.notes,
    linkedRunIds: [],
    summary: null,
    failureReason: null,
  });

  state.reviewTelemetrySamples = reviewTelemetrySamples.filter(
    (sample) => !(sample?.reviewSessionId === payload.reviewSessionId && sample?.source === "bootstrap"),
  );
  state.reviewTelemetrySamples.push(...buildBootstrapSamples(payload.reviewSessionId, payload.baselineSamples));

  await writeStateFile(stateFilePath, state);
}

async function persistHandoffFailure(stateFilePath, reviewSessionId, reason) {
  const state = await readStateFile(stateFilePath);
  const sessions = Array.isArray(state.reviewSessions) ? state.reviewSessions : [];
  const session = sessions.find((entry) => entry?.id === reviewSessionId);
  if (!session || session.state === "active" || session.state === "completed") {
    return;
  }
  session.state = "handoff_failed";
  session.endedAt = typeof session.endedAt === "string" ? session.endedAt : new Date().toISOString();
  session.failureReason = reason;
  await writeStateFile(stateFilePath, state);
}

function startOrchestrator() {
  const child = spawn("npm", ["run", "dev"], {
    cwd: workspaceRoot,
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  return child.pid;
}

async function waitForHealth(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await sleep(2000);
  }

  throw new Error(`Timed out waiting for orchestrator health at ${baseUrl}`);
}

async function postHandoff(baseUrl, token, payload, retryPath) {
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/review-sessions/bootstrap-handoff`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`bootstrap handoff failed (${response.status}): ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(1500 * attempt);
    }
  }

  await writeFile(
    retryPath,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        payload,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
      null,
      2,
    ),
    "utf-8",
  );

  throw new Error(
    `${lastError instanceof Error ? lastError.message : String(lastError)}. Retry payload saved to ${retryPath}`,
  );
}

async function main() {
  await loadBootstrapEnv();

  const args = parseArgs(process.argv.slice(2));
  const title = typeof args.title === "string" ? args.title : `Review Session ${new Date().toISOString()}`;
  const defaultPort = process.env.PORT || "3000";
  const defaultBaseUrl = process.env.REVIEW_SESSION_BASE_URL || `http://127.0.0.1:${defaultPort}`;
  const baseUrl = typeof args.baseUrl === "string" ? args.baseUrl : defaultBaseUrl;
  const baselineMs = Number.parseInt(String(args["baseline-ms"] ?? "5000"), 10);
  const intervalMs = Number.parseInt(String(args["sample-interval-ms"] ?? "1000"), 10);
  const timeoutMs = Number.parseInt(String(args["wait-timeout-ms"] ?? "120000"), 10);
  const token = resolveAuthToken();
  const stateFilePath = await resolveStateFilePath();

  if (!token) {
    throw new Error("Missing API_KEY or active API_KEY_ROTATION entry for review-session bootstrap handoff");
  }

  await assertStackOff(baseUrl);

  const reviewSessionId = randomUUID();
  console.log(`[review-session] capturing baseline for ${reviewSessionId}`);
  const baseline = await captureBaseline(baselineMs, intervalMs);
  const startupStartedAt = new Date().toISOString();
  const memoryTotalMb = baseline.baselineSamples.at(-1)?.memoryTotalMb ?? Math.round(os.totalmem() / (1024 * 1024));

  const payload = {
    reviewSessionId,
    title,
    createdAt: new Date().toISOString(),
    baselineStartedAt: baseline.baselineStartedAt,
    baselineEndedAt: baseline.baselineEndedAt,
    startupStartedAt,
    machine: buildMachineProfile(memoryTotalMb),
    baselineSummary: baseline.baselineSummary,
    baselineSamples: baseline.baselineSamples,
    initialBucket: "startup_cost",
    notes: [
      {
        capturedAt: baseline.baselineEndedAt,
        bucket: "baseline_idle",
        text: "Bootstrap captured the pre-stack baseline before orchestrator startup.",
      },
    ],
  };

  const retryPath = resolve(os.tmpdir(), `openclaw-review-session-${reviewSessionId}.json`);
  await persistPendingHandoff(stateFilePath, payload);

  let result;
  try {
    const pid = startOrchestrator();
    console.log(`[review-session] started orchestrator via npm run dev (pid ${pid ?? "unknown"})`);
    await waitForHealth(baseUrl, timeoutMs);
    result = await postHandoff(baseUrl, token, payload, retryPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await persistHandoffFailure(stateFilePath, reviewSessionId, reason);
    throw error;
  }

  console.log(`[review-session] bootstrap handoff complete for ${reviewSessionId}`);
  console.log(JSON.stringify({ reviewSessionId, baseUrl, result }, null, 2));
}

main().catch((error) => {
  console.error(`[review-session] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
