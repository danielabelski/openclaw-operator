import { access, readdir, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { OrchestratorConfig, OrchestratorState } from "../types.js";
import { loadBusinessMission } from "./mission.js";
import type {
  BusinessCoverageGap,
  BusinessKpiSnapshot,
  BusinessOutcome,
  BusinessPipelineRecord,
  BusinessProject,
  BusinessRegistry,
  BusinessRegistryRisk,
  BusinessStrategicInitiative,
  CandidateWorkItem,
  CommercialReadinessCriterion,
} from "./types.js";

const DEFAULT_REGISTRY_URL = new URL(
  "../../../business/registry.json",
  import.meta.url,
);

const ACTIVE_COMMUNITY_PLATFORMS = [
  "X",
  "LinkedIn",
  "Threads",
  "Reddit",
  "Facebook",
  "Instagram",
] as const;

const COMMUNITY_DISCOVERY_SOURCES = [
  ...ACTIVE_COMMUNITY_PLATFORMS,
  "GitHub Discussions",
  "engineering blogs",
  "AI communities",
  "SaaS communities",
] as const;

const BUSINESS_OUTCOMES = new Set<BusinessOutcome>([
  "qualified-leads",
  "paying-clients",
  "increased-revenue",
  "recurring-revenue",
  "faster-delivery",
  "customer-satisfaction",
  "search-visibility",
  "community-value",
  "commercial-readiness",
  "product-quality",
  "risk-reduction",
  "manual-work-reduction",
  "reusable-ip",
  "operational-efficiency",
]);

const OUTCOME_ALIASES: Record<string, BusinessOutcome> = {
  "revenue-growth": "increased-revenue",
  revenue: "increased-revenue",
  "client-value": "customer-satisfaction",
  "client-success": "customer-satisfaction",
  "financial-health": "operational-efficiency",
  "market-credibility": "search-visibility",
  "projects-nearing-commercial-readiness": "commercial-readiness",
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asBusinessOutcome(
  value: unknown,
  fallback: BusinessOutcome = "commercial-readiness",
): BusinessOutcome {
  if (typeof value !== "string") return fallback;
  if (BUSINESS_OUTCOMES.has(value as BusinessOutcome)) return value as BusinessOutcome;
  return OUTCOME_ALIASES[value] ?? fallback;
}

function asBusinessOutcomes(value: unknown): BusinessOutcome[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => asBusinessOutcome(item));
}

function asConfidence(value: unknown): "verified" | "estimated" | "unknown" {
  if (value === "verified" || value === "estimated" || value === "unknown") return value;
  if (value === "verified-goal") return "verified";
  if (value === "coverage-gap-derived") return "estimated";
  return "unknown";
}

function asReadinessCriteria(value: unknown): CommercialReadinessCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: asString(item.id, "criterion"),
      label: asString(item.label, "Commercial readiness criterion"),
      status:
        item.status === "met" || item.status === "missing" || item.status === "unknown"
          ? item.status
          : "unknown",
      evidence: asStringArray(item.evidence),
    }));
}

function normalizeProbability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

const PIPELINE_STAGES = new Set<BusinessPipelineRecord["stage"]>([
  "discovered",
  "audited",
  "packet_ready",
  "draft_ready",
  "sent",
  "waiting_reply",
  "reply_needs_draft",
  "hold",
  "identified",
  "qualified",
  "brief-ready",
  "draft-ready",
  "approval-needed",
  "approved",
  "reply-received",
  "won",
  "lost",
  "on-hold",
]);

