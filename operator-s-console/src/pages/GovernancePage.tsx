import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useDashboardOverview, useSkillsPolicy, useSkillsTelemetry, useSkillsRegistry, useSkillsAudit } from "@/hooks/use-console-api";
import { SummaryCard, MetricModule } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import { ShieldCheck, RotateCcw, Sparkles, BarChart3, Layers, ChevronDown, ChevronRight, ScrollText, Clock, AlertTriangle } from "lucide-react";
import { num, str, toArray, toNullableString } from "@/lib/safe-render";

// ── Flat view models ──

interface GovMetricsVM {
  approvals: number;
  taskRetryRecoveries: number;
}

interface PolicyVM {
  totalCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  restartSafeCount: number;
}

interface TelemetryVM {
  totalInvocations: number;
  allowedCount: number;
  deniedCount: number;
}

interface SkillRowVM {
  skillId: string;
  name: string;
  trustStatus: string;
  intakeSource: string | null;
  persistenceMode: string | null;
  description: string | null;
}

interface AuditRowVM {
  skillId: string;
  action: string;
  result: string;
  timestamp: string;
}

interface OperatorFocusItemVM {
  label: string;
  status: string;
  detail: string;
}

interface OperatorFocusVM {
  status: string;
  summary: string;
  items: OperatorFocusItemVM[];
  nextActions: string[];
}

function buildGovMetrics(dashboard: any): GovMetricsVM {
  const g = dashboard?.governance ?? {};
  return {
    approvals: num(g?.approvals),
    taskRetryRecoveries: num(g?.taskRetryRecoveries),
  };
}

function buildPolicyVM(data: any): PolicyVM | null {
  if (!data?.policy) return null;
  const p = data.policy;
  return {
    totalCount: num(p?.totalCount),
    pendingReviewCount: num(p?.pendingReviewCount),
    approvedCount: num(p?.approvedCount),
    restartSafeCount: num(p?.restartSafeCount),
  };
}

function buildTelemetryVM(data: any): TelemetryVM | null {
  if (!data?.telemetry) return null;
  const t = data.telemetry;
  return {
    totalInvocations: num(t?.totalInvocations),
    allowedCount: num(t?.allowedCount),
    deniedCount: num(t?.deniedCount),
  };
}

function buildSkillRows(data: any): { skills: SkillRowVM[]; total: number } {
  const skills = toArray(data?.skills).map((s: any) => ({
    skillId: str(s?.skillId, "—"),
    name: str(s?.name, "unnamed"),
    trustStatus: str(s?.trustStatus, "unknown"),
    intakeSource: toNullableString(s?.intakeSource),
    persistenceMode: toNullableString(s?.persistenceMode),
    description: toNullableString(s?.description),
  }));
  return { skills, total: num(data?.total) };
}

function buildAuditRows(data: any): { records: AuditRowVM[]; total: number; hasMore: boolean; returned: number } {
  const records = toArray(data?.records).map((r: any) => ({
    skillId: str(r?.skillId, "—"),
    action: str(r?.action, "—"),
    result: str(r?.result, "—"),
    timestamp: str(r?.timestamp, "—"),
  }));
  return {
    records,
    total: num(data?.total),
    hasMore: data?.page?.hasMore === true,
    returned: num(data?.page?.returned),
  };
}

