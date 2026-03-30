import { readFile } from "node:fs/promises";
import path from "node:path";

export const KNOWN_PUBLIC_TASK_TYPES = [
  "drift-repair",
  "reddit-response",
  "security-audit",
  "summarize-content",
  "system-monitor",
  "build-refactor",
  "content-generate",
  "integration-workflow",
  "normalize-data",
  "market-research",
  "data-extraction",
  "qa-verification",
  "skill-audit",
  "rss-sweep",
  "nightly-batch",
  "send-digest",
  "heartbeat",
  "agent-deploy",
  "doc-sync",
] as const;

export type KnownPublicTaskType = (typeof KNOWN_PUBLIC_TASK_TYPES)[number];

export type BridgePluginConfig = {
  allowedTasks: string[];
  baseUrl?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  envFilePath?: string;
  timeoutMs?: number;
};

export type NormalizedBridgeConfig = {
  allowedTasks: KnownPublicTaskType[];
  baseUrl: string;
  apiKey?: string;
  apiKeyEnv?: string;
  envFilePath?: string;
  timeoutMs: number;
};

export type BridgeCommand =
  | { kind: "help" }
  | { kind: "list" }
  | { kind: "recent"; limit: number }
  | { kind: "status"; runId: string }
  | { kind: "run"; taskType: KnownPublicTaskType; payload: Record<string, unknown> };

type RotationKeyEntry = {
  key?: unknown;
  version?: unknown;
  expiresAt?: unknown;
  active?: unknown;
  label?: unknown;
  roles?: unknown;
};

export const DEFAULT_BASE_URL = "http://127.0.0.1:3312";
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_ENV_FILE = path.join("orchestrator", ".env");

const KNOWN_TASK_SET = new Set<string>(KNOWN_PUBLIC_TASK_TYPES);

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitOnce(input: string): { head: string; tail: string } {
  const trimmed = input.trim();
  if (!trimmed) return { head: "", tail: "" };
  const separatorIndex = trimmed.search(/\s/);
  if (separatorIndex === -1) return { head: trimmed, tail: "" };
  return {
    head: trimmed.slice(0, separatorIndex),
    tail: trimmed.slice(separatorIndex).trim(),
  };
}