function normalizePipelineRecord(
  item: Record<string, unknown>,
  businessId: string,
): BusinessPipelineRecord {
  const type =
    item.type === "lead" ||
    item.type === "opportunity" ||
    item.type === "proposal" ||
    item.type === "community" ||
    item.type === "content"
      ? item.type
      : "opportunity";
  const stage = PIPELINE_STAGES.has(item.stage as BusinessPipelineRecord["stage"])
    ? item.stage as BusinessPipelineRecord["stage"]
    : "discovered";
  const approvalStatus =
    item.approvalStatus === "not-required" ||
    item.approvalStatus === "approved-and-executed" ||
    item.approvalStatus === "needs-packet" ||
    item.approvalStatus === "packet-ready" ||
    item.approvalStatus === "awaiting-approval" ||
    item.approvalStatus === "approved" ||
    item.approvalStatus === "rejected"
      ? item.approvalStatus
      : "not-required";

  return {
    id: asString(item.id, "pipeline-record"),
    type,
    title: asString(item.title, "Pipeline record"),
    businessId: asString(item.businessId, businessId),
    relatedProjectId: typeof item.relatedProjectId === "string" ? item.relatedProjectId : null,
    businessFunction: typeof item.businessFunction === "string" ? item.businessFunction : null,
    source: asString(item.source, "business registry"),
    stage,
    expectedOutcome: asBusinessOutcome(item.expectedOutcome, "qualified-leads"),
    kpiId: asString(item.kpiId, "qualified-leads"),
    valueEstimate:
      typeof item.valueEstimate === "number" && Number.isFinite(item.valueEstimate)
        ? item.valueEstimate
        : null,
    probability: normalizeProbability(item.probability),
    nextAction: asString(item.nextAction, "Prepare the next safe action."),
    approvalStatus,
    approvalAction: typeof item.approvalAction === "string" ? item.approvalAction : null,
    followUpAt: typeof item.followUpAt === "string" ? item.followUpAt : null,
    owner: typeof item.owner === "string" ? item.owner : null,
    evidence: asStringArray(item.evidence),
    draftSubject: typeof item.draftSubject === "string" ? item.draftSubject : null,
    draftBody: typeof item.draftBody === "string" ? item.draftBody : null,
    lastTouchAt: typeof item.lastTouchAt === "string" ? item.lastTouchAt : null,
    notes: typeof item.notes === "string" ? item.notes : null,
  };
}

