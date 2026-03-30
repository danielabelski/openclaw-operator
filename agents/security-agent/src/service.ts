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
  orchestratorEnvPath: string;
  orchestratorConfigPath: string;
}

const telemetry = new Telemetry({ component: "security-agent-service" });
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
  const workspaceRoot = resolve(agentRoot, "../..");

  return {
    id: parsed.id,
    orchestratorTask: parsed.orchestratorTask ?? "security-audit",
    orchestratorStatePath: resolveRuntimeStateTarget(configPath, parsed.orchestratorStatePath)!,
    serviceStatePath: resolve(agentRoot, parsed.serviceStatePath),
    heartbeatIntervalMs: parseIntervalMs(parsed.heartbeat?.interval, 15 * 60 * 1000),
    orchestratorEnvPath: resolve(workspaceRoot, "orchestrator/.env"),
    orchestratorConfigPath: resolve(workspaceRoot, "orchestrator_config.json"),
  };
}

function extractKeys(raw: string) {
  const keys = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    keys.add(trimmed.slice(0, separatorIndex));
  }

  return keys;
}

async function runOnce(config: ResolvedConfig) {
  const [state, envRaw, orchestratorConfig] = await Promise.all([
    loadRuntimeStateTarget<OrchestratorState>(config.orchestratorStatePath, {}),
    readFile(config.orchestratorEnvPath, "utf-8"),
    loadJsonFile<Record<string, unknown>>(config.orchestratorConfigPath, {}),
  ]);

  const envKeys = extractKeys(envRaw);
  const requiredAny = ["API_KEY", "API_KEY_ROTATION"];
  const requiredAll = [
    "WEBHOOK_SECRET",
    "MONGO_PASSWORD",
    "REDIS_PASSWORD",
    "MONGO_USERNAME",
  ];

  const posture = {
    hasAuthCredential:
      requiredAny.some((key) => envKeys.has(key)),
    missingRequiredKeys: requiredAll.filter((key) => !envKeys.has(key)),
    publicProofMode:
      typeof orchestratorConfig.notes === "string" &&
      orchestratorConfig.notes.includes("retired public proof/openclawdbot delivery lane")
        ? "orchestrator-native"
        : "unspecified",
    legacyProofSecretPresent: envKeys.has("MILESTONE_SIGNING_SECRET"),
    legacyProofConfigPresent:
      typeof orchestratorConfig.milestoneIngestUrl === "string" ||
      typeof orchestratorConfig.demandSummaryIngestUrl === "string",
    trackedSecurityRuns: (state.taskExecutions ?? []).filter(
      (entry) => entry.type === "security-audit",
    ).length,
    failedSecurityRuns: (state.taskExecutions ?? []).filter(
      (entry) =>
        entry.type === "security-audit" && entry.status === "failed",
    ).length,
  };

  const lastStatus =
    posture.hasAuthCredential && posture.missingRequiredKeys.length === 0
      ? "ok"
      : "error";
  const taskPath = buildTaskPathProof(state.taskExecutions ?? [], config.orchestratorTask);
  const existing = await loadServiceState(config.serviceStatePath);

  await saveServiceState(config.serviceStatePath, {
    ...existing,
    memoryVersion: 2,
    runtimeProofVersion: 1,
    agentId: config.id,
    orchestratorStatePath: config.orchestratorStatePath,
    lastRunAt: new Date().toISOString(),
    lastStatus,
    lastTaskType: config.orchestratorTask,
    lastError:
      lastStatus === "ok"
        ? null
        : `security posture incomplete: ${posture.missingRequiredKeys.join(", ") || "auth credentials missing"}`,
    successCount:
      typeof taskPath.successfulRuns === "number" ? taskPath.successfulRuns : existing.successCount,
    errorCount:
      typeof taskPath.failedRuns === "number" ? taskPath.failedRuns : existing.errorCount,
    totalRuns:
      typeof taskPath.totalRuns === "number" ? taskPath.totalRuns : existing.totalRuns,
    serviceHeartbeat: {
      checkedAt: new Date().toISOString(),
      status: lastStatus,
      errorSummary:
        lastStatus === "ok"
          ? null
          : `security posture incomplete: ${posture.missingRequiredKeys.join(", ") || "auth credentials missing"}`,
      source: "service-loop",
    },
    taskPath,
    posture,
  });

  await telemetry.info("heartbeat", {
    status: lastStatus,
    posture,
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