function buildOperatorFocusVM(args: {
  govMetrics: GovMetricsVM;
  policyVM: PolicyVM | null;
  telemetryVM: TelemetryVM | null;
  registryVM: { skills: SkillRowVM[]; total: number };
}): OperatorFocusVM {
  const pendingReviewSkills = args.registryVM.skills
    .filter((skill) => skill.trustStatus === "pending-review")
    .map((skill) => skill.name);
  const metadataOnlySkills = args.registryVM.skills
    .filter((skill) => skill.persistenceMode === "metadata-only")
    .map((skill) => skill.name);

  const pendingReviewCount = args.policyVM?.pendingReviewCount ?? pendingReviewSkills.length;
  const deniedCount = args.telemetryVM?.deniedCount ?? 0;
  const approvals = args.govMetrics.approvals;
  const retryRecoveries = args.govMetrics.taskRetryRecoveries;
  const registryCount = args.registryVM.total;

  const items: OperatorFocusItemVM[] = [
    {
      label: "Review Backlog",
      status: pendingReviewCount > 0 ? "review-required" : "ready",
      detail:
        pendingReviewCount > 0
          ? `${pendingReviewCount} governed skill(s) still need review before you widen trust.`
          : "No governed skill review backlog is blocking promotion right now.",
    },
    {
      label: "Telemetry Pressure",
      status: deniedCount > 0 ? "alert" : "quiet",
      detail:
        deniedCount > 0
          ? `${deniedCount} invocation(s) were denied; confirm those policy blocks are intentional.`
          : "Denied governed skill activity is quiet right now.",
    },
    {
      label: "Approval Queue",
      status: approvals > 0 ? "watching" : "ready",
      detail:
        approvals > 0
          ? `${approvals} approval request(s) are holding governed workflows in place.`
          : "No approvals are currently holding the governance path open.",
    },
    {
      label: "Registry Posture",
      status: metadataOnlySkills.length > 0 ? "watch" : "ready",
      detail:
        metadataOnlySkills.length > 0
          ? `${metadataOnlySkills.length} metadata-only skill(s) still need executable trust decisions.`
          : registryCount > 0
            ? `Governed registry covers ${registryCount} skill(s) with no metadata-only drift.`
            : "No governed skills are registered yet.",
    },
  ];

  const nextActions = [
    pendingReviewCount > 0
      ? `Review ${pendingReviewCount} governed skill(s) before widening automation access.`
      : null,
    pendingReviewSkills.length > 0
      ? `Start with: ${pendingReviewSkills.slice(0, 3).join(", ")}.`
      : null,
    deniedCount > 0
      ? `Inspect ${deniedCount} denied skill invocation(s) to confirm policy blocks are intentional.`
      : null,
    approvals > 0
      ? `Clear ${approvals} pending approval request(s) so governed workflows can proceed.`
      : null,
    retryRecoveries > 0
      ? `Review ${retryRecoveries} retry recovery event(s) for recurring governance or permission drift.`
      : null,
    metadataOnlySkills.length > 0
      ? `Decide whether ${metadataOnlySkills.slice(0, 2).join(", ")} should stay metadata-only or graduate to restart-safe execution.`
      : null,
  ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

  const status =
    pendingReviewCount > 0 || deniedCount > 0
      ? "blocked"
      : approvals > 0 || retryRecoveries > 0 || metadataOnlySkills.length > 0
        ? "watching"
        : "ready";

  const summary =
    status === "blocked"
      ? "Governed skill posture needs operator review before you broaden automation or treat the trust model as settled."
      : status === "watching"
        ? "Governance is usable, but there is still review or approval pressure worth clearing before it turns into drift."
        : "Governed skill posture is quiet. No immediate review, denial, or approval backlog is blocking operator confidence.";

  return {
    status,
    summary,
    items,
    nextActions,
  };
}

export default function GovernancePage() {
  const { data: dashboard, isLoading: dashLoading } = useDashboardOverview();
  const { data: policy } = useSkillsPolicy();
  const { data: telemetry } = useSkillsTelemetry();
  const { data: registry, isLoading: registryLoading, isError: registryError, error: registryErrorObj } = useSkillsRegistry();
  const { data: audit, isLoading: auditLoading } = useSkillsAudit({ limit: 25 });
  const [registryOpen, setRegistryOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const govMetrics = useMemo(() => buildGovMetrics(dashboard), [dashboard]);
  const policyVM = useMemo(() => buildPolicyVM(policy), [policy]);
  const telemetryVM = useMemo(() => buildTelemetryVM(telemetry), [telemetry]);
  const registryVM = useMemo(() => buildSkillRows(registry), [registry]);
  const auditVM = useMemo(() => buildAuditRows(audit), [audit]);
  const operatorFocus = useMemo(
    () =>
      buildOperatorFocusVM({
        govMetrics,
        policyVM,
        telemetryVM,
        registryVM,
      }),
    [govMetrics, policyVM, telemetryVM, registryVM],
  );

  if (dashLoading || !dashboard) {
    return (
      <div className="space-y-5">
        <h2 className="page-title">Governance</h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="console-panel h-28 animate-pulse" style={{ opacity: 0.3 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="page-title">Governance</h2>

      <div className="console-inset p-3">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <ShieldCheck className="w-3 h-3 inline mr-1.5 text-primary" />
          Governance posture and backlog pressure. Visibility surface — not a full control plane.
        </p>
      </div>

      <SummaryCard
        title="Operator Focus"
        icon={<ShieldCheck className="w-4 h-4" />}
        variant={operatorFocus.status === "ready" ? "highlight" : "warning"}
        headerAction={<StatusBadge label={operatorFocus.status} size="sm" />}
      >
        <div className="space-y-3">
          <p className="text-[11px] font-mono text-foreground leading-relaxed">
            {operatorFocus.summary}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {operatorFocus.items.map((item) => (
              <div key={item.label} className="activity-cell p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                    {item.label}
                  </p>
                  <StatusBadge label={item.status} size="sm" />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
          {operatorFocus.nextActions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                Operator Actions
              </p>
              {operatorFocus.nextActions.map((action, index) => (
                <p
                  key={`governance-action-${index}`}
                  className="text-[10px] font-mono text-foreground leading-relaxed"
                >
                  {index + 1}. {action}
                </p>
              ))}
            </div>
          )}
        </div>
      </SummaryCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricModule
          title="Approvals"
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          value={govMetrics.approvals}
          subtitle="Tasks in approval queue"
          glow={govMetrics.approvals > 0}
        />
        <MetricModule
          title="Task Retry Recoveries"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          value={govMetrics.taskRetryRecoveries}
          subtitle={govMetrics.taskRetryRecoveries === 0 ? "No items waiting" : "Jobs in retry recovery"}
        />
      </div>

      <div className="claw-divider" />

      {/* Skills Policy */}
      {policyVM && (
        <SummaryCard title="Governed Skills Policy" icon={<Sparkles className="w-4 h-4" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total", value: policyVM.totalCount },
              { label: "Pending Review", value: policyVM.pendingReviewCount },
              { label: "Approved", value: policyVM.approvedCount },
              { label: "Restart-Safe", value: policyVM.restartSafeCount },
            ].map((item) => (
              <div key={item.label} className="activity-cell p-3 text-center">
                <p className="metric-value text-2xl">{item.value}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.12em] mt-1.5">{item.label}</p>
              </div>
            ))}
          </div>
        </SummaryCard>
      )}

      {/* Skills Telemetry */}
      {telemetryVM && (
        <SummaryCard title="Skills Telemetry" icon={<BarChart3 className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Invocations", value: telemetryVM.totalInvocations },
              { label: "Allowed", value: telemetryVM.allowedCount },
              { label: "Denied", value: telemetryVM.deniedCount },
            ].map((item) => (
              <div key={item.label} className="activity-cell p-3 text-center">
                <p className="metric-value text-2xl">{item.value}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.12em] mt-1.5">{item.label}</p>
              </div>
            ))}
          </div>
        </SummaryCard>
      )}

      {/* Skills Registry */}
      <div className="console-panel overflow-hidden">
        <button
          onClick={() => setRegistryOpen(o => !o)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-panel-highlight/20 transition-colors"
          style={{
            background: 'linear-gradient(180deg, hsl(216, 12%, 14%) 0%, hsl(216, 14%, 11%) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Skills Registry {registry ? `(${registryVM.total})` : ""}
            </span>
          </div>
          {registryOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {registryOpen && (
          <div className="p-3 border-t border-border/40 space-y-1">
            {registryLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="console-panel h-10 animate-pulse" style={{ opacity: 0.3 }} />
                ))}
              </div>
            ) : registryError ? (
              <div className="warning-banner">
                <AlertTriangle className="w-4 h-4 text-status-error shrink-0" />
                <div>
                  <p className="text-[11px] font-mono font-semibold text-status-error uppercase tracking-wider">Failed to load skills registry</p>
                  <p className="text-xs text-muted-foreground mt-1">{(registryErrorObj as Error)?.message || "Unknown error"}</p>
                </div>
              </div>
            ) : registryVM.skills.length > 0 ? (
              registryVM.skills.map((skill) => (
                <div key={skill.skillId} className="activity-module-row">
                  <div className="flex items-center gap-1.5 p-1.5 relative z-10 flex-wrap">
                    <div className="activity-cell flex items-center gap-2 px-3 py-2 min-w-[140px] flex-1">
                      <span className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wide truncate">
                        {skill.name}
                      </span>
                    </div>
                    <div className="activity-cell px-2.5 py-2 flex items-center">
                      <StatusBadge label={skill.trustStatus} size="sm" />
                    </div>
                    {skill.intakeSource && (
                      <div className="activity-cell px-3 py-2 hidden sm:flex items-center">
                        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
                          {skill.intakeSource}
                        </span>
                      </div>
                    )}
                    {skill.persistenceMode && (
                      <div className="activity-cell px-3 py-2 hidden md:flex items-center">
                        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
                          {skill.persistenceMode}
                        </span>
                      </div>
                    )}
                    {skill.description && (
                      <div className="activity-cell px-3 py-2 hidden lg:flex items-center flex-1">
                        <span className="text-[10px] text-muted-foreground truncate">{skill.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">No governed skills registered yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skills Audit Trail */}
      <div className="console-panel overflow-hidden">
        <button
          onClick={() => setAuditOpen(o => !o)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-panel-highlight/20 transition-colors"
          style={{
            background: 'linear-gradient(180deg, hsl(216, 12%, 14%) 0%, hsl(216, 14%, 11%) 100%)',
          }}
        >
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Skills Audit Trail {audit ? `(${auditVM.total})` : ""}
            </span>
          </div>
          {auditOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {auditOpen && (
          <div className="p-3 border-t border-border/40 space-y-1">
            {auditLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="console-panel h-10 animate-pulse" style={{ opacity: 0.3 }} />
                ))}
              </div>
            ) : auditVM.records.length > 0 ? (
              auditVM.records.map((rec, i) => (
                <div key={`${rec.skillId}-${rec.timestamp}-${i}`} className="activity-module-row">
                  <div className="flex items-center gap-1.5 p-1.5 relative z-10 flex-wrap">
                    <div className="activity-cell flex items-center gap-2 px-3 py-2 min-w-[100px]">
                      <span className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wide truncate">
                        {rec.skillId}
                      </span>
                    </div>
                    <div className="activity-cell px-2.5 py-2 flex items-center">
                      <StatusBadge label={rec.result} size="sm" />
                    </div>
                    <div className="activity-cell px-3 py-2 flex items-center">
                      <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
                        {rec.action}
                      </span>
                    </div>
                    <div className="activity-cell px-3 py-2 hidden sm:flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground font-mono text-[10px] tracking-wide whitespace-nowrap">
                        {(() => {
                          try {
                            return formatDistanceToNow(new Date(rec.timestamp), { addSuffix: true });
                          } catch {
                            return rec.timestamp;
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">No audit records available.</p>
              </div>
            )}
            {auditVM.hasMore && (
              <p className="text-[9px] font-mono text-muted-foreground text-center pt-2">
                Showing {auditVM.returned} of {auditVM.total} records.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          Skills registry and audit trail expandable above. Full skill management not exposed in V1.
        </p>
      </div>
    </div>
  );
}