function normalizeRegistry(raw: unknown, sourcePath: string): BusinessRegistry {
  const mission = loadBusinessMission();
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const projects = Array.isArray(input.projects) ? input.projects : [];
  const kpis = Array.isArray(input.kpis) ? input.kpis : [];
  const snapshots = Array.isArray(input.kpiSnapshots) ? input.kpiSnapshots : [];
  const pipeline = Array.isArray(input.pipeline) ? input.pipeline : [];
  const initiatives = Array.isArray(input.initiatives) ? input.initiatives : [];
  const riskRegister = Array.isArray(input.riskRegister) ? input.riskRegister : [];
  const coverageGaps = Array.isArray(input.coverageGaps) ? input.coverageGaps : [];
  const businessId = asString(input.businessId, mission.businessId);

  return {
    businessId,
    businessName: asString(input.businessName, mission.businessName),
    mission: asString(input.mission, mission.mission),
    vision: typeof input.vision === "string" ? input.vision : null,
    northStar: typeof input.northStar === "string" ? input.northStar : null,
    registryVersion: asString(input.registryVersion, "1"),
    schemaVersion: typeof input.schemaVersion === "string" ? input.schemaVersion : null,
    sourceRegistryVersion:
      typeof input.sourceRegistryVersion === "string" ? input.sourceRegistryVersion : null,
    updatedAt: asString(input.updatedAt, new Date(0).toISOString()),
    sourcePath,
    kpis: kpis
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: asString(item.id, "unknown-kpi"),
        label: asString(item.label, "Unknown KPI"),
        outcome: asBusinessOutcome(item.outcome),
        measurement: asString(item.measurement, "unknown"),
        confidence: asConfidence(item.confidence),
      })),
    kpiSnapshots: snapshots
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        kpiId: asString(item.kpiId, "unknown-kpi"),
        value:
          typeof item.value === "string" || typeof item.value === "number"
            ? item.value
            : null,
        capturedAt: asString(item.capturedAt, new Date(0).toISOString()),
        confidence: asConfidence(item.confidence),
        source: asString(item.source, sourcePath),
        notes: typeof item.notes === "string" ? item.notes : undefined,
      })) as BusinessKpiSnapshot[],
    projects: projects
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item): BusinessProject => ({
        id: asString(item.id, "unknown-project"),
        name: asString(item.name, "Unknown Project"),
        status:
          item.status === "active" ||
          item.status === "paused" ||
          item.status === "blocked" ||
          item.status === "marketable" ||
          item.status === "commercially-ready" ||
          item.status === "unknown"
            ? item.status
            : "unknown",
        repositories: Array.isArray(item.repositories)
          ? item.repositories
              .filter((repo): repo is Record<string, unknown> => Boolean(repo) && typeof repo === "object")
              .map((repo) => ({
                id: asString(repo.id, "unknown-repo"),
                path: asString(repo.path, ""),
                remote: typeof repo.remote === "string" ? repo.remote : null,
                branch: typeof repo.branch === "string" ? repo.branch : null,
                evidence: asStringArray(repo.evidence),
              }))
          : [],
        commercialOutcome: asString(item.commercialOutcome, "unknown"),
        targetCustomer: typeof item.targetCustomer === "string" ? item.targetCustomer : null,
        relevantKpis: asStringArray(item.relevantKpis),
        acceptanceCriteria: asReadinessCriteria(item.acceptanceCriteria),
        currentBlockers: asStringArray(item.currentBlockers),
        knownRisks: asStringArray(item.knownRisks),
        approvalBoundaries: asStringArray(item.approvalBoundaries),
        evidenceLocations: asStringArray(item.evidenceLocations),
        nextSafeAction: typeof item.nextSafeAction === "string" ? item.nextSafeAction : null,
      })),
    pipeline: pipeline
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => normalizePipelineRecord(item, businessId)),
    initiatives: initiatives
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item): BusinessStrategicInitiative => ({
        id: asString(item.id, "initiative"),
        title: asString(item.title, "Strategic initiative"),
        type: asString(item.type, "strategic-initiative"),
        status: asString(item.status, "unknown"),
        businessFunction: typeof item.businessFunction === "string" ? item.businessFunction : null,
        serviceLineId: typeof item.serviceLineId === "string" ? item.serviceLineId : null,
        expectedOutcomes: asBusinessOutcomes(item.expectedOutcomes),
        deliverables: asStringArray(item.deliverables),
        priorityProjects: asStringArray(item.priorityProjects),
        nextSafeAction: asString(item.nextSafeAction, "Prepare an internal evidence plan."),
        approvalBoundaries: asStringArray(item.approvalBoundaries),
        confidence: asConfidence(item.confidence),
      })),
    riskRegister: riskRegister
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item): BusinessRegistryRisk => ({
        id: asString(item.id, "risk"),
        title: asString(item.title, "Business risk"),
        description: typeof item.description === "string" ? item.description : null,
        severity: asString(item.severity, "unknown"),
        status: asString(item.status, "open"),
        mitigation: asString(item.mitigation, "Prepare a bounded mitigation plan."),
        linkedProjects: asStringArray(item.linkedProjects),
        confidence: asConfidence(item.confidence),
      })),
    coverageGaps: coverageGaps
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item): BusinessCoverageGap => ({
        id: asString(item.id, "coverage-gap"),
        area: asString(item.area, "Business evidence"),
        coverageStatus: asString(item.coverageStatus, "unknown"),
        missing: asStringArray(item.missing),
        priority: asString(item.priority, "unknown"),
        nextEvidenceNeeded: asString(item.nextEvidenceNeeded, "Authoritative evidence is required."),
      })),
    approvalPolicy:
      input.approvalPolicy && typeof input.approvalPolicy === "object"
        ? {
            policy: asString(
              (input.approvalPolicy as Record<string, unknown>).policy,
              mission.approvalBoundarySummary,
            ),
            approvalAuthority: asString(
              (input.approvalPolicy as Record<string, unknown>).approvalAuthority,
              "operator",
            ),
            alwaysApprovalRequired: asStringArray(
              (input.approvalPolicy as Record<string, unknown>).alwaysApprovalRequired,
            ),
            normallySafeWithoutAdditionalApproval: asStringArray(
              (input.approvalPolicy as Record<string, unknown>).normallySafeWithoutAdditionalApproval,
            ),
            requiredApprovalRecord: asStringArray(
              (input.approvalPolicy as Record<string, unknown>).requiredApprovalRecord,
            ),
            postActionRequirement: asString(
              (input.approvalPolicy as Record<string, unknown>).postActionRequirement,
              "Record the result and next safe action.",
            ),
          }
        : null,
  };
}

export function resolveBusinessRegistryPath(config: OrchestratorConfig): string {
  if (config.businessRegistryPath) {
    return resolve(config.businessRegistryPath);
  }
  return fileURLToPath(DEFAULT_REGISTRY_URL);
}