function parseJsonObject(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON payload must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function buildShorthandPayload(
  taskType: KnownPublicTaskType,
  rawArgs: string,
): Record<string, unknown> {
  const trimmed = rawArgs.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{")) {
    return parseJsonObject(trimmed);
  }

  switch (taskType) {
    case "market-research":
      return { query: trimmed };
    case "summarize-content":
      return { content: trimmed };
    case "data-extraction":
      return { content: trimmed };
    case "qa-verification":
      return { target: trimmed };
    case "security-audit":
      return { scope: trimmed };
    case "system-monitor":
      return { type: trimmed };
    case "build-refactor":
      return { scope: trimmed };
    case "content-generate":
      return {
        source: {
          name: "Telegram command",
          description: trimmed,
        },
      };
    case "skill-audit":
      return {
        skillIds: trimmed
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      };
    default:
      throw new Error(
        `Task "${taskType}" needs a JSON object payload. Example: /orch ${taskType} {"key":"value"}`,
      );
  }
}

export function normalizeBridgeConfig(
  rawConfig: unknown,
  workspaceDir?: string,
): NormalizedBridgeConfig {
  const config =
    rawConfig && typeof rawConfig === "object"
      ? (rawConfig as BridgePluginConfig)
      : ({ allowedTasks: [] } as BridgePluginConfig);
  const allowedTasks = Array.isArray(config.allowedTasks)
    ? config.allowedTasks.filter(
        (taskType): taskType is KnownPublicTaskType =>
          typeof taskType === "string" && KNOWN_TASK_SET.has(taskType),
      )
    : [];

  if (allowedTasks.length === 0) {
    throw new Error(
      "orchestrator-bridge needs at least one valid allowed task in plugins.entries.orchestrator-bridge.config.allowedTasks.",
    );
  }

  const baseUrl = trimToUndefined(config.baseUrl) ?? DEFAULT_BASE_URL;
  const apiKey = trimToUndefined(config.apiKey);
  const apiKeyEnv = trimToUndefined(config.apiKeyEnv);
  const envFilePath =
    trimToUndefined(config.envFilePath) ??
    (workspaceDir ? path.join(workspaceDir, DEFAULT_ENV_FILE) : undefined);
  const timeoutMs =
    typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs >= 1000
      ? Math.floor(config.timeoutMs)
      : DEFAULT_TIMEOUT_MS;

  return {
    allowedTasks,
    baseUrl,
    apiKey,
    apiKeyEnv,
    envFilePath,
    timeoutMs,
  };
}

export function parseBridgeCommand(
  rawArgs: string | undefined,
  allowedTasks: readonly KnownPublicTaskType[],
): BridgeCommand {
  const args = rawArgs?.trim() ?? "";
  if (!args) return { kind: "help" };

  const allowedTaskSet = new Set<string>(allowedTasks);
  const { head, tail } = splitOnce(args);
  const normalizedHead = head.toLowerCase();

  if (normalizedHead === "help") return { kind: "help" };
  if (normalizedHead === "list") return { kind: "list" };
  if (normalizedHead === "recent") {
    return { kind: "recent", limit: Math.min(parsePositiveInt(tail, 5), 10) };
  }
  if (normalizedHead === "status") {
    const runId = tail.trim();
    if (!runId) throw new Error("Usage: /orch status <runId>");
    return { kind: "status", runId };
  }
  if (normalizedHead === "run") {
    const { head: taskTypeRaw, tail: payloadRaw } = splitOnce(tail);
    if (!taskTypeRaw) throw new Error("Usage: /orch run <task-type> [json payload]");
    if (!KNOWN_TASK_SET.has(taskTypeRaw)) {
      throw new Error(`Unknown task type "${taskTypeRaw}". Use /orch list to see the allowed set.`);
    }
    if (!allowedTaskSet.has(taskTypeRaw)) {
      throw new Error(`Task "${taskTypeRaw}" is not enabled in the bridge allowlist.`);
    }
    return {
      kind: "run",
      taskType: taskTypeRaw as KnownPublicTaskType,
      payload: buildShorthandPayload(taskTypeRaw as KnownPublicTaskType, payloadRaw),
    };
  }

  if (!KNOWN_TASK_SET.has(head)) {
    throw new Error(`Unknown subcommand or task "${head}". Use /orch help.`);
  }
  if (!allowedTaskSet.has(head)) {
    throw new Error(`Task "${head}" is not enabled in the bridge allowlist.`);
  }
  return {
    kind: "run",
    taskType: head as KnownPublicTaskType,
    payload: buildShorthandPayload(head as KnownPublicTaskType, tail),
  };
}

function parseDotEnv(contents: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

function isRoleArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function selectRotationOperatorKey(rawValue: string): string | undefined {
  const parsed = JSON.parse(rawValue) as unknown;
  if (!Array.isArray(parsed)) return undefined;
  const candidates = parsed
    .map((entry) => entry as RotationKeyEntry)
    .filter((entry) => typeof entry.key === "string" && entry.key.trim().length > 0)
    .filter((entry) => entry.active !== false)
    .filter((entry) => {
      if (typeof entry.expiresAt !== "string") return true;
      const expiresAt = new Date(entry.expiresAt);
      return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > Date.now();
    })
    .filter((entry) => {
      if (!isRoleArray(entry.roles)) return true;
      return entry.roles.includes("operator") || entry.roles.includes("admin");
    })
    .sort((left, right) => {
      const leftVersion = typeof left.version === "number" ? left.version : 0;
      const rightVersion = typeof right.version === "number" ? right.version : 0;
      return rightVersion - leftVersion;
    });

  const selected = candidates[0];
  return typeof selected?.key === "string" ? selected.key.trim() : undefined;
}

export async function resolveBridgeApiKey(
  config: NormalizedBridgeConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  if (config.apiKey) return config.apiKey;
  if (config.apiKeyEnv) {
    const fromEnv = trimToUndefined(env[config.apiKeyEnv]);
    if (fromEnv) return fromEnv;
  }
  if (!config.envFilePath) return undefined;

  try {
    const contents = await readFile(config.envFilePath, "utf8");
    const parsed = parseDotEnv(contents);
    const rotationValue = trimToUndefined(parsed.API_KEY_ROTATION);
    if (rotationValue) {
      const rotationKey = selectRotationOperatorKey(rotationValue);
      if (rotationKey) return rotationKey;
      return undefined;
    }
    return trimToUndefined(parsed.API_KEY);
  } catch {
    return undefined;
  }
}

type ApiRequestParams = {
  config: NormalizedBridgeConfig;
  apiKey: string;
  pathname: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

export async function orchestratorRequest({
  config,
  apiKey,
  pathname,
  method = "GET",
  body,
}: ApiRequestParams): Promise<unknown> {
  const response = await fetch(`${config.baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const responseText = await response.text();
  const responseData =
    responseText.trim().length > 0 ? safeJsonParse(responseText) : undefined;

  if (!response.ok) {
    const detail =
      responseData &&
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData &&
      typeof responseData.error === "string"
        ? responseData.error
        : responseText.trim() || response.statusText;
    throw new Error(`Orchestrator request failed (${response.status}): ${detail}`);
  }

  return responseData;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

export function formatHelp(allowedTasks: readonly KnownPublicTaskType[]): string {
  return [
    "Orchestrator bridge",
    "",
    "Usage:",
    "/orch list",
    "/orch recent [limit]",
    "/orch status <runId>",
    "/orch <task-type> [json payload]",
    "/orch run <task-type> [json payload]",
    "",
    "Plain-text shorthand works for:",
    "- market-research",
    "- summarize-content",
    "- data-extraction",
    "- qa-verification",
    "- security-audit",
    "- system-monitor",
    "- build-refactor",
    "- content-generate",
    "- skill-audit",
    "",
    `Allowed tasks: ${allowedTasks.join(", ")}`,
  ].join("\n");
}

type CatalogTask = {
  type?: unknown;
  label?: unknown;
  purpose?: unknown;
  approvalGated?: unknown;
  caveats?: unknown;
};

export function formatTaskList(
  allowedTasks: readonly KnownPublicTaskType[],
  catalogData: unknown,
): string {
  const tasks =
    catalogData &&
    typeof catalogData === "object" &&
    catalogData !== null &&
    "tasks" in catalogData &&
    Array.isArray((catalogData as { tasks?: unknown }).tasks)
      ? ((catalogData as { tasks: unknown[] }).tasks as CatalogTask[])
      : [];

  if (tasks.length === 0) {
    return [
      "Bridge allowlist",
      "",
      ...allowedTasks.map((taskType) => `- ${taskType}`),
    ].join("\n");
  }

  const filtered = tasks.filter((task) =>
    typeof task.type === "string" ? allowedTasks.includes(task.type as KnownPublicTaskType) : false,
  );

  return [
    "Bridge allowlist",
    "",
    ...filtered.map((task) => {
      const type = String(task.type ?? "unknown");
      const label = String(task.label ?? type);
      const purpose = String(task.purpose ?? "No purpose available.");
      const gated = task.approvalGated === true ? " approval-gated" : "";
      const caveats = Array.isArray(task.caveats)
        ? (task.caveats as unknown[])
            .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
            .slice(0, 1)
        : [];
      return `- ${label} (${type}${gated}): ${purpose}${caveats.length > 0 ? ` Caveat: ${caveats[0]}` : ""}`;
    }),
  ].join("\n");
}

type RunRecord = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  createdAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
};

export function formatRecentRuns(data: unknown): string {
  const runs =
    data &&
    typeof data === "object" &&
    data !== null &&
    "runs" in data &&
    Array.isArray((data as { runs?: unknown }).runs)
      ? ((data as { runs: unknown[] }).runs as RunRecord[])
      : [];

  if (runs.length === 0) {
    return "No recent orchestrator runs found.";
  }

  return [
    "Recent orchestrator runs",
    "",
    ...runs.map((run) => {
      const id = String(run.id ?? "unknown");
      const type = String(run.type ?? "unknown");
      const status = String(run.status ?? "unknown");
      const timestamp = String(
        run.completedAt ?? run.startedAt ?? run.createdAt ?? "unknown",
      );
      return `- ${type} ${status} ${id} @ ${timestamp}`;
    }),
  ].join("\n");
}

type RunDetail = {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  createdAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  error?: unknown;
  result?: unknown;
  workflow?: unknown;
};

export function formatRunStatus(data: unknown): string {
  const run =
    data && typeof data === "object" && data !== null
      ? (data as RunDetail)
      : {};
  const resultSummary =
    run.result && typeof run.result === "object"
      ? (run.result as Record<string, unknown>).summary
      : undefined;
  const workflowSummary =
    run.workflow && typeof run.workflow === "object"
      ? (run.workflow as Record<string, unknown>).summary
      : undefined;

  return [
    `Run ${String(run.id ?? "unknown")}`,
    `Type: ${String(run.type ?? "unknown")}`,
    `Status: ${String(run.status ?? "unknown")}`,
    `Created: ${String(run.createdAt ?? "unknown")}`,
    `Started: ${String(run.startedAt ?? "n/a")}`,
    `Completed: ${String(run.completedAt ?? "n/a")}`,
    `Error: ${String(run.error ?? "none")}`,
    `Result: ${String(resultSummary ?? "n/a")}`,
    `Workflow: ${String(workflowSummary ?? "n/a")}`,
  ].join("\n");
}
