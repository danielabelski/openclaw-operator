import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSpecialistOperatorFields,
  buildIncidentPriorityQueue,
  loadRuntimeState,
  type RuntimeStateSubset,
} from "../../shared/runtime-evidence.js";

interface AgentConfig {
  id: string;
  name: string;
  orchestratorStatePath: string;
  permissions: {
    skills?: Record<string, { allowed?: boolean }>;
  };
}

interface SecurityTask {
  id: string;
  type: "scan" | "compliance" | "incident" | "secrets";
  scope: string;
}

interface SecurityFinding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cwe?: string;
  cvss?: number;
  exploitability?: "high" | "medium" | "low";
  exploitabilityScore?: number;
  blastRadius?: "fleet" | "service" | "surface" | "repo";
  blastRadiusScore?: number;
  historyStatus?: "new" | "recurring" | "persisting";
  trustBoundary?: "auth" | "cors" | "permission" | "secret" | "service-runtime" | "proof-delivery" | "general";
  historyEvidence?: string[];
  description: string;
  location: string;
  remediation: string;
  containment?: string;
  rollbackConcern?: string;
}

interface SecurityRelationshipOutput {
  from: string;
  to: string;
  relationship: "audits-agent" | "feeds-agent";
  detail: string;
  evidence: string[];
  classification?: "audit" | "remediation-guidance";
}

interface SecurityToolInvocationOutput {
  toolId: string;
  detail: string;
  evidence: string[];
  classification: "required" | "optional";
}

interface SecurityResult {
  success: boolean;
  findings: SecurityFinding[];
  boundedFixes: Array<{
    title: string;
    target: string;
    risk: "low" | "medium" | "high";
    rollbackConcern: string;
    containment: string;
    trustBoundary: NonNullable<SecurityFinding["trustBoundary"]>;
  }>;
  riskMatrix: {
    exploitableCount: number;
    fleetWideCount: number;
    serviceScopedCount: number;
  };
  summary: {
    total: number;
    critical: number;
    exploitable: boolean;
    compliance: string;
  };
  auditedAgents: string[];
  relationships: SecurityRelationshipOutput[];
  toolInvocations: SecurityToolInvocationOutput[];
  operationalMaturity: {
    trustBoundaryCoverage: "minimal" | "partial" | "strong";
    auditedAgentCount: number;
    openIncidentCount: number;
    blockerCount: number;
    summary: string;
  };
  remediationPriorities: Array<{
    incidentId: string;
    severity: string;
    owner: string | null;
    recommendedOwner: string | null;
    nextAction: string;
  }>;
  trustBoundaryHistory: Array<{
    incidentId: string;
    severity: string;
    status: "new" | "recurring" | "persisting";
    owner: string | null;
    summary: string;
    lastSeenAt: string | null;
  }>;
  permissionDriftTimeline: Array<{
    timestamp: string;
    summary: string;
    status: string;
    evidence: string[];
  }>;
  routeBoundaryWatch: {
    unprotectedRouteCount: number;
    authFindingCount: number;
    recurringAuthIncidents: number;
    status: "nominal" | "watching" | "critical";
  };
  regressionReview: {
    status: "clear" | "watching" | "regressing";
    permissionDriftCount: number;
    recurringBoundaryCount: number;
    rollbackReadyFixCount: number;
  };
  remediationDepth: {
    status: "ready" | "watching" | "rollback-sensitive" | "owner-gap";
    ownerlessPriorityCount: number;
    rollbackSensitiveFixCount: number;
    trustBoundaryFixCount: number;
    criticalPriorityCount: number;
  };
  exploitabilityRanking: Array<{
    findingId: string;
    location: string;
    trustBoundary: NonNullable<SecurityFinding["trustBoundary"]>;
    severity: SecurityFinding["severity"];
    combinedScore: number;
    historyStatus: SecurityFinding["historyStatus"];
    containment: string;
  }>;
  remediationClosure: {
    status: "ready" | "verification-required" | "blocked";
    highRiskCount: number;
    ownerlessPriorityCount: number;
    verifierRecommended: boolean;
    closureBlockers: string[];
  };
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
  evidence: string[];
  executionTime: number;
}

interface RuntimeState extends RuntimeStateSubset {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = resolve(__dirname, "../agent.config.json");
const workspaceRoot = resolve(__dirname, "../../..");

function loadConfig(): AgentConfig {
  return JSON.parse(readFileSync(configPath, "utf-8")) as AgentConfig;
}

function canUseSkill(skillId: string): boolean {
  const config = loadConfig();
  return config.permissions.skills?.[skillId]?.allowed === true;
}

async function pathTextIfExists(targetPath: string) {
  try {
    return await readFile(targetPath, "utf-8");
  } catch {
    return null;
  }
}

function redactFindingId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("change_me") ||
    normalized.includes("example") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-") ||
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("orchestrator-dev") ||
    normalized.includes("development") ||
    normalized.includes("admin") ||
    normalized.includes("${") ||
    normalized.includes("test-") ||
    normalized.includes("sample")
  );
}