export async function loadBusinessRegistry(config: OrchestratorConfig): Promise<BusinessRegistry> {
  const registryPath = resolveBusinessRegistryPath(config);
  const raw = await readFile(registryPath, "utf-8");
  return normalizeRegistry(JSON.parse(raw), registryPath);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function discoverUnregisteredProjectRepos(registry: BusinessRegistry) {
  const workspaceRoot = resolve(process.cwd(), "..");
  const projectsRoot = join(workspaceRoot, "projects");
  const registeredPaths = new Set(
    registry.projects.flatMap((project) =>
      project.repositories.map((repo) => resolve(workspaceRoot, repo.path)),
    ),
  );

  if (!(await pathExists(projectsRoot))) {
    return [] as string[];
  }

  const entries = await readdir(projectsRoot, { withFileTypes: true });
  const missing: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const repoPath = join(projectsRoot, entry.name);
    try {
      const git = await stat(join(repoPath, ".git"));
      if (git.isDirectory() && !registeredPaths.has(resolve(repoPath))) {
        missing.push(`projects/${entry.name}`);
      }
    } catch {
      // Not a git repo.
    }
  }
  return missing;
}

function projectReadinessCandidate(
  registry: BusinessRegistry,
  project: BusinessProject,
  missingCriteria: CommercialReadinessCriterion[],
): CandidateWorkItem {
  const evidence = [
    ...project.evidenceLocations,
    ...missingCriteria.flatMap((criterion) => criterion.evidence),
    registry.sourcePath,
  ].filter((item, index, values) => item.length > 0 && values.indexOf(item) === index);

  return {
    id: `commercial-readiness:${project.id}`,
    kind: "project",
    title: `Verify commercial readiness gaps for ${project.name}`,
    businessId: registry.businessId,
    projectId: project.id,
    objective: `Move ${project.name} toward demonstrable commercial readiness.`,
    expectedOutcome: "commercial-readiness",
    kpiId: project.relevantKpis[0] ?? "projects-nearing-commercial-readiness",
    evidence,
    taskType: "qa-verification",
    taskPayload: {
      target: project.repositories[0]?.path ?? project.id,
      suite: "business-readiness",
      mode: "dry-run",
      dryRun: true,
      constraints: {
        dryRun: true,
        businessReadiness: true,
        projectId: project.id,
      },
    },
    approval: "safe-autonomous",
    verification: {
      method: "worker",
      description:
        "QA verifier dry-run confirms the readiness review target and records follow-up evidence without production side effects.",
      expectedEvidence: ["qa-verification run", "task execution record"],
    },
    dependencies: project.repositories.length > 0 ? [] : ["project repository path unknown"],
    acceptanceCriteria: missingCriteria.map((criterion) => criterion.label),
    risk: "low: read-only readiness verification",
    effort: "low",
    opportunity: {
      type: "product",
      description: project.commercialOutcome,
    },
  };
}

function communityPresenceCandidate(registry: BusinessRegistry): CandidateWorkItem {
  const day = new Date().toISOString().slice(0, 10);
  return {
    id: `community-presence:daily-scan:${day}`,
    kind: "marketing",
    title: "Discover community participation opportunities",
    businessId: registry.businessId,
    businessFunction: "community-presence",
    objective:
      "Find relevant technical/community discussions where Tail Wagging expertise or completed work can help without posting publicly.",
    expectedOutcome: "community-value",
    kpiId: "community-value",
    evidence: [
      registry.sourcePath,
      "skills/business-value-operating-loop/SKILL.md",
      "artifacts/system/operator/business-value-candidate-pool-broadened-2026-07-14.md",
    ],
    taskType: "market-research",
    taskPayload: {
      target: "approved public communities",
      scope: "community-presence-opportunity-discovery",
      dryRun: true,
      sources: [...COMMUNITY_DISCOVERY_SOURCES],
      activeOwnedPlatforms: [...ACTIVE_COMMUNITY_PLATFORMS],
      constraints: {
        dryRun: true,
        publicReadOnly: true,
        draftOnly: true,
        noPosting: true,
        noReplies: true,
        noDirectMessages: true,
        noFollows: true,
        noReactions: true,
        approvalRequiredForPublicAction: true,
      },
    },
    approval: "safe-autonomous",
    verification: {
      method: "worker",
      description:
        "Market research identifies high-quality public discussions and prepares evidence-backed draft opportunities without public interaction.",
      expectedEvidence: [
        "source URLs or discussion identifiers",
        "relevance and business-value score",
        "draft-only participation recommendations",
        "approval boundary confirmation",
      ],
    },
    dependencies: [],
    acceptanceCriteria: [
      "Discovered discussions are relevant to current business goals or active projects.",
      "Active owned platforms are considered first: X, LinkedIn, Threads, Reddit, Facebook, and Instagram.",
      "Draft recommendations are useful and evidence-backed rather than promotional.",
      "All public interactions remain approval-gated.",
      "Outcomes can be measured through visibility, authority, engagement, or commercial signal.",
    ],
    risk: "low: public read-only research and internal drafting only",
    effort: "low",
    opportunity: {
      type: "community",
      description:
        "Build visibility, authority, and commercial reach through genuine helpful participation in relevant communities.",
    },
  };
}

