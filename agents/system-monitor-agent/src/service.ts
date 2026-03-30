import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Telemetry } from "../../shared/telemetry.js";
import {
  buildTaskPathProof,
  loadRuntimeStateTarget,
  resolveRuntimeStateTarget,
  type RuntimeAgentServiceState,
  type RuntimeTaskExecution,
} from "../../shared/runtime-evidence.js";

interface AgentConfig {
  id: string;
  orchestratorTask?: string;
  orchestratorStatePath: string;
  serviceStatePath: string;
  heartbeat?: {
    interval?: string | number;
  };
}

interface ApprovalRecord {
  status?: string;
}

interface RepairRecord {
  status?: string;
}

interface OrchestratorState {
  taskExecutions?: RuntimeTaskExecution[];
  approvals?: ApprovalRecord[];
  repairRecords?: RepairRecord[];
}

interface ResolvedConfig {
  id: string;
  orchestratorTask: string;
  orchestratorStatePath: string;
  serviceStatePath: string;
  heartbeatIntervalMs: number;
  logsDir: string;
}

const telemetry = new Telemetry({ component: "system-monitor-agent-service" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assertServiceBoundary() {
  if (process.env.ALLOW_DIRECT_SERVICE !== "true") {
    throw new Error(
      "Direct service execution blocked. Set ALLOW_DIRECT_SERVICE=true for system-managed runs.",
    );
  }
}

function parseIntervalMs(value: string | number | undefined, fallbackMs: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") {
    return fallbackMs;
  }

  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h)?$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "ms").toLowerCase();

  switch (unit) {
    case "h":
      return amount * 60 * 60 * 1000;
    case "m":
      return amount * 60 * 1000;
    case "s":
      return amount * 1000;
    default:
      return amount;
  }
}

async function loadJsonFile<T>(targetPath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(targetPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadConfig(): Promise<ResolvedConfig> {
  const configPath = resolve(__dirname, "../agent.config.json");
  const raw = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw) as AgentConfig;
  const agentRoot = dirname(configPath);
  const serviceStatePath = resolve(agentRoot, parsed.serviceStatePath);

  return {
    id: parsed.id,
    orchestratorTask: parsed.orchestratorTask ?? "system-monitor",
    orchestratorStatePath: resolveRuntimeStateTarget(configPath, parsed.orchestratorStatePath)!,
    serviceStatePath,
    heartbeatIntervalMs: parseIntervalMs(parsed.heartbeat?.interval, 60 * 1000),
    logsDir: dirname(serviceStatePath),
  };
}

async function loadServiceState(
  targetPath: string,
): Promise<RuntimeAgentServiceState> {
  return loadJsonFile<RuntimeAgentServiceState>(targetPath, {});
}

async function saveServiceState(targetPath: string, state: RuntimeAgentServiceState) {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(state, null, 2), "utf-8");
}

async function countStaleServiceStates(logsDir: string, staleAfterMs: number) {
  try {
    const entries = await readdir(logsDir);
    let staleCount = 0;

    for (const entry of entries) {
      if (!entry.endsWith("-service.json")) {
        continue;
      }

      const targetPath = resolve(logsDir, entry);
      const fileStat = await stat(targetPath);
      if (Date.now() - fileStat.mtimeMs > staleAfterMs) {
        staleCount += 1;
      }
    }

    return staleCount;
  } catch {
    return 0;
  }
}

async function runOnce(config: ResolvedConfig) {
  const state = await loadRuntimeStateTarget<OrchestratorState>(
    config.orchestratorStatePath,
    {},
  );

  const queuedLikeCount = (state.taskExecutions ?? []).filter((entry) =>
    entry.status === "pending" ||
    entry.status === "running" ||
    entry.status === "retrying",
  ).length;

  const failedTaskCount = (state.taskExecutions ?? []).filter(
    (entry) => entry.status === "failed",
  ).length;

  const pendingApprovalCount = (state.approvals ?? []).filter(
    (entry) => entry.status === "pending",
  ).length;

  const activeRepairCount = (state.repairRecords ?? []).filter(
    (entry) =>
      entry.status === "queued" ||
      entry.status === "running",
  ).length;

  const staleServiceStates = await countStaleServiceStates(
    config.logsDir,
    2 * 60 * 60 * 1000,
  );

  const metrics = {
    timestamp: new Date().toISOString(),
    queuedLikeCount,
    failedTaskCount,
    pendingApprovalCount,
    activeRepairCount,
    staleServiceStates,
  };

  const lastStatus =
    failedTaskCount === 0 && staleServiceStates === 0 ? "ok" : "error";
  const taskPath = buildTaskPathProof(state.taskExecutions ?? [], config.orchestratorTask);
  const existing = await loadServiceState(config.serviceStatePath);

  await saveServiceState(config.serviceStatePath, {
    ...existing,
    memoryVersion: 2,
    runtimeProofVersion: 1,
    agentId: config.id,
    orchestratorStatePath: config.orchestratorStatePath,
    lastRunAt: metrics.timestamp,
    lastStatus,
    lastTaskType: config.orchestratorTask,
    lastError:
      lastStatus === "ok"
        ? null
        : "system monitor detected failed tasks or stale service-state files",
    successCount:
      typeof taskPath.successfulRuns === "number" ? taskPath.successfulRuns : existing.successCount,
    errorCount:
      typeof taskPath.failedRuns === "number" ? taskPath.failedRuns : existing.errorCount,
    totalRuns:
      typeof taskPath.totalRuns === "number" ? taskPath.totalRuns : existing.totalRuns,
    serviceHeartbeat: {
      checkedAt: metrics.timestamp,
      status: lastStatus,
      errorSummary:
        lastStatus === "ok"
          ? null
          : "system monitor detected failed tasks or stale service-state files",
      source: "service-loop",
    },
    taskPath,
    metrics,
  });

  await telemetry.info("heartbeat", {
    status: lastStatus,
    metrics,
  });
}

function installSignalHandlers() {
  let stopping = false;

  const stop = () => {
    stopping = true;
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  return () => stopping;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loop() {
  assertServiceBoundary();
  const config = await loadConfig();
  const isStopping = installSignalHandlers();

  while (!isStopping()) {
    try {
      await runOnce(config);
    } catch (error) {
      await telemetry.error("service.error", {
        message: error instanceof Error ? error.message : String(error),
      });
      const existing = await loadServiceState(config.serviceStatePath);
      const now = new Date().toISOString();
      await saveServiceState(config.serviceStatePath, {
        ...existing,
        memoryVersion: 2,
        runtimeProofVersion: 1,
        agentId: config.id,
        orchestratorStatePath: config.orchestratorStatePath,
        lastRunAt: now,
        lastStatus: "error",
        lastError: error instanceof Error ? error.message : String(error),
        serviceHeartbeat: {
          checkedAt: now,
          status: "error",
          errorSummary: error instanceof Error ? error.message : String(error),
          source: "service-loop",
        },
      });
    }

    if (isStopping()) {
      break;
    }

    await sleep(config.heartbeatIntervalMs);
  }
}

loop().catch(async (error) => {
  await telemetry.error("service.fatal", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
