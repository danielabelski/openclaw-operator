import { spawn } from "node:child_process";

type TargetParam = "projectRoot" | "adapterRoot" | null;

type ToolDefinition = {
  name: string;
  intent: string;
  command: string;
  targetParam: TargetParam;
  description: string;
};

type NormalizedConfig = {
  binaryPath: string;
  timeoutMs: number;
};

type CliRunResult = {
  command: string;
  args: string[];
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export const DEFAULT_BINARY_PATH = "coding-agent-skills";
export const DEFAULT_TIMEOUT_MS = 45_000;

export const CODING_AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "coding_validate_pack",
    intent: "coding.validatePack",
    command: "validate-pack",
    targetParam: null,
    description:
      "Validate the installed coding-agent-skills package and return JSON evidence.",
  },
  {
    name: "coding_validate_project",
    intent: "coding.validateProject",
    command: "validate-project",
    targetParam: "projectRoot",
    description:
      "Validate a project-owned coding-agent-skills adapter and return JSON evidence.",
  },
  {
    name: "coding_repo_map",
    intent: "coding.repoMap",
    command: "repo-map",
    targetParam: "projectRoot",
    description:
      "Render a read-only, adapter-aware repo-map report for a project root.",
  },
  {
    name: "coding_route_trace",
    intent: "coding.routeTrace",
    command: "route-trace",
    targetParam: "projectRoot",
    description:
      "Run the read-only route-trace audit for a project root and return JSON evidence.",
  },
  {
    name: "coding_env_audit",
    intent: "coding.envAudit",
    command: "env-audit",
    targetParam: "projectRoot",
    description:
      "Run the read-only environment-surface audit for a project root without reading secret values.",
  },
  {
    name: "coding_secret_audit",
    intent: "coding.secretAudit",
    command: "secret-audit",
    targetParam: "projectRoot",
    description:
      "Run the read-only secret-surface audit for a project root without printing secret values.",
  },
  {
    name: "coding_api_contract_audit",
    intent: "coding.apiContractAudit",
    command: "api-contract-audit",
    targetParam: "projectRoot",
    description:
      "Run the read-only API contract audit for a project root and return JSON evidence.",
  },
  {
    name: "coding_migration_review",
    intent: "coding.migrationReview",
    command: "migration-review",
    targetParam: "projectRoot",
    description:
      "Run the read-only migration review for a project root without applying migrations.",
  },
  {
    name: "coding_github_handoff",
    intent: "coding.githubHandoff",
    command: "github-handoff",
    targetParam: "projectRoot",
    description:
      "Run the read-only GitHub handoff audit for a project root without pushing or creating releases.",
  },
  {
    name: "coding_deployment_preflight",
    intent: "coding.deploymentPreflight",
    command: "deployment-preflight",
    targetParam: "projectRoot",
    description:
      "Run the read-only deployment preflight audit for a project root without deploys, builds, tests, provider calls, or migrations.",
  },
  {
    name: "coding_validate_adapters",
    intent: "coding.validateAdapters",
    command: "validate-adapters",
    targetParam: "adapterRoot",
    description:
      "Validate an adapter fixture/root with coding-agent-skills and return JSON evidence.",
  },
];

const DEFINITION_BY_NAME = new Map(
  CODING_AGENT_TOOL_DEFINITIONS.map((definition) => [definition.name, definition]),
);

export function normalizePluginConfig(rawConfig: unknown): NormalizedConfig {
  const config =
    rawConfig && typeof rawConfig === "object"
      ? (rawConfig as Record<string, unknown>)
      : {};

  const binaryPath =
    typeof config.binaryPath === "string" && config.binaryPath.trim()
      ? config.binaryPath.trim()
      : DEFAULT_BINARY_PATH;

  const timeoutMs =
    typeof config.timeoutMs === "number" &&
    Number.isFinite(config.timeoutMs) &&
    config.timeoutMs >= 1000 &&
    config.timeoutMs <= 120000
      ? Math.floor(config.timeoutMs)
      : DEFAULT_TIMEOUT_MS;

  return { binaryPath, timeoutMs };
}

function parametersFor(targetParam: TargetParam): Record<string, unknown> {
  if (targetParam === null) {
    return {
      type: "object",
      additionalProperties: false,
      properties: {},
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: [targetParam],
    properties: {
      [targetParam]: {
        type: "string",
        minLength: 1,
      },
    },
  };
}

function actualParams(firstArg: unknown, secondArg: unknown): Record<string, unknown> {
  const candidate = secondArg === undefined ? firstArg : secondArg;
  return candidate && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : {};
}

function rejectUnsafeBinaryPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("binaryPath must not be empty.");
  }
  if (/[\0\r\n]/u.test(trimmed)) {
    throw new Error("binaryPath contains unsupported control characters.");
  }
  if (/(^|\/)\.env(\.|$)/u.test(trimmed)) {
    throw new Error("binaryPath must not point at an env or secret file.");
  }
  if (/(^|\/)(secrets?|tokens?|credentials?|private)(\/|$)/iu.test(trimmed)) {
    throw new Error("binaryPath must not point at a secret or credential directory.");
  }
  if (/\bnpx\b/u.test(trimmed)) {
    throw new Error("binaryPath must use an installed coding-agent-skills binary, not npx.");
  }

  return trimmed;
}