function kpiForOutcome(outcome: BusinessOutcome): string {
  switch (outcome) {
    case "increased-revenue":
      return "revenue";
    case "customer-satisfaction":
      return "client-satisfaction";
    case "commercial-readiness":
      return "projects-nearing-commercial-readiness";
    default:
      return outcome;
  }
}

function strategicInitiativeCandidate(
  registry: BusinessRegistry,
  initiative: BusinessStrategicInitiative,
): CandidateWorkItem {
  const expectedOutcome = initiative.expectedOutcomes[0] ?? "commercial-readiness";
  const evidence = [registry.sourcePath, ...initiative.priorityProjects.map((id) => `project:${id}`)];
  return {
    id: `strategic-initiative:${initiative.id}`,
    kind: "operational-improvement",
    title: initiative.title,
    businessId: registry.businessId,
    businessFunction: initiative.businessFunction ?? "strategy",
    objective: initiative.nextSafeAction,
    expectedOutcome,
    kpiId: kpiForOutcome(expectedOutcome),
    evidence,
    taskType: "content-generate",
    taskPayload: {
      type: "operator_notice",
      style: "strategic-initiative-brief",
      length: "short",
      source: {
        name: initiative.title,
        title: initiative.title,
        description: initiative.nextSafeAction,
        operatorNote:
          "Prepare an internal evidence-backed execution brief only. Do not contact anyone, publish, deploy, install, access secrets, make legal claims, or make commercial commitments.",
        deliverables: initiative.deliverables,
        evidence,
        metadata: {
          topic: "business-strategic-initiative",
          initiativeId: initiative.id,
          status: initiative.status,
          serviceLineId: initiative.serviceLineId,
          expectedOutcomes: initiative.expectedOutcomes,
          approvalBoundaries: initiative.approvalBoundaries,
        },
      },
    },
    approval: "safe-autonomous",
    approvalReason:
      "Only an internal execution brief is produced; every listed external or binding action remains gated.",
    verification: {
      method: "worker",
      description:
        "The content worker produces a claim-safe internal brief tied to registry evidence and explicit approval boundaries.",
      expectedEvidence: ["content-generate run", "initiative brief", "approval boundary confirmation"],
    },
    dependencies: [],
    acceptanceCriteria: [
      ...initiative.deliverables.map((item) => `Brief covers ${item}.`),
      "Unknown facts remain explicit and are not invented.",
      "External and commercially binding actions remain approval-gated.",
    ],
    risk: "low: internal evidence-backed planning only",
    effort: "low",
    opportunity: {
      type: "operations",
      description: initiative.nextSafeAction,
    },
  };
}

