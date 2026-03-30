import { useMemo } from "react";
import { isOrchestratorBaseConfigured } from "@/lib/runtime-config";
import { SummaryCard } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import { ClawMark } from "@/components/console/ClawMark";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCommandCenterOverview,
  useCommandCenterControl,
  useCommandCenterDemand,
  useCommandCenterDemandLive,
  useMilestonesLatest,
  useMilestonesDeadLetter,
} from "@/hooks/use-public-surface-api";
import {
  Globe,
  Shield,
  TrendingUp,
  Milestone,
  AlertTriangle,
  Activity,
  Clock,
  Layers,
  FileText,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { num, str, bool, toArray, toNullableString } from "@/lib/safe-render";

// ── Helpers ──

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

const riskColors: Record<string, string> = {
  "on-track": "text-status-healthy",
  "at-risk": "text-status-warning",
  "blocked": "text-status-error",
  "completed": "text-status-info",
};

const nodeStateColors: Record<string, string> = {
  live: "bg-status-healthy",
  warning: "bg-status-warning",
  idle: "bg-muted-foreground",
};

const demandStateColors: Record<string, string> = {
  hot: "text-status-error",
  warm: "text-status-warning",
  idle: "text-muted-foreground",
};

// ── Flat view models ──

interface ProofNodeVM { id: string; label: string; state: string; detail: string; }
interface MilestoneVM {
  milestoneId: string; timestampUtc: string | null; scope: string; claim: string;
  riskStatus: string; nextAction: string | null; source: string | null; evidenceCount: number;
}
interface ClusterVM { id: string; label: string; engines: EngineVM[]; }
interface EngineVM { id: string; name: string; tier: string; approvalClass: string; }
interface DemandSegmentVM { id: string; label: string; state: string; staticWeight: number; liveSignalCount: number; }
interface DemandSummaryVM {
  totalSegments: number; hotSegments: number; queueTotal: number;
  stale: boolean; demandNarrative: string | null; source: string;
  snapshotGeneratedAt: string | null;
}

function flattenProofNodes(data: any): ProofNodeVM[] {
  return toArray(data?.proofNodes).map((n: any) => ({
    id: str(n?.id, "—"), label: str(n?.label, "—"),
    state: str(n?.state, "idle"), detail: str(n?.detail, ""),
  }));
}

function flattenMilestones(data: any): MilestoneVM[] {
  return toArray(data?.items).map((e: any) => ({
    milestoneId: str(e?.milestoneId, ""),
    timestampUtc: toNullableString(e?.timestampUtc),
    scope: str(e?.scope, "—"),
    claim: str(e?.claim, "—"),
    riskStatus: str(e?.riskStatus, "unknown"),
    nextAction: toNullableString(e?.nextAction),
    source: toNullableString(e?.source),
    evidenceCount: toArray(e?.evidence).length,
  }));
}

function flattenClusters(data: any): ClusterVM[] {
  return toArray(data?.clusters).map((c: any) => ({
    id: str(c?.id, ""), label: str(c?.label, "—"),
    engines: toArray(c?.engines).map((e: any) => ({
      id: str(e?.id, ""), name: str(e?.name, "—"),
      tier: str(e?.tier, "—"), approvalClass: str(e?.approvalClass, "—"),
    })),
  }));
}

function flattenDemand(data: any): { segments: DemandSegmentVM[]; summary: DemandSummaryVM | null } {
  if (!data) return { segments: [], summary: null };
  const summary = data?.summary ? {
    totalSegments: num(data.summary.totalSegments),
    hotSegments: num(data.summary.hotSegments),
    queueTotal: num(data.summary.queueTotal),
    stale: bool(data.summary.stale),
    demandNarrative: toNullableString(data.summary.demandNarrative),
    source: str(data.summary.source, "unknown"),
    snapshotGeneratedAt: toNullableString(data.summary.snapshotGeneratedAt),
  } : null;
  const segments = toArray(data?.segments).map((s: any) => ({
    id: str(s?.id, ""), label: str(s?.label, "—"),
    state: str(s?.state, "idle"),
    staticWeight: num(s?.staticWeight), liveSignalCount: num(s?.liveSignalCount),
  }));
  return { segments, summary };
}

interface OverviewVM {
  evidenceCount: number; visibleFeedCount: number; activeLaneCount: number;
  onTrack: number; atRisk: number; blocked: number; completed: number;
  activeLanes: string[]; deadLetterCount: number; lastPollAt: string | null;
  stale: boolean; proofNodes: ProofNodeVM[];
  latestMilestone: MilestoneVM | null;
}

function flattenOverview(data: any): OverviewVM | null {
  if (!data) return null;
  const risk = data?.riskCounts ?? {};
  const latest = data?.latest;
  return {
    evidenceCount: num(data?.evidenceCount),
    visibleFeedCount: num(data?.visibleFeedCount),
    activeLaneCount: num(data?.activeLaneCount),
    onTrack: num(risk?.onTrack), atRisk: num(risk?.atRisk),
    blocked: num(risk?.blocked), completed: num(risk?.completed),
    activeLanes: toArray<string>(data?.activeLanes).map(l => str(l, "")),
    deadLetterCount: num(data?.deadLetterCount),
    lastPollAt: toNullableString(data?.lastPollAt),
    stale: bool(data?.stale),
    proofNodes: flattenProofNodes(data),
    latestMilestone: latest ? {
      milestoneId: str(latest?.milestoneId, ""),
      timestampUtc: toNullableString(latest?.timestampUtc),
      scope: str(latest?.scope, "—"), claim: str(latest?.claim, "—"),
      riskStatus: str(latest?.riskStatus, "unknown"),
      nextAction: toNullableString(latest?.nextAction),
      source: toNullableString(latest?.source),
      evidenceCount: toArray(latest?.evidence).length,
    } : null,
  };
}

// ── Sub-components ──

function ProofNodeRow({ node }: { node: ProofNodeVM }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${nodeStateColors[node.state] || "bg-muted-foreground"}`} />
      <span className="text-[11px] font-mono font-semibold text-foreground uppercase tracking-wider w-20">{node.label}</span>
      <span className="text-[10px] font-mono text-muted-foreground truncate">{node.detail}</span>
    </div>
  );
}

function MilestoneRow({ event }: { event: MilestoneVM }) {
  return (
    <div className="console-inset p-3 rounded-sm space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono font-semibold text-foreground leading-snug">{event.claim}</p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{event.scope}</p>
        </div>
        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${riskColors[event.riskStatus] || "text-muted-foreground"}`}>
          {event.riskStatus}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(event.timestampUtc)}
        </span>
        {event.source && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {event.source}
          </span>
        )}
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {event.evidenceCount} evidence
        </span>
      </div>
      {event.nextAction && (
        <p className="text-[10px] font-mono text-muted-foreground/70 italic">Next: {event.nextAction}</p>
      )}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: ClusterVM }) {
  return (
    <div className="console-inset p-3 rounded-sm space-y-2">
      <p className="text-[11px] font-mono font-semibold text-foreground uppercase tracking-wider">{cluster.label}</p>
      <div className="space-y-1">
        {cluster.engines.map((engine) => (
          <div key={engine.id} className="flex items-center justify-between gap-2 text-[10px] font-mono">
            <span className="text-foreground/80 truncate">{engine.name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge label={engine.tier} size="sm" />
              <StatusBadge label={engine.approvalClass} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemandSegmentRow({ segment }: { segment: DemandSegmentVM }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider w-10 ${demandStateColors[segment.state] || "text-muted-foreground"}`}>
          {segment.state}
        </span>
        <span className="text-[11px] font-mono text-foreground truncate">{segment.label}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-muted-foreground">
        <span>wt: {segment.staticWeight}</span>
        <span>sig: {segment.liveSignalCount}</span>
      </div>
    </div>
  );
}

// ── Loading skeleton ──

function ProofSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// ── Error state ──

function ProofError({ message }: { message: string }) {
  return (
    <div className="warning-banner">
      <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Fetch Failed</p>
        <p className="text-xs text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  );
}

// ── Demand section renderer (shared between demand + demand-live) ──
function DemandSection({ title, demand, icon }: { title: string; demand: { segments: DemandSegmentVM[]; summary: DemandSummaryVM | null }; icon: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {demand.summary && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="console-inset p-2 rounded-sm text-center">
              <p className="metric-value text-lg">{demand.summary.totalSegments}</p>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Segments</p>
            </div>
            <div className="console-inset p-2 rounded-sm text-center">
              <p className="metric-value text-lg">{demand.summary.hotSegments}</p>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Hot</p>
            </div>
            <div className="console-inset p-2 rounded-sm text-center">
              <p className="metric-value text-lg">{demand.summary.queueTotal}</p>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">Queued</p>
            </div>
          </div>
          {demand.summary.stale && (
            <p className="text-[9px] font-mono text-status-warning flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Demand data is stale
            </p>
          )}
          {demand.summary.demandNarrative && (
            <p className="text-[10px] font-mono text-muted-foreground/70 italic leading-relaxed">
              {demand.summary.demandNarrative}
            </p>
          )}
          <p className="text-[9px] font-mono text-muted-foreground/60 italic">
            Source: {demand.summary.source}
            {demand.summary.snapshotGeneratedAt && ` · ${timeAgo(demand.summary.snapshotGeneratedAt)}`}
          </p>
        </div>
      )}
      {demand.segments.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Segments</p>
          {demand.segments.map((seg) => (
            <DemandSegmentRow key={seg.id} segment={seg} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──

export default function PublicProofPage() {
  const proofConfigured = isOrchestratorBaseConfigured();

  const overview = useCommandCenterOverview();
  const control = useCommandCenterControl();
  const demand = useCommandCenterDemand();
  const demandLive = useCommandCenterDemandLive();
  const milestones = useMilestonesLatest(20);
  const deadLetter = useMilestonesDeadLetter();

  // Flatten all data through view models
  const overviewVM = useMemo(() => flattenOverview(overview.data), [overview.data]);
  const clustersVM = useMemo(() => flattenClusters(control.data), [control.data]);
  const demandVM = useMemo(() => flattenDemand(demand.data), [demand.data]);
  const demandLiveVM = useMemo(() => flattenDemand(demandLive.data), [demandLive.data]);
  const milestonesVM = useMemo(() => flattenMilestones(milestones.data), [milestones.data]);
  const deadLetterVM = useMemo(() => flattenMilestones(deadLetter.data), [deadLetter.data]);

  const allLoading = overview.isLoading && control.isLoading && demand.isLoading && milestones.isLoading;
  const allError = !proofConfigured || (overview.isError && control.isError && demand.isError && milestones.isError);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="indicator-light text-indicator-blue" />
        <h2 className="page-title text-status-info">Public Proof</h2>
      </div>

      <div className="console-panel p-4" style={{ borderColor: "hsl(200 75% 50% / 0.15)", background: "hsl(200 75% 50% / 0.03)" }}>
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide leading-relaxed">
          <strong className="text-foreground">Community confidence layer</strong> — a read-only view showing the system is real and active.
          This is not the operator control plane and does not represent live agent-runtime certainty.
        </p>
      </div>

      {/* Stale indicator */}
      {overviewVM?.stale && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Stale Data</p>
            <p className="text-xs text-muted-foreground mt-1">
              Proof data may be outdated. Last poll: {timeAgo(overviewVM.lastPollAt)}
            </p>
          </div>
        </div>
      )}

      {/* Full error state */}
      {allError && !allLoading && (
        <ProofError message={
          !proofConfigured
            ? "The orchestrator API base is not configured, so the public proof surface cannot load."
            : "Unable to reach the orchestrator-owned public proof endpoints. The backend may be temporarily unavailable."
        } />
      )}

      {/* Overview section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SummaryCard title="System Proof" icon={<Globe className="w-4 h-4" />}>
          {overview.isLoading ? <ProofSkeleton /> : overview.isError ? (
            <ProofError message={overview.error?.message || "Failed to fetch overview"} />
          ) : overviewVM ? (
            <div className="space-y-4">
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="console-inset p-2 rounded-sm text-center">
                  <p className="metric-value text-xl">{String(overviewVM.evidenceCount).padStart(2, "0")}</p>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Evidence</p>
                </div>
                <div className="console-inset p-2 rounded-sm text-center">
                  <p className="metric-value text-xl">{String(overviewVM.visibleFeedCount).padStart(2, "0")}</p>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Feed</p>
                </div>
                <div className="console-inset p-2 rounded-sm text-center">
                  <p className="metric-value text-xl">{String(overviewVM.activeLaneCount).padStart(2, "0")}</p>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Lanes</p>
                </div>
              </div>

              {/* Risk breakdown */}
              <div className="space-y-1">
                <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Risk Posture</p>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="text-status-healthy">{overviewVM.onTrack} on-track</span>
                  <span className="text-status-warning">{overviewVM.atRisk} at-risk</span>
                  <span className="text-status-error">{overviewVM.blocked} blocked</span>
                  <span className="text-status-info">{overviewVM.completed} done</span>
                </div>
              </div>

              {/* Active lanes */}
              {overviewVM.activeLanes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Active Lanes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {overviewVM.activeLanes.map((lane) => (
                      <span key={lane} className="inline-flex items-center px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider bg-muted/80 text-foreground/70 border border-border rounded-sm">
                        {lane}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dead letters */}
              {overviewVM.deadLetterCount > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-status-warning">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{overviewVM.deadLetterCount} dead letter{overviewVM.deadLetterCount !== 1 ? "s" : ""}</span>
                </div>
              )}

              {/* Last poll */}
              <p className="text-[9px] font-mono text-muted-foreground/60">
                Last poll: {timeAgo(overviewVM.lastPollAt)}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground font-mono py-4 text-center">No proof data available</p>
          )}
        </SummaryCard>

        {/* Proof Nodes */}
        <SummaryCard title="Proof Pipeline" icon={<Activity className="w-4 h-4" />}>
          {overview.isLoading ? <ProofSkeleton /> : overview.isError ? (
            <ProofError message={overview.error?.message || "Failed to fetch proof nodes"} />
          ) : overviewVM && overviewVM.proofNodes.length > 0 ? (
            <div className="space-y-0.5">
              {overviewVM.proofNodes.map((node) => (
                <ProofNodeRow key={node.id} node={node} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground font-mono py-4 text-center">No proof nodes reported</p>
          )}
        </SummaryCard>

        {/* Control clusters */}
        <SummaryCard title="Control Summary" icon={<Shield className="w-4 h-4" />}>
          {control.isLoading ? <ProofSkeleton /> : control.isError ? (
            <ProofError message={control.error?.message || "Failed to fetch control data"} />
          ) : clustersVM.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[9px] font-mono text-muted-foreground/60 italic">Static metadata — not live runtime status</p>
              {clustersVM.map((cluster) => (
                <ClusterCard key={cluster.id} cluster={cluster} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground font-mono py-4 text-center">No control clusters reported</p>
          )}
        </SummaryCard>

        {/* Community demand */}
        <SummaryCard title="Community Demand" icon={<TrendingUp className="w-4 h-4" />}>
          {demand.isLoading ? <ProofSkeleton /> : demand.isError ? (
            <ProofError message={demand.error?.message || "Failed to fetch demand data"} />
          ) : demandVM.segments.length > 0 || demandVM.summary ? (
            <DemandSection title="Community Demand" demand={demandVM} icon={<TrendingUp className="w-4 h-4" />} />
          ) : (
            <p className="text-[11px] text-muted-foreground font-mono py-4 text-center">No demand data available</p>
          )}
        </SummaryCard>
      </div>

      {/* Milestones feed */}
      <SummaryCard title="Recent Milestones" icon={<Milestone className="w-4 h-4" />}>
        {milestones.isLoading ? <ProofSkeleton /> : milestones.isError ? (
          <ProofError message={milestones.error?.message || "Failed to fetch milestones"} />
        ) : milestonesVM.length > 0 ? (
          <div className="space-y-2">
            {milestonesVM.map((event, i) => (
              <MilestoneRow key={event.milestoneId || i} event={event} />
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <Layers className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground font-mono">No public proof events yet</p>
          </div>
        )}
      </SummaryCard>

      {/* Latest milestone highlight */}
      {overviewVM?.latestMilestone && (
        <SummaryCard title="Latest Proof Event" icon={<Zap className="w-4 h-4" />} variant="highlight">
          <MilestoneRow event={overviewVM.latestMilestone} />
        </SummaryCard>
      )}

      {/* Live demand variant */}
      <SummaryCard title="Live Demand Signal" icon={<TrendingUp className="w-4 h-4" />}>
        {demandLive.isLoading ? <ProofSkeleton /> : demandLive.isError ? (
          <ProofError message={demandLive.error?.message || "Failed to fetch live demand data"} />
        ) : demandLiveVM.segments.length > 0 || demandLiveVM.summary ? (
          <DemandSection title="Live Demand Signal" demand={demandLiveVM} icon={<TrendingUp className="w-4 h-4" />} />
        ) : (
          <p className="text-[11px] text-muted-foreground font-mono py-4 text-center">No live demand data available</p>
        )}
      </SummaryCard>

      {/* Dead-letter milestones */}
      <SummaryCard title="Dead-Letter Milestones" icon={<AlertTriangle className="w-4 h-4" />}>
        {deadLetter.isLoading ? <ProofSkeleton /> : deadLetter.isError ? (
          <ProofError message={deadLetter.error?.message || "Failed to fetch dead-letter milestones"} />
        ) : deadLetterVM.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[9px] font-mono text-muted-foreground/60 italic">
              Failed or rejected milestone delivery events
            </p>
            {deadLetterVM.map((event, i) => (
              <MilestoneRow key={event.milestoneId || i} event={event} />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[11px] text-muted-foreground font-mono">No dead-letter milestones</p>
            <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">All milestone deliveries are healthy</p>
          </div>
        )}
      </SummaryCard>

      <div className="flex justify-center mt-4 opacity-[0.04]">
        <ClawMark size={80} />
      </div>
    </div>
  );
}
