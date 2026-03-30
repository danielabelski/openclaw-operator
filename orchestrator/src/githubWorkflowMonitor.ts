import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

type ExecFileResult = {
  stdout: string;
  stderr: string;
};

type ExecFileFn = (
  file: string,
  args: string[],
  options?: Record<string, unknown>,
) => Promise<ExecFileResult>;

const execFileAsync = promisify(execFile) as ExecFileFn;
const GH_RUN_FIELDS = [
  "databaseId",
  "workflowName",
  "displayTitle",
  "status",
  "conclusion",
  "url",
  "headBranch",
  "headSha",
  "event",
  "updatedAt",
].join(",");

export type GitHubWorkflowMonitorStatus =
  | "disabled"
  | "unavailable"
  | "healthy"
  | "warning"
  | "failed";

export interface GitHubWorkflowRunSummary {
  databaseId: number | null;
  workflowName: string | null;
  displayTitle: string | null;
  status: string | null;
  conclusion: string | null;
  url: string | null;
  headBranch: string | null;
  headSha: string | null;
  event: string | null;
  updatedAt: string | null;
}

export interface GitHubWorkflowMonitorState {
  enabled: boolean;
  available: boolean;
  status: GitHubWorkflowMonitorStatus;
  summary: string;
  repository: string | null;
  branch: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  source: "gh" | "disabled" | "unavailable";
  latestRun: GitHubWorkflowRunSummary | null;
}

function buildMonitorState(
  partial: Partial<GitHubWorkflowMonitorState>,
): GitHubWorkflowMonitorState {
  return {
    enabled: partial.enabled ?? false,
    available: partial.available ?? false,
    status: partial.status ?? "unavailable",
    summary: partial.summary ?? "GitHub workflow monitor unavailable.",
    repository: partial.repository ?? null,
    branch: partial.branch ?? null,
    lastCheckedAt: partial.lastCheckedAt ?? null,
    error: partial.error ?? null,
    source: partial.source ?? "unavailable",
    latestRun: partial.latestRun ?? null,
  };
}

export function parseGitHubRepositoryFromRemote(
  remoteUrl: string | null | undefined,
): string | null {
  if (typeof remoteUrl !== "string" || remoteUrl.trim().length === 0) {
    return null;
  }

  const normalized = remoteUrl.trim();
  const httpsMatch = normalized.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!httpsMatch) {
    return null;
  }

  const owner = httpsMatch[1]?.trim();
  const repo = httpsMatch[2]?.trim();
  if (!owner || !repo) {
    return null;
  }
  return `${owner}/${repo}`;
}