function isSensitiveExampleKey(key: string) {
  const normalized = key.trim().toUpperCase();
  if (!normalized) return false;

  if (
    normalized.includes("SECRET") ||
    normalized.includes("TOKEN") ||
    normalized.includes("PASSWORD") ||
    normalized.endsWith("_KEY") ||
    normalized === "API_KEY" ||
    normalized === "WEBHOOK_SECRET" ||
    normalized === "DATABASE_URL" ||
    normalized === "REDIS_URL" ||
    normalized === "SENDGRID_API_KEY" ||
    normalized === "SLACK_WEBHOOK_URL"
  ) {
    return true;
  }

  return false;
}

function parseEnvLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function scanTrackedFilesForSecrets(): Promise<SecurityFinding[]> {
  const candidateRoots = [
    "README.md",
    "docs",
    "orchestrator/src",
    "systemd",
  ];
  const findings: SecurityFinding[] = [];
  const tokenPatterns: Array<{ pattern: RegExp; description: string }> = [
    {
      pattern: /Bearer\s+[A-Za-z0-9\-_]{24,}/,
      description: "bearer token-like literal",
    },
    {
      pattern: /cloudflared\s+tunnel\s+run\s+--token\s+[A-Za-z0-9._-]{20,}/,
      description: "cloudflared tunnel token literal",
    },
    {
      pattern: /\bsk-[A-Za-z0-9]{20,}\b/,
      description: "OpenAI-style API key literal",
    },
  ];

  async function walk(target: string): Promise<void> {
    const absolutePath = resolve(workspaceRoot, target);
    let entries;
    try {
      entries = await readdir(absolutePath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".git")) continue;
      const child = resolve(absolutePath, entry.name);
      const relativePath = relative(workspaceRoot, child);
      if (entry.isDirectory()) {
        await walk(relativePath);
        continue;
      }
      if (!/\.(md|ts|tsx|js|cjs|mjs|json|service|sh|txt|yml|yaml)$/i.test(entry.name)) {
        continue;
      }
      const raw = await pathTextIfExists(child);
      if (!raw) continue;
      for (const { pattern, description } of tokenPatterns) {
        if (pattern.test(raw)) {
          findings.push({
            id: redactFindingId("tracked-secret"),
            severity: "CRITICAL",
            exploitability: "high",
            blastRadius: "fleet",
            description: `Tracked ${description} detected in repository content.`,
            location: relativePath,
            remediation: "Remove the literal from tracked content and rotate the secret.",
            rollbackConcern: "Rotation and rollout must be coordinated so dependent services do not lose access.",
          });
          break;
        }
      }
    }
  }

  for (const root of candidateRoots) {
    const absoluteRoot = resolve(workspaceRoot, root);
    const raw = await pathTextIfExists(absoluteRoot);
    if (raw !== null) {
      for (const { pattern, description } of tokenPatterns) {
        if (pattern.test(raw)) {
          findings.push({
            id: redactFindingId("tracked-secret"),
            severity: "CRITICAL",
            exploitability: "high",
            blastRadius: "fleet",
            description: `Tracked ${description} detected in repository content.`,
            location: root,
            remediation: "Remove the literal from tracked content and rotate the secret.",
            rollbackConcern: "Rotation and rollout must be coordinated so dependent services do not lose access.",
          });
          break;
        }
      }
      continue;
    }
    await walk(root);
  }

  return findings;
}