function criticalCoverageGapCandidate(
  registry: BusinessRegistry,
  gap: BusinessCoverageGap,
): CandidateWorkItem {
  const evidence = [registry.sourcePath, `coverage-gap:${gap.id}`];
  return {
    id: `coverage-gap-plan:${gap.id}`,
    kind: "operational-improvement",
    title: `Prepare evidence plan for ${gap.area}`,
    businessId: registry.businessId,
    businessFunction: "business-intelligence",
    objective: gap.nextEvidenceNeeded,
    expectedOutcome: "operational-efficiency",
    kpiId: "operational-efficiency",
    evidence,
    taskType: "content-generate",
    taskPayload: {
      type: "operator_notice",
      style: "coverage-gap-evidence-plan",
      length: "short",
      source: {
        name: gap.area,
        title: `Evidence plan: ${gap.area}`,
        description: gap.nextEvidenceNeeded,
        operatorNote:
          "Prepare a local evidence-collection plan only. Do not access credentials, financial systems, client data, production providers, or private records without separate approval.",
        missingEvidence: gap.missing,
        evidence,
        metadata: {
          topic: "business-coverage-gap",
          gapId: gap.id,
          priority: gap.priority,
          coverageStatus: gap.coverageStatus,
        },
      },
    },
    approval: "safe-autonomous",
    approvalReason:
      "Planning is local and non-invasive; collecting private or credentialed evidence remains separately approval-gated.",
    verification: {
      method: "worker",
      description:
        "The content worker creates a bounded evidence plan that separates safe local sources from approval-gated sources.",
      expectedEvidence: ["content-generate run", "coverage-gap evidence plan", "source boundary classification"],
    },
    dependencies: [],
    acceptanceCriteria: [
      "Every missing evidence item is classified by source and authority boundary.",
      "The plan identifies the smallest safe next collection step.",
      "No unknown KPI, financial, client, legal, analytics, or production value is fabricated.",
    ],
    risk: "low: internal evidence planning only",
    effort: "low",
    opportunity: {
      type: "operations",
      description: gap.nextEvidenceNeeded,
    },
  };
}

function approvalPacketCandidate(
  registry: BusinessRegistry,
  record: BusinessPipelineRecord,
): CandidateWorkItem {
  const evidence = [registry.sourcePath, ...record.evidence].filter(
    (item, index, values) => item.length > 0 && values.indexOf(item) === index,
  );
  const packetTitle = `Prepare approval packet for ${record.title}`;
  const approvalAction =
    record.approvalAction ??
    "Ask John to approve the next external action after reviewing the evidence.";

  return {
    id: `approval-packet:${record.id}`,
    kind: "approval",
    title: packetTitle,
    businessId: registry.businessId,
    projectId: record.relatedProjectId ?? null,
    businessFunction: record.businessFunction ?? "sales",
    objective: `Turn ${record.title} into a complete approval packet while preserving every external-action gate.`,
    expectedOutcome: record.expectedOutcome,
    kpiId: record.kpiId,
    evidence,
    taskType: "content-generate",
    taskPayload: {
      type: "operator_notice",
      style: "approval-packet",
      length: "short",
      source: {
        name: packetTitle,
        title: packetTitle,
        description: record.nextAction,
        operatorNote:
          `${approvalAction} This task prepares the packet only; it must not send, publish, submit, commit, deploy, spend, or make commitments.`,
        draftSubject: record.draftSubject ?? null,
        draftBody: record.draftBody ?? null,
        evidence,
        metadata: {
          topic: "business-value-approval-packet",
          pipelineId: record.id,
          stage: record.stage,
          approvalStatus: record.approvalStatus,
          valueEstimate: record.valueEstimate,
          probability: record.probability,
          followUpAt: record.followUpAt,
        },
      },
    },
    approval: "safe-autonomous",
    approvalReason:
      "Internal packet preparation is safe; the described external action still needs John's explicit approval.",
    verification: {
      method: "worker",
      description:
        "The content worker prepares an evidence-grounded operator packet without taking the external action.",
      expectedEvidence: [
        "content-generate run",
        "approval packet draft",
        "full proposed draft body when available",
        "approval boundary confirmation",
      ],
    },
    dependencies: [],
    acceptanceCriteria: [
      "Packet states the requested approval clearly.",
      "Packet cites current pipeline evidence and stage.",
      "Packet includes the full proposed draft body when one exists.",
      "Packet preserves send, publish, commit, deploy, spend, and commitment gates.",
    ],
    risk: "low: local packet preparation only; external action remains gated",
    effort: "low",
    opportunity: {
      type:
        record.type === "content"
          ? "content"
          : record.type === "community"
            ? "marketing"
            : "lead",
      description: record.notes ?? `${record.stage}: ${record.nextAction}`,
    },
  };
}