async function runTextCommand(args: {
  command: string;
  commandArgs: string[];
  cwd: string;
  execFileFn: ExecFileFn;
}): Promise<string | null> {
  try {
    const result = await args.execFileFn(args.command, args.commandArgs, {
      cwd: args.cwd,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    const value = result.stdout.trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function normalizeLatestRun(value: unknown): GitHubWorkflowRunSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  return {
    databaseId:
      typeof raw.databaseId === "number"
        ? raw.databaseId
        : typeof raw.databaseId === "string"
          ? Number(raw.databaseId)
          : null,
    workflowName:
      typeof raw.workflowName === "string" ? raw.workflowName : null,
    displayTitle:
      typeof raw.displayTitle === "string" ? raw.displayTitle : null,
    status: typeof raw.status === "string" ? raw.status : null,
    conclusion:
      typeof raw.conclusion === "string" ? raw.conclusion : null,
    url: typeof raw.url === "string" ? raw.url : null,
    headBranch:
      typeof raw.headBranch === "string" ? raw.headBranch : null,
    headSha: typeof raw.headSha === "string" ? raw.headSha : null,
    event: typeof raw.event === "string" ? raw.event : null,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export async function resolveGitRepositoryWorkspace(args: {
  cwd: string;
  execFileFn?: ExecFileFn;
}): Promise<string> {
  const execFn = args.execFileFn ?? execFileAsync;
  const repositoryRoot = await runTextCommand({
    command: "git",
    commandArgs: ["rev-parse", "--show-toplevel"],
    cwd: args.cwd,
    execFileFn: execFn,
  });

  return repositoryRoot ?? args.cwd;
}

export async function resolveGitHubCliBinary(args: {
  cwd: string;
  ghBin?: string;
  execFileFn?: ExecFileFn;
}): Promise<string> {
  if (typeof args.ghBin === "string" && args.ghBin.trim().length > 0) {
    return args.ghBin.trim();
  }

  const execFn = args.execFileFn ?? execFileAsync;
  const discovered = await runTextCommand({
    command: "which",
    commandArgs: ["gh"],
    cwd: args.cwd,
    execFileFn: execFn,
  });
  if (discovered) {
    return discovered;
  }

  const candidatePaths = [
    process.env.OPENCLAW_GH_BIN,
    process.env.GH_BIN,
    process.env.HOME ? join(process.env.HOME, ".openclaw", "bin", "gh") : null,
    "/usr/local/bin/gh",
    "/usr/bin/gh",
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const fallback = candidatePaths.find((candidate) => existsSync(candidate));
  return fallback ?? "gh";
}

function summarizeLatestRun(args: {
  repository: string;
  branch: string | null;
  run: GitHubWorkflowRunSummary;
  checkedAt: string;
}): GitHubWorkflowMonitorState {
  const { repository, branch, run, checkedAt } = args;
  const branchLabel = run.headBranch ?? branch ?? "unknown-branch";
  const workflowLabel = run.workflowName ?? "workflow";
  const titleLabel = run.displayTitle ?? workflowLabel;

  if (run.status && run.status !== "completed") {
    return buildMonitorState({
      enabled: true,
      available: true,
      status: "warning",
      summary: `GitHub Actions is still ${run.status} for ${workflowLabel} on ${branchLabel}.`,
      repository,
      branch: branchLabel,
      lastCheckedAt: checkedAt,
      source: "gh",
      latestRun: run,
    });
  }

  if (run.conclusion === "success") {
    return buildMonitorState({
      enabled: true,
      available: true,
      status: "healthy",
      summary: `Latest GitHub Actions run succeeded for ${workflowLabel} on ${branchLabel}.`,
      repository,
      branch: branchLabel,
      lastCheckedAt: checkedAt,
      source: "gh",
      latestRun: run,
    });
  }

  if (
    run.conclusion === "failure" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "startup_failure" ||
    run.conclusion === "action_required"
  ) {
    return buildMonitorState({
      enabled: true,
      available: true,
      status: "failed",
      summary: `Latest GitHub Actions run failed for ${workflowLabel} on ${branchLabel}: ${titleLabel}.`,
      repository,
      branch: branchLabel,
      lastCheckedAt: checkedAt,
      source: "gh",
      latestRun: run,
    });
  }

  return buildMonitorState({
    enabled: true,
    available: true,
    status: "warning",
    summary: `Latest GitHub Actions run completed with ${run.conclusion ?? "unknown"} for ${workflowLabel} on ${branchLabel}.`,
    repository,
    branch: branchLabel,
    lastCheckedAt: checkedAt,
    source: "gh",
    latestRun: run,
  });
}

export async function collectGitHubWorkflowMonitorState(args: {
  enabled: boolean;
  cwd: string;
  repo?: string | null;
  branch?: string | null;
  ghBin?: string;
  execFileFn?: ExecFileFn;
  now?: () => Date;
}): Promise<GitHubWorkflowMonitorState> {
  const checkedAt = (args.now ?? (() => new Date()))().toISOString();
  if (!args.enabled) {
    return buildMonitorState({
      enabled: false,
      available: false,
      status: "disabled",
      summary: "GitHub workflow monitor is disabled.",
      lastCheckedAt: checkedAt,
      source: "disabled",
    });
  }

  const execFn = args.execFileFn ?? execFileAsync;
  const repositoryWorkspace = await resolveGitRepositoryWorkspace({
    cwd: args.cwd,
    execFileFn: execFn,
  });
  const ghBin = await resolveGitHubCliBinary({
    cwd: repositoryWorkspace,
    ghBin: args.ghBin,
    execFileFn: execFn,
  });
  const remoteUrl =
    args.repo === undefined
      ? await runTextCommand({
          command: "git",
          commandArgs: ["config", "--get", "remote.origin.url"],
          cwd: repositoryWorkspace,
          execFileFn: execFn,
        })
      : null;
  const repository =
    args.repo ?? parseGitHubRepositoryFromRemote(remoteUrl);

  if (!repository) {
    return buildMonitorState({
      enabled: true,
      available: false,
      status: "unavailable",
      summary: "GitHub workflow monitor could not resolve a GitHub remote for this workspace.",
      lastCheckedAt: checkedAt,
      source: "unavailable",
    });
  }

  const branch =
    args.branch ??
    (await runTextCommand({
      command: "git",
      commandArgs: ["branch", "--show-current"],
      cwd: repositoryWorkspace,
      execFileFn: execFn,
    }));

  try {
    const ghArgs = [
      "run",
      "list",
      "--repo",
      repository,
      "--limit",
      "10",
      "--json",
      GH_RUN_FIELDS,
      ...(branch ? ["--branch", branch] : []),
    ];
    const result = await execFn(ghBin, ghArgs, {
      cwd: repositoryWorkspace,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(result.stdout) as unknown;
    const latestRun = Array.isArray(parsed)
      ? normalizeLatestRun(parsed[0] ?? null)
      : null;

    if (!latestRun) {
      return buildMonitorState({
        enabled: true,
        available: true,
        status: "warning",
        summary: `GitHub workflow monitor found no recent runs for ${repository}${branch ? ` on ${branch}` : ""}.`,
        repository,
        branch,
        lastCheckedAt: checkedAt,
        source: "gh",
      });
    }

    return summarizeLatestRun({
      repository,
      branch,
      run: latestRun,
      checkedAt,
    });
  } catch (error: any) {
    return buildMonitorState({
      enabled: true,
      available: false,
      status: "unavailable",
      summary: `GitHub workflow monitor could not query Actions for ${repository}.`,
      repository,
      branch,
      lastCheckedAt: checkedAt,
      error: error?.message ?? "unknown error",
      source: "unavailable",
    });
  }
}