async function scanRouteAndAuthBoundaries(): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const authMiddlewarePath = resolve(workspaceRoot, "orchestrator/src/middleware/auth.ts");
  const authMiddlewareRaw = await pathTextIfExists(authMiddlewarePath);
  const indexPath = resolve(workspaceRoot, "orchestrator/src/index.ts");
  const indexRaw = await pathTextIfExists(indexPath);

  if (authMiddlewareRaw) {
    const looksLikeAuthBoundary =
      /requireBearerToken|verifyWebhookSignature|authorization|x-webhook-signature/i.test(
        authMiddlewareRaw,
      );
    const usesConstantTimeCompare = /timingSafeEqual|safeEqualString/.test(authMiddlewareRaw);

    if (looksLikeAuthBoundary && !usesConstantTimeCompare) {
      findings.push({
        id: redactFindingId("auth-boundary"),
        severity: "HIGH",
        exploitability: "medium",
        blastRadius: "surface",
        description:
          "Auth boundary contract appears to compare credentials or signatures without constant-time protection.",
        location: "orchestrator/src/middleware/auth.ts",
        remediation:
          "Move secret, API key, and webhook signature comparisons onto a constant-time comparison path before exposing the route boundary.",
        containment:
          "Contain the affected route boundary by pausing public exposure or narrowing the caller set until the constant-time path is restored.",
        rollbackConcern:
          "Changing auth comparison logic can invalidate existing integration assumptions if callers depend on malformed inputs being tolerated.",
      });
    }
  }

  if (indexRaw) {
    const publicPaths = new Set([
      "/health",
      "/api/knowledge/summary",
      "/api/openapi.json",
      "/api/persistence/health",
      "/api/command-center/overview",
      "/api/command-center/control",
      "/api/command-center/demand",
      "/api/command-center/demand-live",
      "/api/milestones/latest",
      "/api/milestones/dead-letter",
      "/webhook/alerts",
    ]);
    const routeLines = indexRaw.split(/\r?\n/);
    const unprotectedRoutes = routeLines.flatMap((line, index) => {
      const match = line.match(/app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]\s*,(.*)/);
      if (!match) return [];
      const routePath = match[2];
      if (!routePath.startsWith("/api/") || publicPaths.has(routePath)) return [];
      if (/requireBearerToken|authLimiter|apiLimiter|requireRole/.test(line)) return [];
      return [`${routePath}@L${index + 1}`];
    });

    if (unprotectedRoutes.length > 0) {
      findings.push({
        id: redactFindingId("route-protection"),
        severity: "HIGH",
        exploitability: "medium",
        blastRadius: "surface",
        description:
          "Protected API route declarations appear to bypass the expected bearer-token or role middleware chain.",
        location: "orchestrator/src/index.ts",
        remediation:
          "Attach the expected auth and role middleware to protected API routes before treating the route boundary as trusted.",
        containment:
          "Contain the affected route boundary by removing public exposure or narrowing ingress until middleware enforcement is restored.",
        rollbackConcern:
          "Hardening route middleware can break callers that were relying on the current unguarded behavior.",
      });
    }
  }

  return findings;
}

async function buildFindings(task: SecurityTask, state: RuntimeState): Promise<{
  findings: SecurityFinding[];
  auditedAgents: string[];
  evidence: string[];
}> {
  const findings: SecurityFinding[] = [];
  const evidence: string[] = [];

  const envExamplePath = resolve(workspaceRoot, "orchestrator/.env.example");
  const envExampleRaw = await pathTextIfExists(envExamplePath);
  if (envExampleRaw) {
    const envLines = parseEnvLines(envExampleRaw);
    const seenSensitiveKeys = new Set<string>();
    for (const line of envLines) {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = line.slice(0, separatorIndex);
      const normalizedKey = key.trim().toUpperCase();
      const value = line.slice(separatorIndex + 1);
      if (
        !isSensitiveExampleKey(normalizedKey) ||
        !value ||
        isPlaceholderValue(value) ||
        seenSensitiveKeys.has(normalizedKey)
      ) {
        continue;
      }
      seenSensitiveKeys.add(normalizedKey);
      findings.push({
        id: redactFindingId(`env-example-${normalizedKey.toLowerCase()}`),
        severity: "HIGH",
        exploitability: "medium",
        blastRadius: "fleet",
        description: `${normalizedKey} in orchestrator/.env.example is not a placeholder value.`,
        location: "orchestrator/.env.example",
        remediation:
          "Replace the committed example value with a placeholder and rotate the real credential if it was ever used.",
        rollbackConcern: "Example/env consumers may depend on the current placeholder contract.",
      });
    }
    evidence.push(`env-example-lines:${envLines.length}`);
  }

  const orchestratorConfigRaw = await pathTextIfExists(
    resolve(workspaceRoot, "orchestrator_config.json"),
  );
  if (orchestratorConfigRaw) {
    try {
      const orchestratorConfig = JSON.parse(orchestratorConfigRaw) as {
        corsAllowedOrigins?: string[];
      };
      if (
        Array.isArray(orchestratorConfig.corsAllowedOrigins) &&
        orchestratorConfig.corsAllowedOrigins.includes("*")
      ) {
        findings.push({
          id: redactFindingId("cors"),
          severity: orchestratorConfig.corsAllowCredentials === true ? "CRITICAL" : "HIGH",
          exploitability: orchestratorConfig.corsAllowCredentials === true ? "high" : "medium",
          blastRadius: "surface",
          description:
            orchestratorConfig.corsAllowCredentials === true
              ? "Credentialed wildcard CORS origin detected in orchestrator_config.json."
              : "Wildcard CORS origin detected in orchestrator_config.json.",
          location: "orchestrator_config.json",
          remediation:
            orchestratorConfig.corsAllowCredentials === true
              ? "Replace wildcard origins with an explicit allowlist and disable credentialed browser access until trusted origins are enumerated."
              : "Replace wildcard origins with an explicit allowlist.",
          containment:
            orchestratorConfig.corsAllowCredentials === true
              ? "Contain browser access to trusted operator origins before re-enabling credentialed requests."
              : "Contain browser access to the intended operator origins before widening the allowlist again.",
          rollbackConcern: "A hard cutover to explicit origins can break previously tolerated browser clients.",
        });
      }
    } catch {
      findings.push({
        id: redactFindingId("config-parse"),
        severity: "LOW",
        exploitability: "low",
        blastRadius: "repo",
        description: "Unable to parse orchestrator_config.json during security audit.",
        location: "orchestrator_config.json",
        remediation: "Repair JSON syntax so runtime policy can be audited deterministically.",
        rollbackConcern: "None; this is a deterministic repo repair.",
      });
    }
  }

  findings.push(...(await scanRouteAndAuthBoundaries()));

  findings.push(...(await scanTrackedFilesForSecrets()));

  const auditedAgents = Array.from(
    new Set(
      (state.relationshipObservations ?? [])
        .map((entry) => entry.to)
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => entry.startsWith("agent:"))
        .map((entry) => entry.slice("agent:".length)),
    ),
  );

  if (task.type === "incident") {
    const openIncidents = (state.incidentLedger ?? []).filter(
      (incident) => incident.status !== "resolved",
    );
    if (openIncidents.some((incident) => incident.classification === "service-runtime")) {
      findings.push({
        id: redactFindingId("service-runtime"),
        severity: "MEDIUM",
        exploitability: "low",
        blastRadius: "service",
        description: "Open service-runtime incident(s) indicate degraded trust boundaries or missing host service coverage.",
        location: "orchestrator_state.json",
        remediation: "Restore the affected service runtime and verify the related incident resolves.",
        rollbackConcern: "Restarting or replacing service units can interrupt in-flight work.",
      });
    }
    evidence.push(`open-incidents:${openIncidents.length}`);
  }

  if ((state.taskExecutions ?? []).some((entry) => entry.type === "security-audit")) {
    evidence.push(
      `tracked-security-runs:${
        (state.taskExecutions ?? []).filter((entry) => entry.type === "security-audit").length
      }`,
    );
  }

  return { findings, auditedAgents, evidence };
}