function rejectUnsafeTargetPath(value: unknown, paramName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${paramName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${paramName} must not be empty.`);
  }
  if (trimmed.startsWith("-")) {
    throw new Error(`${paramName} must be a path, not a CLI option.`);
  }
  if (/[\0\r\n]/u.test(trimmed)) {
    throw new Error(`${paramName} contains unsupported control characters.`);
  }
  if (/(^|\/)\.env(\.|$)/u.test(trimmed)) {
    throw new Error(`${paramName} must not point at an env or secret file.`);
  }
  if (/(^|\/)(secrets?|tokens?|credentials?|private)(\/|$)/iu.test(trimmed)) {
    throw new Error(`${paramName} must not point at a secret or credential directory.`);
  }

  return trimmed;
}

export function buildCliArgs(toolName: string, params: Record<string, unknown>): string[] {
  const definition = DEFINITION_BY_NAME.get(toolName);
  if (!definition) {
    throw new Error(`Unknown coding-agent-skills tool: ${toolName}`);
  }

  if (definition.targetParam === null) {
    return [definition.command, "--json"];
  }

  const targetPath = rejectUnsafeTargetPath(
    params[definition.targetParam],
    definition.targetParam,
  );
  return [definition.command, targetPath, "--json"];
}

export function sanitizeForOpenClawText(input: string): string {
  return input
    .replace(/\/home\/[A-Za-z0-9._-]+\/[^\s"'`]+/gu, "[REDACTED:local-home-path]")
    .replace(/github_pat_[A-Za-z0-9_]+/gu, "[REDACTED:secret-like]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu, "[REDACTED:secret-like]")
    .replace(/\bnpm_[A-Za-z0-9_]{20,}\b/gu, "[REDACTED:secret-like]")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/gu, "[REDACTED:secret-like]")
    .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/giu, "Authorization: Bearer [REDACTED]");
}

async function runCli(
  binaryPath: string,
  args: string[],
  timeoutMs: number,
): Promise<CliRunResult> {
  const safeBinaryPath = rejectUnsafeBinaryPath(binaryPath);

  return new Promise((resolve) => {
    const child = spawn(safeBinaryPath, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        HOME: process.env.HOME ?? "",
        LANG: process.env.LANG ?? "C.UTF-8",
        LC_ALL: process.env.LC_ALL ?? "",
        PATH: process.env.PATH ?? "",
      },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        command: safeBinaryPath,
        args,
        code: null,
        stdout: "",
        stderr: "",
        error: error.message,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command: safeBinaryPath,
        args,
        code,
        stdout,
        stderr,
        error: timedOut ? `coding-agent-skills timed out after ${timeoutMs}ms.` : undefined,
      });
    });
  });
}

function safeJsonFromStdout(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    JSON.parse(trimmed);
    return sanitizeForOpenClawText(trimmed);
  } catch {
    return undefined;
  }
}

export function formatCliResult(result: CliRunResult): string {
  const stdoutJson = safeJsonFromStdout(result.stdout);
  if (stdoutJson && result.code === 0 && !result.error) {
    return stdoutJson;
  }

  const payload = {
    success: false,
    status: "failed",
    tool: "openclaw-coding-agent-skills",
    command: result.args[0],
    changedState: false,
    summary: ["coding-agent-skills command did not complete successfully"],
    warnings: result.stderr.trim() ? [sanitizeForOpenClawText(result.stderr.trim())] : [],
    failures: [
      result.error
        ? sanitizeForOpenClawText(result.error)
        : `coding-agent-skills exited with code ${result.code ?? "unknown"}`,
    ],
    stdout: stdoutJson ? JSON.parse(stdoutJson) : sanitizeForOpenClawText(result.stdout.trim()),
    recommendedNextAction: {
      label: "Inspect coding-agent-skills command result",
      reason: "The OpenClaw wrapper only invokes fixed read-only commands and preserves the failure boundary.",
      requiresApproval: false,
    },
    safety: {
      readOnly: true,
      secretsRead: false,
      targetCommandsRun: false,
      mutationsPerformed: false,
    },
    exitCode: result.code,
    exitCodeMeaning: result.code === 0 ? "handled" : "failed",
  };

  return JSON.stringify(payload, null, 2);
}

function failureText(error: unknown, toolName: string): string {
  const message = error instanceof Error ? error.message : "Unknown coding-agent-skills wrapper error.";
  return JSON.stringify(
    {
      success: false,
      status: "failed",
      tool: "openclaw-coding-agent-skills",
      command: toolName,
      changedState: false,
      summary: ["OpenClaw rejected the coding-agent-skills invocation before running the CLI."],
      failures: [sanitizeForOpenClawText(message)],
      recommendedNextAction: {
        label: "Fix tool input",
        reason: "The wrapper rejects option injection, secret paths, and malformed targets before calling the CLI.",
        requiresApproval: false,
      },
      safety: {
        readOnly: true,
        secretsRead: false,
        targetCommandsRun: false,
        mutationsPerformed: false,
      },
      exitCode: 2,
      exitCodeMeaning: "usage-error",
    },
    null,
    2,
  );
}

export function registerCodingAgentSkillsTools(api: any) {
  for (const definition of CODING_AGENT_TOOL_DEFINITIONS) {
    api.registerTool(
      {
        name: definition.name,
        description: `${definition.intent}: ${definition.description}`,
        parameters: parametersFor(definition.targetParam),
        execute: async (firstArg: unknown, secondArg: unknown) => {
          try {
            const config = normalizePluginConfig(api.pluginConfig);
            const params = actualParams(firstArg, secondArg);
            const args = buildCliArgs(definition.name, params);
            const result = await runCli(config.binaryPath, args, config.timeoutMs);
            return {
              content: [{ type: "text", text: formatCliResult(result) }],
            };
          } catch (error) {
            return {
              content: [{ type: "text", text: failureText(error, definition.name) }],
            };
          }
        },
      },
      { optional: true },
    );
  }
}