async function discoverFounderRescueReadinessCandidate(
  registry: BusinessRegistry,
): Promise<CandidateWorkItem | null> {
  const workspaceRoot = resolve(dirname(registry.sourcePath), "..");
  const artifactPaths = [
    "artifacts/system/operator/vibe-coded-mvp-rescue-audit-offer-2026-07-13.md",
    "artifacts/system/operator/vibe-coded-mvp-rescue-first-three-verification-2026-07-13.md",
    "artifacts/system/operator/vibe-coded-mvp-rescue-contact-route-verification-2026-07-13.md",
    "artifacts/system/operator/vibe-coded-mvp-rescue-internal-outreach-drafts-2026-07-13.md",
  ];
  const existingArtifacts: string[] = [];

  for (const artifactPath of artifactPaths) {
    if (await pathExists(join(workspaceRoot, artifactPath))) {
      existingArtifacts.push(artifactPath);
    }
  }

  if (existingArtifacts.length < 2) {
    return null;
  }

  return {
    id: "revenue-loop:founder-vibe-coded-rescue-readiness",
    kind: "lead",
    title: "Verify founder/vibe-coded rescue outreach readiness",
    businessId: registry.businessId,
    businessFunction: "sales",
    objective:
      "Move the founder/vibe-coded project rescue lane toward approved, claim-safe outreach without sending or creating Gmail drafts.",
    expectedOutcome: "commercial-readiness",
    kpiId: "qualified-leads",
    evidence: [registry.sourcePath, ...existingArtifacts],
    taskType: "qa-verification",
    taskPayload: {
      target: "artifacts/system/operator/vibe-coded-mvp-rescue-internal-outreach-drafts-2026-07-13.md",
      suite: "business-readiness",
      mode: "dry-run",
      dryRun: true,
      constraints: {
        dryRun: true,
        businessReadiness: true,
        revenueLoop: true,
        approvalGatedExternalActions: true,
        lane: "founder-vibe-coded-project-rescue",
      },
    },
    approval: "safe-autonomous",
    verification: {
      method: "worker",
      description:
        "QA verifier reviews the internal founder-rescue outreach assets for claim safety and approval readiness without contacting leads.",
      expectedEvidence: ["qa-verification run", "claim-safety review", "approval boundary confirmation"],
    },
    dependencies: [],
    acceptanceCriteria: [
      "Founder-rescue offer and lead evidence remain claim-safe.",
      "Contact-route evidence is separated from permission to contact.",
      "Gmail draft creation and sending remain approval-gated.",
    ],
    risk: "low: local read-only artifact review; no external action",
    effort: "low",
    opportunity: {
      type: "lead",
      description:
        "Founder and vibe-coded project rescue opportunities broaden revenue work beyond Wagging Web Wins.",
    },
  };
}