function buildTrustBoundaryHistory(state: RuntimeState) {
  return (state.incidentLedger ?? [])
    .filter((incident) => {
      if (
        incident.classification === "service-runtime" ||
        incident.classification === "proof-delivery" ||
        incident.classification === "persistence"
      ) {
        return true;
      }
      const searchable = [
        incident.summary ?? "",
        ...(incident.evidence ?? []),
        ...(incident.affectedSurfaces ?? []),
      ].join(" ").toLowerCase();
      return ["permission", "cors", "origin", "auth", "secret"].some((token) =>
        searchable.includes(token),
      );
    })
    .sort((left, right) => (asDate(right.lastSeenAt) ?? 0) - (asDate(left.lastSeenAt) ?? 0))
    .slice(0, 8)
    .map((incident) => {
      const ageMs =
        (asDate(incident.lastSeenAt) ?? Date.now()) -
        (asDate(incident.firstSeenAt) ?? Date.now());
      const historyLength = Array.isArray(incident.history) ? incident.history.length : 0;
      const status =
        ageMs > 24 * 60 * 60 * 1000 || historyLength >= 4
          ? "persisting"
          : historyLength >= 2
            ? "recurring"
            : "new";

      return {
        incidentId: incident.incidentId,
        severity: incident.severity,
        status,
        owner: typeof incident.owner === "string" ? incident.owner : null,
        summary: incident.summary,
        lastSeenAt: incident.lastSeenAt ?? null,
      };
    });
}

function buildPermissionDriftTimeline(state: RuntimeState) {
  return (state.incidentLedger ?? [])
    .flatMap((incident) => {
      const searchable = [
        incident.summary ?? "",
        ...(incident.evidence ?? []),
        ...(incident.affectedSurfaces ?? []),
      ].join(" ").toLowerCase();
      if (
        !["permission", "cors", "origin", "auth", "secret"].some((token) =>
          searchable.includes(token),
        )
      ) {
        return [];
      }
      return (incident.history ?? []).map((event) => ({
        timestamp: event.timestamp,
        summary: `${incident.incidentId}: ${event.summary}`,
        status: incident.status,
        evidence: event.evidence.slice(0, 6),
      }));
    })
    .sort((left, right) => (asDate(right.timestamp) ?? 0) - (asDate(left.timestamp) ?? 0))
    .slice(0, 12);
}

function classifyTrustBoundary(finding: Pick<SecurityFinding, "description" | "location">) {
  const searchable = `${finding.description} ${finding.location}`.toLowerCase();
  if (searchable.includes("cors") || searchable.includes("origin")) return "cors" as const;
  if (
    searchable.includes("auth") ||
    searchable.includes("authorization") ||
    searchable.includes("bearer-token") ||
    searchable.includes("middleware chain") ||
    searchable.includes("signing") ||
    searchable.includes("webhook")
  ) {
    return "auth" as const;
  }
  if (searchable.includes("secret") || searchable.includes("token") || searchable.includes("password")) {
    return "secret" as const;
  }
  if (searchable.includes("permission")) return "permission" as const;
  if (searchable.includes("service-runtime")) return "service-runtime" as const;
  if (searchable.includes("proof")) return "proof-delivery" as const;
  return "general" as const;
}

