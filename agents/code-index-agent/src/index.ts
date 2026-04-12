import { readFileSync } from "node:fs";
import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DocIndexer } from "../../../orchestrator/src/docIndexer.js";
import {
  buildSpecialistOperatorFields,
  loadRuntimeState,
  type RuntimeStateSubset,
} from "../../shared/runtime-evidence.js";

interface AgentConfig {
  id: string;
  name: string;
  orchestratorStatePath: string;
  knowledgePackDir?: string;
  permissions: {
    skills?: Record<string, { allowed?: boolean }>;
    fileSystem?: {
      readPaths?: string[];
    };
  };
}

type IndexDecision = "ready" | "refresh" | "blocked";
type FreshnessStatus = "fresh" | "aging" | "stale" | "missing";

interface Task {
  id: string;
  type: string;
  target?: string;
  focusPaths?: string[] | string;
}

interface RuntimeState extends RuntimeStateSubset {}

interface IndexedEntry {
  path: string;
  lastModified: number;
}

interface KnowledgePackSummary {
  path: string;
  generatedAt: string | null;
  contradictionCount: number;
  repairDraftCount: number;
  targetAgentCount: number;
}

interface Result {
  success: boolean;
  codeIndex: {
    decision: IndexDecision;
    target: string;
    summary: string;
    blockers: string[];
    followups: string[];
    indexScope: {
      target: string;
      indexedRoots: string[];
      requestedFocusPaths: string[];
      matchedFocusPaths: string[];
      missingFocusPaths: string[];
      deniedFocusPaths: string[];
    };
    indexCoverage: {
      status: "broad" | "focused" | "thin";
      totalIndexedEntries: number;
      docEntryCount: number;
      codeEntryCount: number;
      indexedRootCount: number;
      samplePaths: string[];
    };
    docLinks: Array<{
      docPath: string;
      codePath: string;
      reason: string;
    }>;
    searchGaps: {
      status: "clear" | "watching" | "blocked";
      items: string[];
    };
    freshness: {
      status: FreshnessStatus;
      latestIndexedAt: string | null;
      knowledgePackGeneratedAt: string | null;
      lastRepairRunAt: string | null;
      knowledgePackPath: string | null;
      warnings: string[];
    };
    retrievalReadiness: {
      status: "ready" | "partial" | "blocked";
      signals: string[];
    };
    evidenceSources: string[];
  };
  handoffPackage: {
    targetAgentId: string;
    payloadType: string;
    reason: string;
    recommendedTaskType: string;
    evidenceAnchors: string[];
  } | null;
  toolInvocations: Array<{
    toolId: string;
    detail: string;
    evidence: string[];
    classification: string;
  }>;
  operatorSummary: string;
  recommendedNextActions: string[];
  specialistContract: {
    role: string;
    workflowStage: string;
    deliverable: string;
    status: "completed" | "watching" | "blocked" | "escalate" | "refused";
    operatorSummary: string;
    recommendedNextActions: string[];
    refusalReason: string | null;
    escalationReason: string | null;
  };
  executionTime: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = resolve(__dirname, "../agent.config.json");
const repoRoot = resolve(__dirname, "../../..");

const DEFAULT_INDEX_ROOTS = [
  "docs",
  "site/docs",
  "orchestrator/src",
  "operator-s-console/src",
  "agents",
] as const;

const CORE_EXPECTED_PATHS = [
  "docs/reference/api.md",
  "docs/reference/task-types.md",
  "WORKBOARD.md",
  "orchestrator/src/index.ts",
  "orchestrator/src/taskHandlers.ts",
  "operator-s-console/src/pages/TasksPage.tsx",
] as const;

const CANONICAL_LINKS = [
  {
    docPath: "docs/reference/api.md",
    codePath: "orchestrator/src/index.ts",
    reason: "API reference should stay linked to the live orchestrator route surface.",
  },
  {
    docPath: "docs/reference/task-types.md",
    codePath: "orchestrator/src/taskHandlers.ts",
    reason: "Task-type documentation should stay linked to live handler ownership.",
  },
  {
    docPath: "docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md",
    codePath: "orchestrator/src/index.ts",
    reason: "Capability claims should stay linked to runtime evidence promotion logic.",
  },
  {
    docPath: "WORKBOARD.md",
    codePath: "operator-s-console/src/pages/TasksPage.tsx",
    reason: "Operator workboard and task-launch surfaces should stay aligned.",
  },
  {
    docPath: "docs/architecture/AGENT_ADAPTATION_PLAN.md",
    codePath: "agents",
    reason: "Adaptation planning should stay grounded in the real agent catalog.",
  },
] as const;

function loadConfig(): AgentConfig {
  return JSON.parse(readFileSync(configPath, "utf-8")) as AgentConfig;
}

function canUseSkill(skillId: string): boolean {
  const config = loadConfig();
  return config.permissions.skills?.[skillId]?.allowed === true;
}

function normalizeBoundaryPath(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function pathMatchesBoundary(targetPath: string, boundary: string) {
  const normalizedTarget = normalizeBoundaryPath(targetPath);
  const normalizedBoundary = normalizeBoundaryPath(boundary);

  if (!normalizedTarget || !normalizedBoundary) {
    return false;
  }

  return (
    normalizedTarget === normalizedBoundary ||
    normalizedTarget.startsWith(`${normalizedBoundary}/`) ||
    normalizedTarget.endsWith(`/${normalizedBoundary}`) ||
    normalizedTarget.includes(`/${normalizedBoundary}/`)
  );
}

function normalizeTarget(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "workspace";
}

function normalizeFocusPaths(value: unknown) {
  const raw =
    typeof value === "string"
      ? value
          .split(/\r?\n|,/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean)
        : [];

  return [...new Set(raw.map((entry) => normalizeBoundaryPath(entry)))].slice(0, 12);
}

function toIsoFromMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveReadBoundaries(config: AgentConfig) {
  const configured = config.permissions.fileSystem?.readPaths ?? [];
  return configured
    .map((entry) =>
      normalizeBoundaryPath(relative(repoRoot, resolve(dirname(configPath), entry))),
    )
    .filter(Boolean);
}

function resolveAbsoluteRepoPath(relativePath: string) {
  return resolve(repoRoot, relativePath);
}

async function loadOrchestratorConfig() {
  const orchestratorConfigPath = process.env.ORCHESTRATOR_CONFIG;
  if (!orchestratorConfigPath) {
    return null;
  }

  try {
    return JSON.parse(await readFile(orchestratorConfigPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

async function resolveKnowledgePackDir(config: AgentConfig) {
  const orchestratorConfig = await loadOrchestratorConfig();
  const orchestratorConfigPath = process.env.ORCHESTRATOR_CONFIG;

  if (
    orchestratorConfigPath &&
    orchestratorConfig &&
    typeof orchestratorConfig.knowledgePackDir === "string"
  ) {
    return resolve(dirname(orchestratorConfigPath), orchestratorConfig.knowledgePackDir);
  }

  if (typeof config.knowledgePackDir === "string" && config.knowledgePackDir.length > 0) {
    return resolve(dirname(configPath), config.knowledgePackDir);
  }

  return resolve(repoRoot, "logs/knowledge-packs");
}

async function gatherScanRoots(focusPaths: string[]) {
  const scanRoots = new Set<string>(DEFAULT_INDEX_ROOTS);

  for (const focusPath of focusPaths) {
    const absoluteFocusPath = resolveAbsoluteRepoPath(focusPath);
    if (!(await pathExists(absoluteFocusPath))) {
      continue;
    }

    const focusStats = await stat(absoluteFocusPath);
    const rootCandidate = focusStats.isDirectory() ? focusPath : dirname(focusPath);
    if (rootCandidate && rootCandidate !== ".") {
      scanRoots.add(normalizeBoundaryPath(rootCandidate));
    }
  }

  const resolvedRoots: string[] = [];
  for (const root of scanRoots) {
    const absoluteRoot = resolveAbsoluteRepoPath(root);
    if (await pathExists(absoluteRoot)) {
      resolvedRoots.push(root);
    }
  }

  return resolvedRoots.sort();
}

async function buildIndexedEntries(scanRoots: string[]) {
  const entries: IndexedEntry[] = [];

  for (const root of scanRoots) {
    const indexer = new DocIndexer(resolveAbsoluteRepoPath(root));
    await indexer.buildInitialIndex();
    for (const record of indexer.getIndex().values()) {
      entries.push({
        path: normalizeBoundaryPath(relative(repoRoot, record.path)),
        lastModified: record.lastModified,
      });
    }
  }

  const deduped = new Map<string, IndexedEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.path);
    if (!existing || entry.lastModified > existing.lastModified) {
      deduped.set(entry.path, entry);
    }
  }

  return [...deduped.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function findLatestKnowledgePack(
  knowledgePackDir: string,
): Promise<KnowledgePackSummary | null> {
  if (!(await pathExists(knowledgePackDir))) {
    return null;
  }

  const entries = await readdir(knowledgePackDir);
  const candidates = entries.filter(
    (entry) => entry.startsWith("knowledge-pack-") && entry.endsWith(".json"),
  );

  if (candidates.length === 0) {
    return null;
  }

  let latest: { path: string; mtimeMs: number } | null = null;
  for (const entry of candidates) {
    const absolutePath = resolve(knowledgePackDir, entry);
    const currentStat = await stat(absolutePath);
    if (!latest || currentStat.mtimeMs > latest.mtimeMs) {
      latest = { path: absolutePath, mtimeMs: currentStat.mtimeMs };
    }
  }

  if (!latest) {
    return null;
  }

  const raw = JSON.parse(await readFile(latest.path, "utf-8")) as {
    generatedAt?: string;
    contradictionLedger?: unknown[];
    repairDrafts?: unknown[];
    targetAgents?: unknown[];
  };

  return {
    path: normalizeBoundaryPath(relative(repoRoot, latest.path)),
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : null,
    contradictionCount: Array.isArray(raw.contradictionLedger)
      ? raw.contradictionLedger.length
      : 0,
    repairDraftCount: Array.isArray(raw.repairDrafts) ? raw.repairDrafts.length : 0,
    targetAgentCount: Array.isArray(raw.targetAgents) ? raw.targetAgents.length : 0,
  };
}

function latestSuccessfulExecutionAt(state: RuntimeState, types: string[]) {
  const executions = Array.isArray(state.taskExecutions) ? state.taskExecutions : [];
  const timestamps = executions
    .filter(
      (execution) =>
        execution.status === "success" &&
        typeof execution.type === "string" &&
        types.includes(execution.type) &&
        typeof execution.lastHandledAt === "string",
    )
    .map((execution) => execution.lastHandledAt as string)
    .sort((left, right) => Date.parse(right) - Date.parse(left));

  return timestamps[0] ?? null;
}

function buildIndexCoverage(entries: IndexedEntry[], indexedRootCount: number) {
  const docEntryCount = entries.filter((entry) => {
    const extension = extname(entry.path).toLowerCase();
    return (
      entry.path.startsWith("docs/") ||
      entry.path.startsWith("site/docs/") ||
      [".md", ".mdx", ".txt"].includes(extension)
    );
  }).length;
  const codeEntryCount = entries.filter((entry) => {
    const extension = extname(entry.path).toLowerCase();
    return [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"].includes(extension);
  }).length;
  const status =
    entries.length >= 120 ? "broad" : entries.length >= 40 ? "focused" : "thin";

  return {
    status: status as "broad" | "focused" | "thin",
    totalIndexedEntries: entries.length,
    docEntryCount,
    codeEntryCount,
    indexedRootCount,
    samplePaths: entries.slice(0, 6).map((entry) => entry.path),
  };
}

async function buildCanonicalDocLinks(requestedFocusPaths: string[]) {
  const links: Array<{ docPath: string; codePath: string; reason: string }> = [];

  for (const candidate of CANONICAL_LINKS) {
    const docExists = await pathExists(resolveAbsoluteRepoPath(candidate.docPath));
    const codeExists = await pathExists(resolveAbsoluteRepoPath(candidate.codePath));
    if (!docExists || !codeExists) {
      continue;
    }

    if (
      requestedFocusPaths.length > 0 &&
      !requestedFocusPaths.some(
        (focusPath) =>
          pathMatchesBoundary(candidate.docPath, focusPath) ||
          pathMatchesBoundary(candidate.codePath, focusPath) ||
          pathMatchesBoundary(focusPath, candidate.docPath) ||
          pathMatchesBoundary(focusPath, candidate.codePath),
      )
    ) {
      continue;
    }

    links.push(candidate);
  }

  if (links.length > 0 || requestedFocusPaths.length > 0) {
    return links.slice(0, 6);
  }

  const fallbackLinks: Array<{ docPath: string; codePath: string; reason: string }> = [];
  for (const candidate of CANONICAL_LINKS) {
    const docExists = await pathExists(resolveAbsoluteRepoPath(candidate.docPath));
    const codeExists = await pathExists(resolveAbsoluteRepoPath(candidate.codePath));
    if (docExists && codeExists) {
      fallbackLinks.push(candidate);
    }
  }

  return fallbackLinks.slice(0, 4);
}

async function buildCoreSurfaceGaps() {
  const gaps: string[] = [];

  for (const expectedPath of CORE_EXPECTED_PATHS) {
    if (!(await pathExists(resolveAbsoluteRepoPath(expectedPath)))) {
      gaps.push(`Required bounded surface is missing: ${expectedPath}.`);
    }
  }

  return gaps;
}

function buildFreshness(args: {
  entries: IndexedEntry[];
  latestKnowledgePack: KnowledgePackSummary | null;
  lastRepairRunAt: string | null;
}) {
  const latestIndexedAt = toIsoFromMs(
    args.entries.reduce((maxValue, entry) => Math.max(maxValue, entry.lastModified), 0),
  );
  const packGeneratedAt = args.latestKnowledgePack?.generatedAt ?? null;
  const warnings: string[] = [];
  let status: FreshnessStatus = "fresh";

  if (!args.latestKnowledgePack) {
    status = "missing";
    warnings.push("No local knowledge-pack artifact was found for bounded retrieval support.");
  } else if (packGeneratedAt) {
    const ageHours = (Date.now() - Date.parse(packGeneratedAt)) / (60 * 60 * 1000);
    if (!Number.isFinite(ageHours) || ageHours >= 168) {
      status = "stale";
      warnings.push("Latest knowledge-pack freshness is older than seven days.");
    } else if (ageHours >= 48) {
      status = "aging";
      warnings.push("Latest knowledge-pack freshness is older than forty-eight hours.");
    }
  } else {
    status = "aging";
    warnings.push("Latest knowledge-pack is present but does not declare generatedAt.");
  }

  if (!args.lastRepairRunAt) {
    warnings.push("No successful doc-sync or drift-repair run is recorded in runtime state.");
    if (status === "fresh") {
      status = "aging";
    }
  }

  return {
    status,
    latestIndexedAt,
    knowledgePackGeneratedAt: packGeneratedAt,
    lastRepairRunAt: args.lastRepairRunAt,
    knowledgePackPath: args.latestKnowledgePack?.path ?? null,
    warnings,
  };
}

function buildRetrievalReadiness(args: {
  coverage: {
    status: "broad" | "focused" | "thin";
    totalIndexedEntries: number;
    docEntryCount: number;
    codeEntryCount: number;
  };
  linkCount: number;
  freshnessStatus: FreshnessStatus;
  gapCount: number;
  blockerCount: number;
}) {
  const signals = [
    `${args.coverage.totalIndexedEntries} bounded index entries scanned.`,
    `${args.coverage.docEntryCount} doc entry(s) and ${args.coverage.codeEntryCount} code entry(s) are present.`,
    `${args.linkCount} canonical doc-to-code link(s) were grounded.`,
  ];

  if (args.freshnessStatus === "aging") {
    signals.push("Freshness is aging and should be refreshed before broad retrieval claims.");
  }
  if (args.freshnessStatus === "stale" || args.freshnessStatus === "missing") {
    signals.push("Retrieval freshness is not currently green.");
  }
  if (args.gapCount > 0) {
    signals.push(`${args.gapCount} bounded search gap(s) still need closure.`);
  }

  const status =
    args.blockerCount > 0
      ? "blocked"
      : args.coverage.status === "thin" ||
          args.linkCount < 2 ||
          args.gapCount > 0 ||
          args.freshnessStatus === "stale" ||
          args.freshnessStatus === "missing"
        ? "partial"
        : "ready";

  return {
    status: status as "ready" | "partial" | "blocked",
    signals,
  };
}

async function handleTask(task: Task): Promise<Result> {
  const startedAt = Date.now();
  const target = normalizeTarget(task.target);
  const requestedFocusPaths = normalizeFocusPaths(task.focusPaths);

  if (!canUseSkill("documentParser")) {
    const specialistFields = buildSpecialistOperatorFields({
      role: "Code Index",
      workflowStage: "code-index-refusal",
      deliverable: "bounded code index posture",
      status: "refused",
      operatorSummary:
        "Code-index synthesis was refused because documentParser access is unavailable to code-index-agent.",
      recommendedNextActions: [
        "Restore documentParser access for code-index-agent before retrying.",
      ],
      refusalReason:
        "Refused code-index synthesis because documentParser skill access is not allowed for code-index-agent.",
    });

    return {
      success: false,
      codeIndex: {
        decision: "blocked",
        target,
        summary: "Code-index posture could not be assembled.",
        blockers: ["documentParser unavailable"],
        followups: ["Restore code-index-agent governed access."],
        indexScope: {
          target,
          indexedRoots: [],
          requestedFocusPaths,
          matchedFocusPaths: [],
          missingFocusPaths: [],
          deniedFocusPaths: [],
        },
        indexCoverage: {
          status: "thin",
          totalIndexedEntries: 0,
          docEntryCount: 0,
          codeEntryCount: 0,
          indexedRootCount: 0,
          samplePaths: [],
        },
        docLinks: [],
        searchGaps: {
          status: "blocked",
          items: ["Code-index posture was refused before bounded repo roots could be scanned."],
        },
        freshness: {
          status: "missing",
          latestIndexedAt: null,
          knowledgePackGeneratedAt: null,
          lastRepairRunAt: null,
          knowledgePackPath: null,
          warnings: ["Code-index posture was refused before freshness checks could run."],
        },
        retrievalReadiness: {
          status: "blocked",
          signals: ["Code-index posture was refused before retrieval-readiness checks could run."],
        },
        evidenceSources: [],
      },
      handoffPackage: null,
      toolInvocations: [],
      ...specialistFields,
      executionTime: Date.now() - startedAt,
    };
  }

  const config = loadConfig();
  const allowedReadBoundaries = resolveReadBoundaries(config);
  const deniedFocusPaths = requestedFocusPaths.filter(
    (focusPath) => !allowedReadBoundaries.some((boundary) => pathMatchesBoundary(focusPath, boundary)),
  );
  const allowedFocusPaths = requestedFocusPaths.filter(
    (focusPath) => !deniedFocusPaths.includes(focusPath),
  );
  const missingFocusPaths: string[] = [];
  const matchedFocusPaths: string[] = [];

  for (const focusPath of allowedFocusPaths) {
    if (await pathExists(resolveAbsoluteRepoPath(focusPath))) {
      matchedFocusPaths.push(focusPath);
    } else {
      missingFocusPaths.push(focusPath);
    }
  }

  const scanRoots = await gatherScanRoots(allowedFocusPaths);
  const indexedEntries = await buildIndexedEntries(scanRoots);
  const runtimeState = await loadRuntimeState<RuntimeState>(
    configPath,
    config.orchestratorStatePath,
  );
  const knowledgePackDir = await resolveKnowledgePackDir(config);
  const latestKnowledgePack = await findLatestKnowledgePack(knowledgePackDir);
  const lastRepairRunAt = latestSuccessfulExecutionAt(runtimeState, ["doc-sync", "drift-repair"]);
  const coverage = buildIndexCoverage(indexedEntries, scanRoots.length);
  const docLinks = await buildCanonicalDocLinks(allowedFocusPaths);
  const freshness = buildFreshness({
    entries: indexedEntries,
    latestKnowledgePack,
    lastRepairRunAt,
  });
  const coreSurfaceGaps = await buildCoreSurfaceGaps();
  const searchGapItems = [
    ...coreSurfaceGaps,
    ...missingFocusPaths.map(
      (focusPath) => `Requested focus path is missing from the bounded repo surface: ${focusPath}.`,
    ),
    ...(deniedFocusPaths.length > 0
      ? deniedFocusPaths.map(
          (focusPath) =>
            `Requested focus path is outside the manifest read allowlist: ${focusPath}.`,
        )
      : []),
  ];

  if (coverage.totalIndexedEntries < 40) {
    searchGapItems.push("Bounded repo coverage is still thin for broad retrieval claims.");
  }
  if (docLinks.length < 2) {
    searchGapItems.push("Canonical doc-to-code linkage is incomplete for confident retrieval handoff.");
  }
  if (freshness.status === "aging") {
    searchGapItems.push("Knowledge freshness is aging and should be refreshed before broad reuse.");
  }
  if (freshness.status === "stale" || freshness.status === "missing") {
    searchGapItems.push("Knowledge freshness is stale or missing for bounded retrieval support.");
  }

  const blockers: string[] = [];
  const followups: string[] = [];

  if (deniedFocusPaths.length > 0) {
    blockers.push(`${deniedFocusPaths.length} focus path(s) fall outside the bounded read allowlist.`);
  }
  if (scanRoots.length === 0 || indexedEntries.length === 0) {
    blockers.push("No bounded repo roots could be indexed for code-index posture.");
  }

  if (coverage.status === "thin" && blockers.length === 0) {
    followups.push("Broaden the bounded repo roots or focus paths before relying on this lane for deep retrieval work.");
  }
  if (docLinks.length < 2) {
    followups.push("Strengthen canonical doc-to-code linkage before treating retrieval posture as ready.");
  }
  if (freshness.status === "aging" || freshness.status === "stale" || freshness.status === "missing") {
    followups.push("Refresh doc-sync or drift-repair so the latest knowledge-pack and freshness posture are current.");
  }
  if (missingFocusPaths.length > 0) {
    followups.push("Correct or remove focus paths that do not exist in the bounded repo surface.");
  }

  const retrievalReadiness = buildRetrievalReadiness({
    coverage,
    linkCount: docLinks.length,
    freshnessStatus: freshness.status,
    gapCount: searchGapItems.length,
    blockerCount: blockers.length,
  });

  const decision: IndexDecision =
    blockers.length > 0
      ? "blocked"
      : retrievalReadiness.status === "ready"
        ? "ready"
        : "refresh";

  const summary =
    decision === "ready"
      ? "Code-index posture is ready: bounded repo roots, canonical doc-to-code links, and retrieval freshness are present for local-first operator work."
      : decision === "refresh"
        ? "Code-index posture needs refresh: bounded repo roots are readable, but freshness, coverage, or linkage gaps still need closure before broad retrieval claims."
        : "Code-index posture is blocked: bounded access or required repo roots are unavailable for safe indexing.";

  const specialistFields = buildSpecialistOperatorFields({
    role: "Code Index",
    workflowStage:
      decision === "ready"
        ? "code-index-ready"
        : decision === "refresh"
          ? "code-index-refresh"
          : "code-index-block",
    deliverable: "bounded code-index posture with retrieval and linkage guidance",
    status:
      decision === "ready"
        ? "completed"
        : decision === "refresh"
          ? "watching"
          : "blocked",
    operatorSummary: summary,
    recommendedNextActions: [...blockers, ...followups].slice(0, 5),
    escalationReason:
      decision === "blocked"
        ? "Escalate because bounded repo roots or focus-path governance still block safe code-index posture."
        : null,
  });

  const handoffPackage =
    decision === "ready"
      ? null
      : {
          targetAgentId: "doc-specialist",
          payloadType: "code-index",
          reason: summary,
          recommendedTaskType: "drift-repair",
          evidenceAnchors: [
            `decision:${decision}`,
            `indexed-roots:${scanRoots.length}`,
            `doc-links:${docLinks.length}`,
            `freshness:${freshness.status}`,
            `gap-count:${searchGapItems.length}`,
          ],
        };

  const toolInvocations = [
    {
      toolId: "documentParser",
      detail:
        "code-index-agent parsed bounded repo roots, the latest local knowledge-pack artifact, and runtime freshness signals to synthesize index posture.",
      evidence: [
        `decision:${decision}`,
        `indexed-entries:${coverage.totalIndexedEntries}`,
        `doc-links:${docLinks.length}`,
        `freshness:${freshness.status}`,
      ],
      classification: "required",
    },
  ];

  return {
    success: decision !== "blocked",
    codeIndex: {
      decision,
      target,
      summary,
      blockers,
      followups: [...new Set(followups)].slice(0, 6),
      indexScope: {
        target,
        indexedRoots: scanRoots,
        requestedFocusPaths,
        matchedFocusPaths,
        missingFocusPaths,
        deniedFocusPaths,
      },
      indexCoverage: coverage,
      docLinks,
      searchGaps: {
        status: blockers.length > 0 ? "blocked" : searchGapItems.length > 0 ? "watching" : "clear",
        items: searchGapItems.slice(0, 8),
      },
      freshness,
      retrievalReadiness,
      evidenceSources: [
        ...scanRoots.map((root) => `repo-root:${root}`),
        ...(latestKnowledgePack ? [`knowledge-pack:${latestKnowledgePack.path}`] : []),
        ...(lastRepairRunAt ? [`last-repair-run:${lastRepairRunAt}`] : []),
      ],
    },
    handoffPackage,
    toolInvocations,
    ...specialistFields,
    executionTime: Date.now() - startedAt,
  };
}

export { handleTask, loadConfig, canUseSkill };

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) return;

  const raw = await readFile(payloadPath, "utf-8");
  const payload = JSON.parse(raw) as Task;
  const result = await handleTask(payload);

  const resultFile = process.env.CODE_INDEX_AGENT_RESULT_FILE;
  if (resultFile) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(dirname(resultFile), { recursive: true });
    await writeFile(resultFile, JSON.stringify(result, null, 2), "utf-8");
  } else {
    process.stdout.write(JSON.stringify(result));
  }

  if (result.success !== true) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
});
