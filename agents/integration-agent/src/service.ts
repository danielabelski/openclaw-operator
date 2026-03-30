import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  permissions?: {
    skills?: Record<string, { allowed?: boolean }>;
    network?: {
      allowed?: boolean;
    };
  };
}

interface OrchestratorState {
  taskExecutions?: RuntimeTaskExecution[];
}

interface ResolvedConfig {
  id: string;
  orchestratorTask: string;
  orchestratorStatePath: string;
  serviceStatePath: string;
  heartbeatIntervalMs: number;
  documentParserAllowed: boolean;
  normalizerAllowed: boolean;
  networkAllowed: boolean;
}

const telemetry = new Telemetry({ component: "integration-agent-service" });
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

async function loadServiceState(
  targetPath: string,
): Promise<RuntimeAgentServiceState> {
  return loadJsonFile<RuntimeAgentServiceState>(targetPath, {});
}

async function saveServiceState(targetPath: string, state: RuntimeAgentServiceState) {
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(state, null, 2), "utf-8");
}

async function loadConfig(): Promise<ResolvedConfig> {
  const configPath = resolve(__dirname, "../agent.config.json");
  const raw = await readFile(configPath, "utf-8");
  const parsed = JSON.parse(raw) as AgentConfig;
  const agentRoot = dirname(configPath);

  return {
    id: parsed.id,
    orchestratorTask: parsed.orchestratorTask ?? "integration-workflow",
    orchestratorStatePath: resolveRuntimeStateTarget(configPath, parsed.orchestratorStatePath)!,
    serviceStatePath: resolve(agentRoot, parsed.serviceStatePath),
    heartbeatIntervalMs: parseIntervalMs(parsed.heartbeat?.interval, 10 * 60 * 1000),
    documentParserAllowed: parsed.permissions?.skills?.documentParser?.allowed === true,
    normalizerAllowed: parsed.permissions?.skills?.normalizer?.allowed === true,
    networkAllowed: parsed.permissions?.network?.allowed === true,
  };
}

async function runOnce(config: ResolvedConfig) {
  const state = await loadRuntimeStateTarget<OrchestratorState>(
    config.orchestratorStatePath,
    {},
  );
  const executions = (state.taskExecutions ?? []).filter(
    (entry) => entry.type === config.orchestratorTask,
  );
  const taskPath = buildTaskPathProof(state.taskExecutions ?? [], config.orchestratorTask);

  const summary = {
    documentParserAllowed: config.documentParserAllowed,
    normalizerAllowed: config.normalizerAllowed,
    networkAllowed: config.networkAllowed,
    totalTrackedRuns: executions.length,
    failedRuns: executions.filter((entry) => entry.status === "failed").length,
    activeRuns: executions.filter(
      (entry) =>
        entry.status === "pending" ||
        entry.status === "running" ||
        entry.status === "retrying",
    ).length,
    lastHandledAt:
      executions
        .map((entry) => entry.lastHandledAt ?? null)
        .filter((value): value is string => typeof value === "string")
        .sort()
        .at(-1) ?? null,
  };

  const lastStatus =
    summary.documentParserAllowed &&
    summary.normalizerAllowed &&
    summary.networkAllowed === false
      ? "ok"
      : "error";

  const now = new Date().toISOString();
  const existing = await loadServiceState(config.serviceStatePath);
  await saveServiceState(config.serviceStatePath, {
    ...existing,
    memoryVersion: 2,
    runtimeProofVersion: 1,
    agentId: config.id,
    orchestratorStatePath: config.orchestratorStatePath,
    lastRunAt: now,
    lastStatus,
    lastTaskType: config.orchestratorTask,
    lastError:
      lastStatus === "ok"
        ? null
        : "integration service readiness incomplete",
    successCount:
      typeof taskPath.successfulRuns === "number" ? taskPath.successfulRuns : existing.successCount,
    errorCount:
      typeof taskPath.failedRuns === "number" ? taskPath.failedRuns : existing.errorCount,
    totalRuns:
      typeof taskPath.totalRuns === "number" ? taskPath.totalRuns : existing.totalRuns,
    serviceHeartbeat: {
      checkedAt: now,
      status: lastStatus,
      errorSummary:
        lastStatus === "ok" ? null : "integration service readiness incomplete",
      source: "service-loop",
    },
    taskPath,
    summary,
  });

  await telemetry.info("heartbeat", {
    status: lastStatus,
    summary,
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