function buildRouteBoundaryWatch(args: {
  findings: SecurityFinding[];
  trustBoundaryHistory: ReturnType<typeof buildTrustBoundaryHistory>;
}) {
  const authFindings = args.findings.filter(
    (finding) => classifyTrustBoundary(finding) === "auth",
  );
  const unprotectedRouteCount = authFindings.filter((finding) => finding.location.includes("orchestrator/src/index.ts")).length;
  const recurringAuthIncidents = args.trustBoundaryHistory.filter(
    (entry) => entry.status !== "new" && /auth|cors|origin|signature|webhook/i.test(entry.summary),
  ).length;
  let status: SecurityResult["routeBoundaryWatch"]["status"] = "nominal";
  if (authFindings.length > 0 || recurringAuthIncidents > 0) status = "watching";
  if (unprotectedRouteCount > 0 || recurringAuthIncidents > 1) status = "critical";
  return {
    unprotectedRouteCount,
    authFindingCount: authFindings.length,
    recurringAuthIncidents,
    status,
  };
}

function buildRemediationDepth(args: {
  remediationPriorities: SecurityResult["remediationPriorities"];
  boundedFixes: SecurityResult["boundedFixes"];
}) {
  const ownerlessPriorityCount = args.remediationPriorities.filter(
    (entry) => entry.owner === null && entry.recommendedOwner === null,
  ).length;
  const criticalPriorityCount = args.remediationPriorities.filter(
    (entry) => entry.severity === "critical",
  ).length;
  const rollbackSensitiveFixCount = args.boundedFixes.filter((entry) =>
    /review|rotate|redeploy|service|boundary/i.test(entry.rollbackConcern),
  ).length;
  const trustBoundaryFixCount = args.boundedFixes.filter(
    (entry) => entry.trustBoundary !== "general",
  ).length;
  let status: SecurityResult["remediationDepth"]["status"] = "ready";
  if (trustBoundaryFixCount > 0) status = "watching";
  if (rollbackSensitiveFixCount > 2 || criticalPriorityCount > 0) status = "rollback-sensitive";
  if (ownerlessPriorityCount > 0) status = "owner-gap";
  return {
    status,
    ownerlessPriorityCount,
    rollbackSensitiveFixCount,
    trustBoundaryFixCount,
    criticalPriorityCount,
  };
}

function buildRegressionReview(args: {
  trustBoundaryHistory: SecurityResult["trustBoundaryHistory"];
  permissionDriftTimeline: SecurityResult["permissionDriftTimeline"];
  boundedFixes: SecurityResult["boundedFixes"];
}) {
  const permissionDriftCount = args.permissionDriftTimeline.length;
  const recurringBoundaryCount = args.trustBoundaryHistory.filter(
    (entry) => entry.status === "recurring" || entry.status === "persisting",
  ).length;
  const rollbackReadyFixCount = args.boundedFixes.filter(
    (entry) => entry.risk !== "high" && entry.trustBoundary !== "general",
  ).length;
  let status: SecurityResult["regressionReview"]["status"] = "clear";
  if (permissionDriftCount > 0 || recurringBoundaryCount > 0) {
    status = "watching";
  }
  if (permissionDriftCount > 2 || recurringBoundaryCount > 1) {
    status = "regressing";
  }
  return {
    status,
    permissionDriftCount,
    recurringBoundaryCount,
    rollbackReadyFixCount,
  };
}