export async function discoverBusinessCandidates(
  registry: BusinessRegistry,
  state: OrchestratorState,
): Promise<CandidateWorkItem[]> {
  const candidates: CandidateWorkItem[] = [];

  candidates.push(communityPresenceCandidate(registry));

  const founderRescueCandidate = await discoverFounderRescueReadinessCandidate(registry);
  if (founderRescueCandidate) {
    candidates.push(founderRescueCandidate);
  }

  for (const initiative of registry.initiatives) {
    if (!new Set(["complete", "completed", "closed"]).has(initiative.status)) {
      candidates.push(strategicInitiativeCandidate(registry, initiative));
    }
  }

  for (const gap of registry.coverageGaps) {
    if (gap.priority === "critical" && gap.coverageStatus !== "complete") {
      candidates.push(criticalCoverageGapCandidate(registry, gap));
    }
  }

  for (const project of registry.projects) {
    const missingCriteria = project.acceptanceCriteria.filter(
      (criterion) => criterion.status === "missing" || criterion.status === "unknown",
    );
    if (
      missingCriteria.length > 0 &&
      project.status !== "paused" &&
      project.status !== "commercially-ready"
    ) {
      candidates.push(projectReadinessCandidate(registry, project, missingCriteria));
    }

    if (project.knownRisks.length > 0) {
      candidates.push({
        id: `risk-review:${project.id}`,
        kind: "risk",
        title: `Review unresolved risk for ${project.name}`,
        businessId: registry.businessId,
        projectId: project.id,
        objective: `Reduce operational or customer-facing risk before ${project.name} is promoted.`,
        expectedOutcome: "risk-reduction",
        kpiId: "customer-facing-risks",
        evidence: [...project.knownRisks, ...project.evidenceLocations, registry.sourcePath],
        taskType: "system-monitor",
        taskPayload: {
          target: project.repositories[0]?.path ?? project.id,
          scope: "business-risk",
          dryRun: true,
        },
        approval: "safe-autonomous",
        verification: {
          method: "worker",
          description: "System monitor worker records risk posture and recommended safe follow-up.",
          expectedEvidence: ["system-monitor run", "risk findings"],
        },
        dependencies: [],
        acceptanceCriteria: ["Risk is classified with evidence and next safe action."],
        risk: "low: local risk review",
        effort: "low",
        opportunity: {
          type: "operations",
          description: project.knownRisks.join("; "),
        },
      });
    }
  }

  for (const record of registry.pipeline) {
    const needsPacket =
      record.approvalStatus === "needs-packet" ||
      record.stage === "packet_ready" ||
      record.stage === "draft_ready" ||
      record.stage === "reply_needs_draft" ||
      record.stage === "brief-ready" ||
      record.stage === "draft-ready" ||
      record.stage === "approval-needed";
    if (needsPacket) {
      candidates.push(approvalPacketCandidate(registry, record));
    }
  }

  const unregisteredRepos = await discoverUnregisteredProjectRepos(registry);
  if (unregisteredRepos.length > 0) {
    candidates.push({
      id: "registry:unregistered-project-repos",
      kind: "operational-improvement",
      title: "Register discovered workspace project repositories",
      businessId: registry.businessId,
      businessFunction: "operations",
      objective: "Keep project registry complete so business-value planning uses real workspace inventory.",
      expectedOutcome: "operational-efficiency",
      kpiId: "active-client-projects",
      evidence: [registry.sourcePath, ...unregisteredRepos],
      taskType: null,
      taskPayload: {},
      approval: "unsupported",
      approvalReason:
        "Registry mutation requires a bounded implementation task because planner discovery must not rewrite project facts automatically.",
      verification: {
        method: "unsupported",
        description: "Requires registry update and review.",
        expectedEvidence: ["updated registry", "project evidence paths"],
      },
      dependencies: unregisteredRepos,
      acceptanceCriteria: ["Every active project repo is represented or explicitly excluded."],
      risk: "medium: registry source-of-truth change",
      effort: "medium",
      opportunity: {
        type: "operations",
        description: "Improve planner inventory coverage.",
      },
    });
  }

  const recentFailures = state.taskExecutions
    .filter((execution) => execution.status === "failed" || execution.status === "retrying")
    .slice(-5);
  if (recentFailures.length > 0) {
    candidates.push({
      id: "runtime:recent-task-failures",
      kind: "risk",
      title: "Verify recent failed or retrying task executions",
      businessId: registry.businessId,
      businessFunction: "operations",
      objective: "Reduce delivery and automation risk caused by failed runtime work.",
      expectedOutcome: "risk-reduction",
      kpiId: "verification-failures",
      evidence: recentFailures.map((execution) => `${execution.type}:${execution.idempotencyKey}`),
      taskType: "qa-verification",
      taskPayload: {
        target: "orchestrator-runtime",
        suite: "recent-failure-review",
        mode: "dry-run",
        dryRun: true,
        runIds: recentFailures.map((execution) => execution.idempotencyKey),
      },
      approval: "safe-autonomous",
      verification: {
        method: "worker",
        description: "QA verifier reviews failed runtime tasks without mutating production state.",
        expectedEvidence: ["qa-verification run", "failure review"],
      },
      dependencies: [],
      acceptanceCriteria: ["Recent failure pattern is classified with next safe action."],
      risk: "low: read-only failure review",
      effort: "low",
      opportunity: {
        type: "operations",
        description: "Improve runtime reliability.",
      },
    });
  }

  for (const approval of state.approvals.filter((item) => item.status === "pending").slice(-10)) {
    candidates.push({
      id: `approval:${approval.taskId}`,
      kind: "approval",
      title: `Approval required for ${approval.type}`,
      businessId: registry.businessId,
      businessFunction: "governance",
      objective: "Preserve approval-gated work without blocking unrelated safe work.",
      expectedOutcome: "risk-reduction",
      kpiId: "approval-gated-actions",
      evidence: [approval.taskId, approval.type, approval.requestedAt],
      taskType: null,
      taskPayload: approval.payload,
      approval: "approval-required",
      approvalReason: "Existing approval gate is waiting for an operator decision.",
      verification: {
        method: "manual-approval",
        description: "Operator approval or rejection is required.",
        expectedEvidence: ["approval decision"],
      },
      dependencies: [approval.taskId],
      acceptanceCriteria: ["Approval is decided or remains preserved without blocking safe work."],
      risk: "high: approval boundary",
      effort: "low",
    });
  }

  return candidates;
}