function buildExploitabilityRanking(args: {
  findings: SecurityFinding[];
}) {
  return [...args.findings]
    .sort((left, right) => {
      const leftScore =
        scoreExploitability(left.exploitability) +
        scoreBlastRadius(left.blastRadius) +
        (left.severity === "CRITICAL" ? 25 : left.severity === "HIGH" ? 15 : 0);
      const rightScore =
        scoreExploitability(right.exploitability) +
        scoreBlastRadius(right.blastRadius) +
        (right.severity === "CRITICAL" ? 25 : right.severity === "HIGH" ? 15 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 8)
    .map((finding) => ({
      findingId: finding.id,
      location: finding.location,
      trustBoundary: finding.trustBoundary ?? "general",
      severity: finding.severity,
      combinedScore:
        scoreExploitability(finding.exploitability) +
        scoreBlastRadius(finding.blastRadius) +
        (finding.severity === "CRITICAL" ? 25 : finding.severity === "HIGH" ? 15 : 0),
      historyStatus: finding.historyStatus ?? "new",
      containment:
        finding.containment ??
        "Contain the affected trust boundary before broader rollout.",
    }));
}

function buildRemediationClosure(args: {
  boundedFixes: SecurityResult["boundedFixes"];
  remediationPriorities: SecurityResult["remediationPriorities"];
  remediationDepth: SecurityResult["remediationDepth"];
}) {
  const highRiskCount = args.boundedFixes.filter((entry) => entry.risk === "high").length;
  const ownerlessPriorityCount = args.remediationDepth.ownerlessPriorityCount;
  const closureBlockers = [
    ...(highRiskCount > 0 ? [`${highRiskCount} high-risk fix(es) still require verifier-backed confirmation`] : []),
    ...(ownerlessPriorityCount > 0 ? [`${ownerlessPriorityCount} remediation priority item(s) still lack an owner`] : []),
    ...(args.remediationPriorities.some((entry) => entry.severity === "critical")
      ? ["Critical remediation priorities remain open."]
      : []),
  ];

  return {
    status:
      closureBlockers.length > 0
        ? ownerlessPriorityCount > 0
          ? "blocked" as const
          : "verification-required" as const
        : "ready" as const,
    highRiskCount,
    ownerlessPriorityCount,
    verifierRecommended: highRiskCount > 0 || args.remediationPriorities.length > 0,
    closureBlockers,
  };
}

function buildSecuritySpecialistFields(args: {
  findings: SecurityFinding[];
  remediationPriorities: SecurityResult["remediationPriorities"];
  regressionReview: SecurityResult["regressionReview"];
  remediationClosure: SecurityResult["remediationClosure"];
  routeBoundaryWatch: SecurityResult["routeBoundaryWatch"];
}) {
  const criticalFindings = args.findings.filter((finding) => finding.severity === "CRITICAL").length;
  const highFindings = args.findings.filter((finding) => finding.severity === "HIGH").length;
  const status =
    criticalFindings > 0 || args.remediationClosure.status === "blocked"
      ? "escalate"
      : args.findings.length > 0 ||
          args.remediationClosure.status === "verification-required" ||
          args.regressionReview.status === "regressing" ||
          args.routeBoundaryWatch.status !== "nominal"
        ? "watching"
        : "completed";

  return buildSpecialistOperatorFields({
    role: "Security Engineer",
    workflowStage:
      status === "completed"
        ? "security-closure"
        : status === "watching"
          ? "trust-boundary-review"
          : "security-escalation",
    deliverable:
      "evidence-backed trust-boundary findings with containment, rollback context, and remediation priorities",
    status,
    operatorSummary:
      status === "completed"
        ? "Security audit found no immediate high-risk blockers and the current trust-boundary posture can stay on normal watch."
        : `Security audit found ${criticalFindings} critical and ${highFindings} high-risk finding(s) with remediation closure status ${args.remediationClosure.status}.`,
    recommendedNextActions: [
      ...args.remediationPriorities.slice(0, 3).map((entry) => entry.nextAction),
      ...args.remediationClosure.closureBlockers.slice(0, 2),
      args.routeBoundaryWatch.status !== "nominal"
        ? "Review the auth and route-boundary watch findings before widening execution."
        : null,
    ],
    escalationReason:
      criticalFindings > 0 || args.remediationClosure.status === "blocked"
        ? "Escalate because critical trust-boundary findings or blocked remediation closure still leave the runtime exposed."
        : null,
  });
}

function scoreExploitability(exploitability: SecurityFinding["exploitability"]) {
  return exploitability === "high" ? 100 : exploitability === "medium" ? 65 : 30;
}

function scoreBlastRadius(blastRadius: SecurityFinding["blastRadius"]) {
  return blastRadius === "fleet"
    ? 100
    : blastRadius === "service"
      ? 75
      : blastRadius === "surface"
        ? 55
        : 25;
}

async function handleTask(task: SecurityTask): Promise<SecurityResult> {
  const startTime = Date.now();

  try {
    if (!canUseSkill("documentParser")) {
      const specialistFields = buildSpecialistOperatorFields({
        role: "Security Engineer",
        workflowStage: "audit-refusal",
        deliverable:
          "evidence-backed trust-boundary findings with containment, rollback context, and remediation priorities",
        status: "refused",
        operatorSummary:
          "Security audit was refused because the governed documentParser path is unavailable to this agent.",
        recommendedNextActions: [
          "Restore documentParser access for security-agent before retrying the audit.",
          "Do not treat the trust boundary as reviewed until a bounded audit succeeds.",
        ],
        refusalReason:
          "Refused security audit because documentParser skill access is not allowed for security-agent.",
      });
      return {
        success: false,
        findings: [],
        boundedFixes: [],
        riskMatrix: {
          exploitableCount: 0,
          fleetWideCount: 0,
          serviceScopedCount: 0,
        },
        summary: { total: 0, critical: 0, exploitable: false, compliance: "UNKNOWN" },
        auditedAgents: [],
        relationships: [],
        toolInvocations: [],
        remediationPriorities: [],
        operationalMaturity: {
          trustBoundaryCoverage: "minimal",
          auditedAgentCount: 0,
          openIncidentCount: 0,
          blockerCount: 1,
          summary: "Security agent cannot audit runtime trust boundaries without documentParser skill access.",
        },
        evidence: [],
        routeBoundaryWatch: {
          unprotectedRouteCount: 0,
          authFindingCount: 0,
          recurringAuthIncidents: 0,
          status: "nominal",
        },
        ...specialistFields,
        executionTime: Date.now() - startTime,
      };
    }

    const config = loadConfig();
    const state = await loadRuntimeState<RuntimeState>(
      configPath,
      config.orchestratorStatePath,
    );
    const { findings, auditedAgents, evidence } = await buildFindings(task, state);
    const trustBoundaryHistory = buildTrustBoundaryHistory(state);
    const permissionDriftTimeline = buildPermissionDriftTimeline(state);
    const enrichedFindings = findings.map((finding) => ({
      ...finding,
      exploitabilityScore: scoreExploitability(finding.exploitability),
      blastRadiusScore: scoreBlastRadius(finding.blastRadius),
      trustBoundary: classifyTrustBoundary(finding),
      historyStatus:
        trustBoundaryHistory.find((entry) => {
          const searchable = `${entry.summary} ${entry.incidentId}`.toLowerCase();
          const trustBoundary = classifyTrustBoundary(finding);
          return (
            searchable.includes(finding.location.toLowerCase()) ||
            searchable.includes(trustBoundary.replace("-", " "))
          );
        })?.status ?? "new",
      historyEvidence: permissionDriftTimeline
        .filter((entry) => {
          const searchable = `${entry.summary} ${entry.evidence.join(" ")}`.toLowerCase();
          return searchable.includes(finding.location.toLowerCase()) ||
            searchable.includes(classifyTrustBoundary(finding).replace("-", " "));
        })
        .slice(0, 4)
        .map((entry) => `${entry.timestamp}:${entry.summary}`),
      containment:
        finding.blastRadius === "fleet"
          ? "Contain at the fleet boundary before rotating or redeploying dependent services."
          : finding.blastRadius === "service"
            ? "Contain within the affected service boundary before broader rollout."
            : "Contain within the affected surface or repo path before reopening execution lanes.",
    }));
    const remediationPriorities = buildIncidentPriorityQueue(state.incidentLedger ?? [])
      .filter((incident) =>
        incident.classification === "service-runtime" ||
        incident.classification === "proof-delivery" ||
        incident.severity === "critical",
      )
      .slice(0, 6)
      .map((incident) => ({
        incidentId: incident.incidentId,
        severity: incident.severity,
        owner: incident.owner,
        recommendedOwner: incident.recommendedOwner,
        nextAction: incident.nextAction,
      }));
    const routeBoundaryWatch = buildRouteBoundaryWatch({
      findings: enrichedFindings,
      trustBoundaryHistory,
    });
    const boundedFixes: SecurityResult["boundedFixes"] = enrichedFindings.slice(0, 8).map((finding) => ({
      title: finding.description,
      target: finding.location,
      risk:
        finding.severity === "CRITICAL" || finding.severity === "HIGH"
          ? "high"
          : finding.severity === "MEDIUM"
            ? "medium"
            : "low",
      containment:
        finding.containment ??
        "Contain the affected boundary before broad rollout or remediation replay.",
      trustBoundary: finding.trustBoundary ?? "general",
      rollbackConcern:
        finding.rollbackConcern ??
        "Review the affected service or config boundary before cutover.",
    }));
    const remediationDepth = buildRemediationDepth({
      remediationPriorities,
      boundedFixes,
    });
    const regressionReview = buildRegressionReview({
      trustBoundaryHistory,
      permissionDriftTimeline,
      boundedFixes,
    });
    const exploitabilityRanking = buildExploitabilityRanking({
      findings: enrichedFindings,
    });
    const remediationClosure = buildRemediationClosure({
      boundedFixes,
      remediationPriorities,
      remediationDepth,
    });
    const specialistFields = buildSecuritySpecialistFields({
      findings: enrichedFindings,
      remediationPriorities,
      regressionReview,
      remediationClosure,
      routeBoundaryWatch,
    });
    const relationships: SecurityRelationshipOutput[] = Array.from(
      new Set(auditedAgents),
    ).map((agentId) => ({
      from: "agent:security-agent",
      to: `agent:${agentId}`,
      relationship: "audits-agent",
      detail: `security-agent audited ${agentId} against repo policy, credential, and runtime trust-boundary evidence.`,
      evidence: [
        `audit-scope:${task.scope}`,
        `findings:${findings.length}`,
        ...evidence.slice(0, 3),
      ],
      classification: "audit",
    }));
    const remediationGuidanceRelationships: SecurityRelationshipOutput[] = remediationPriorities
      .filter(
        (entry) =>
          typeof entry.recommendedOwner === "string" && entry.recommendedOwner.endsWith("-agent"),
      )
      .map((entry) => ({
        from: "agent:security-agent",
        to: `agent:${entry.recommendedOwner}`,
        relationship: "feeds-agent" as const,
        detail: `security-agent routed trust-boundary remediation guidance for ${entry.incidentId} to ${entry.recommendedOwner}.`,
        evidence: [
          `incident:${entry.incidentId}`,
          `severity:${entry.severity}`,
          `next-action:${entry.nextAction}`,
        ],
        classification: "remediation-guidance" as const,
      }));
    const toolInvocations: SecurityToolInvocationOutput[] = [
      {
        toolId: "documentParser",
        detail: "security-agent parsed tracked contracts, env examples, and proof-boundary code to derive findings.",
        evidence: [
          `scope:${task.scope}`,
          `tracked-roots:README.md,docs,orchestrator/src,systemd`,
        ],
        classification: "required",
      },
    ];
    const openIncidentCount = (state.incidentLedger ?? []).filter(
      (incident) => incident.status !== "resolved",
    ).length;
    const criticalOrHighCount = findings.filter(
      (finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH",
    ).length;
    const operationalMaturity: SecurityResult["operationalMaturity"] = {
      trustBoundaryCoverage:
        criticalOrHighCount === 0 && auditedAgents.length > 0
          ? "strong"
          : auditedAgents.length > 0 || findings.length > 0
            ? "partial"
            : "minimal",
      auditedAgentCount: auditedAgents.length,
      openIncidentCount,
      blockerCount: criticalOrHighCount,
      summary:
        auditedAgents.length > 0
          ? `Security audit covered ${auditedAgents.length} observed agent surface(s) with ${criticalOrHighCount} critical/high blocker(s).`
          : `Security audit produced ${findings.length} finding(s) but no agent-specific audit relationships were observed yet.`,
    };

    return {
      success: true,
      findings: enrichedFindings,
      boundedFixes,
      riskMatrix: {
        exploitableCount: findings.filter((finding) => finding.exploitability === "high").length,
        fleetWideCount: findings.filter((finding) => finding.blastRadius === "fleet").length,
        serviceScopedCount: findings.filter((finding) => finding.blastRadius === "service").length,
      },
      summary: {
        total: findings.length,
        critical: findings.filter((finding) => finding.severity === "CRITICAL").length,
        exploitable: findings.some(
          (finding) => finding.severity === "CRITICAL" || (finding.cvss ?? 0) >= 8,
        ),
        compliance: findings.length === 0 ? "PASS" : "REVIEW_REQUIRED",
      },
      auditedAgents,
      relationships: [...relationships, ...remediationGuidanceRelationships],
      toolInvocations,
      operationalMaturity,
      remediationPriorities,
      trustBoundaryHistory,
      permissionDriftTimeline,
      routeBoundaryWatch,
      regressionReview,
      remediationDepth,
      exploitabilityRanking,
      remediationClosure,
      ...specialistFields,
      evidence,
      executionTime: Date.now() - startTime,
    };
  } catch {
    const specialistFields = buildSpecialistOperatorFields({
      role: "Security Engineer",
      workflowStage: "audit-failed",
      deliverable:
        "evidence-backed trust-boundary findings with containment, rollback context, and remediation priorities",
      status: "blocked",
      operatorSummary:
        "Security audit failed before it could establish a trustworthy trust-boundary review.",
      recommendedNextActions: [
        "Inspect the audit failure and restore the bounded local review path.",
        "Keep security closure open until a new audit produces evidence-backed findings.",
      ],
    });
    return {
      success: false,
      findings: [],
      boundedFixes: [],
      riskMatrix: {
        exploitableCount: 0,
        fleetWideCount: 0,
        serviceScopedCount: 0,
      },
      summary: { total: 0, critical: 0, exploitable: false, compliance: "ERROR" },
      auditedAgents: [],
      relationships: [],
      toolInvocations: [],
      operationalMaturity: {
        trustBoundaryCoverage: "minimal",
        auditedAgentCount: 0,
        openIncidentCount: 0,
        blockerCount: 1,
        summary: "Security audit execution failed before trust-boundary coverage could be established.",
      },
      remediationPriorities: [],
      trustBoundaryHistory: [],
      permissionDriftTimeline: [],
      routeBoundaryWatch: {
        unprotectedRouteCount: 0,
        authFindingCount: 0,
        recurringAuthIncidents: 0,
        status: "nominal",
      },
      regressionReview: {
        status: "clear",
        permissionDriftCount: 0,
        recurringBoundaryCount: 0,
        rollbackReadyFixCount: 0,
      },
      remediationDepth: {
        status: "ready",
        ownerlessPriorityCount: 0,
        rollbackSensitiveFixCount: 0,
        trustBoundaryFixCount: 0,
        criticalPriorityCount: 0,
      },
      exploitabilityRanking: [],
      remediationClosure: {
        status: "blocked",
        highRiskCount: 0,
        ownerlessPriorityCount: 0,
        verifierRecommended: false,
        closureBlockers: ["Security audit execution failed before remediation closure could be assessed."],
      },
      ...specialistFields,
      evidence: [],
      executionTime: Date.now() - startTime,
    };
  }
}

export { handleTask, loadConfig, canUseSkill };

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    return;
  }

  const raw = await readFile(payloadPath, "utf-8");
  const payload = JSON.parse(raw) as SecurityTask;
  const result = await handleTask(payload);

  const resultFile = process.env.SECURITY_AGENT_RESULT_FILE;
  if (resultFile) {
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
