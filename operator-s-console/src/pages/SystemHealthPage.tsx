import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDashboardOverview,
  useExtendedHealth,
  useHealth,
  usePersistenceHealth,
  usePersistenceSummary,
} from "@/hooks/use-console-api";
import { MetricModule, SummaryCard } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import {
  Activity,
  AlertTriangle,
  HardDrive,
  ListChecks,
  Network,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { bool, num, str, toArray, toNullableString } from "@/lib/safe-render";

interface HealthViewModel {
  systemStatus: string;
  routingStatus: string;
  queued: number;
  processing: number;
  declaredAgents: number;
  spawnedWorkerCapableCount: number;
  serviceAvailableCount: number;
  serviceInstalledCount: number;
  serviceRunningCount: number;
  serviceOperationalCount: number;
  activeRepairs: number;
  verifiedRepairs: number;
  failedRepairs: number;
  lastDetectedAt: string | null;
  lastVerifiedAt: string | null;
  persistenceStatus: string;
  persistenceDatabase: boolean;
  persistenceCollections: number;
  knowledgeIndexedEntries: number;
  knowledgeConceptCount: number;
  fastStartMode: boolean;
  pendingApprovals: number;
  selfHealingTotal: number;
  selfHealingActive: number;
  selfHealingVerified: number;
  selfHealingFailed: number;
}

interface TruthLayerVM {
  id: string;
  title: string;
  status: string;
  summary: string;
  evidence: Array<{ label: string; detail: string; status: string }>;
  signals: Array<{ severity: string; message: string }>;
}

interface RuntimeSurfaceVM {
  livenessStatus: string;
  livenessTimestamp: string | null;
  persistenceHealthStatus: string;
  persistenceDatabaseLabel: string;
  persistenceCollections: number;
  coordinationStatus: string;
  coordinationStore: string;
  coordinationDetail: string | null;
  persistenceSummaryStatus: string;
  persistenceAvailable: boolean;
  runtimeModeLabel: string;
  indicatorEntries: Array<{ label: string; value: string }>;
  retentionEntries: Array<{ label: string; value: string }>;
  storageEntries: Array<{ label: string; value: string }>;
  collectionEntries: Array<{ label: string; value: string }>;
}

function buildViewModel(
  extended: Record<string, any> | null | undefined,
  overview: Record<string, any> | null | undefined,
): HealthViewModel {
  const controlPlane = extended?.controlPlane ?? {};
  const queue = typeof controlPlane.queue === "object" && controlPlane.queue ? controlPlane.queue : {};
  const workers = extended?.workers ?? {};
  const repairs = extended?.repairs ?? {};
  const dependencies = extended?.dependencies ?? {};
  const persistenceDependency = typeof dependencies.persistence === "object" && dependencies.persistence ? dependencies.persistence : {};
  const knowledgeDependency = typeof dependencies.knowledge === "object" && dependencies.knowledge ? dependencies.knowledge : {};
  const overviewHealth = overview?.health ?? {};
  const overviewApprovals = overview?.approvals ?? {};
  const selfHealing = overview?.selfHealing?.summary ?? overview?.selfHealing ?? {};

  return {
    systemStatus: str(extended?.status, "unknown"),
    routingStatus: str(controlPlane.routing, "unknown"),
    queued: num(queue.queued),
    processing: num(queue.processing),
    declaredAgents: num(workers.declaredAgents),
    spawnedWorkerCapableCount: num(workers.spawnedWorkerCapableCount),
    serviceAvailableCount: num(workers.serviceAvailableCount),
    serviceInstalledCount: num(workers.serviceInstalledCount),
    serviceRunningCount: num(workers.serviceRunningCount),
    serviceOperationalCount: num(workers.serviceOperationalCount),
    activeRepairs: num(repairs.activeCount),
    verifiedRepairs: num(repairs.verifiedCount),
    failedRepairs: num(repairs.failedCount),
    lastDetectedAt: toNullableString(repairs.lastDetectedAt),
    lastVerifiedAt: toNullableString(repairs.lastVerifiedAt),
    persistenceStatus: str(persistenceDependency.status, "unknown"),
    persistenceDatabase: bool(persistenceDependency.database),
    persistenceCollections: num(persistenceDependency.collections),
    knowledgeIndexedEntries: num(knowledgeDependency.indexedEntries),
    knowledgeConceptCount: num(knowledgeDependency.conceptCount),
    fastStartMode: bool(overviewHealth.fastStartMode),
    pendingApprovals: num(overviewApprovals.pendingCount),
    selfHealingTotal: num(selfHealing.totalCount),
    selfHealingActive: num(selfHealing.activeCount),
    selfHealingVerified: num(selfHealing.verifiedCount),
    selfHealingFailed: num(selfHealing.failedCount),
  };
}

function buildTruthLayerSummary(extended: Record<string, any> | null | undefined): TruthLayerVM[] {
  const truth = extended?.truthLayers ?? {};

  return [
    {
      id: "claimed",
      title: "Claimed",
      status: str(truth?.claimed?.status, "unknown"),
      summary: str(truth?.claimed?.summary, "Declared control-plane contract."),
      evidence: toArray(truth?.claimed?.evidence).slice(0, 3).map((item: any) => ({
        label: str(item?.label, "evidence"),
        detail: str(item?.detail, "No detail recorded."),
        status: str(item?.status, "declared"),
      })),
      signals: toArray(truth?.claimed?.signals).slice(0, 3).map((item: any) => ({
        severity: str(item?.severity, "info"),
        message: str(item?.message, "No message recorded."),
      })),
    },
    {
      id: "configured",
      title: "Configured",
      status: str(truth?.configured?.status, "unknown"),
      summary: str(truth?.configured?.summary, "Runtime configuration truth."),
      evidence: toArray(truth?.configured?.evidence).slice(0, 3).map((item: any) => ({
        label: str(item?.label, "evidence"),
        detail: str(item?.detail, "No detail recorded."),
        status: str(item?.status, "declared"),
      })),
      signals: toArray(truth?.configured?.signals).slice(0, 3).map((item: any) => ({
        severity: str(item?.severity, "info"),
        message: str(item?.message, "No message recorded."),
      })),
    },
    {
      id: "observed",
      title: "Observed",
      status: str(truth?.observed?.status, "unknown"),
      summary: str(truth?.observed?.summary, "Observed runtime evidence."),
      evidence: toArray(truth?.observed?.evidence).slice(0, 3).map((item: any) => ({
        label: str(item?.label, "evidence"),
        detail: str(item?.detail, "No detail recorded."),
        status: str(item?.status, "live"),
      })),
      signals: toArray(truth?.observed?.signals).slice(0, 3).map((item: any) => ({
        severity: str(item?.severity, "info"),
        message: str(item?.message, "No message recorded."),
      })),
    },
    {
      id: "public",
      title: "Public",
      status: str(truth?.public?.status, "unknown"),
      summary: str(truth?.public?.summary, "Public proof boundary truth."),
      evidence: toArray(truth?.public?.evidence).slice(0, 3).map((item: any) => ({
        label: str(item?.label, "evidence"),
        detail: str(item?.detail, "No detail recorded."),
        status: str(item?.status, "live"),
      })),
      signals: toArray(truth?.public?.signals).slice(0, 3).map((item: any) => ({
        severity: str(item?.severity, "info"),
        message: str(item?.message, "No message recorded."),
      })),
    },
  ];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringifyMetricValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyMetricValue(item)).join(", ") || "[]";
  }
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const compact = Object.entries(objectValue)
      .slice(0, 3)
      .map(([key, entry]) => `${key}:${stringifyMetricValue(entry)}`)
      .join(", ");
    return compact || "object";
  }
  return "—";
}

function buildEntryList(value: unknown, limit = 6): Array<{ label: string; value: string }> {
  return Object.entries(toRecord(value))
    .slice(0, limit)
    .map(([label, entry]) => ({
      label,
      value: stringifyMetricValue(entry),
    }));
}

function buildRuntimeSurfaceVM(
  health: Record<string, any> | null | undefined,
  persistenceHealth: Record<string, any> | null | undefined,
  persistenceSummary: Record<string, any> | null | undefined,
  overview: Record<string, any> | null | undefined,
): RuntimeSurfaceVM {
  return {
    livenessStatus: str(health?.status, "unknown"),
    livenessTimestamp: toNullableString(health?.timestamp),
    persistenceHealthStatus: str(persistenceHealth?.status, "unknown"),
    persistenceDatabaseLabel: str(
      persistenceHealth?.store ??
        persistenceSummary?.storage?.driver ??
        persistenceHealth?.database,
      "database unknown",
    ),
    persistenceCollections: num(persistenceHealth?.collections),
    coordinationStatus: str(persistenceHealth?.coordination?.status, "unknown"),
    coordinationStore: str(persistenceHealth?.coordination?.store, "memory"),
    coordinationDetail: toNullableString(persistenceHealth?.coordination?.detail),
    persistenceSummaryStatus: str(persistenceSummary?.status, "unknown"),
    persistenceAvailable: persistenceSummary?.persistenceAvailable === true,
    runtimeModeLabel: overview?.health?.fastStartMode ? "Fast-start" : "Normal",
    indicatorEntries: buildEntryList(persistenceSummary?.indicators),
    retentionEntries: buildEntryList(persistenceSummary?.retention),
    storageEntries: buildEntryList(persistenceSummary?.storage),
    collectionEntries: buildEntryList(persistenceSummary?.collections),
  };
}

function buildRuntimeNotes(
  surface: RuntimeSurfaceVM,
  overview: Record<string, any> | null | undefined,
  extended: Record<string, any> | null | undefined,
): string[] {
  const notes = [
    "Control-plane routing success is separate from downstream dependency success.",
  ];

  if (surface.livenessStatus !== "healthy") {
    notes.push("Public liveness is degraded. Treat /api/health/extended as the authoritative operator surface.");
  }

  if (overview?.health?.fastStartMode) {
    notes.push("Fast-start keeps routing available while indexing, knowledge, or persistence guarantees may be intentionally reduced.");
  }

  if (surface.persistenceHealthStatus !== "healthy" || surface.persistenceSummaryStatus !== "healthy") {
    notes.push("Persistence is not fully healthy. Queueing can continue, but durability and replay confidence are reduced.");
  }

  if (surface.coordinationStatus !== "healthy") {
    notes.push(
      surface.coordinationStatus === "disabled"
        ? "Shared coordination is not configured yet. Claims, locks, and helper budgets are local to the current runtime."
        : "Shared coordination is degraded. Multi-process claim, lock, and budget truth may fall back to local memory until Redis recovers.",
    );
  }

  const githubDependency =
    extended?.dependencies?.github && typeof extended.dependencies.github === "object"
      ? extended.dependencies.github
      : null;
  if (githubDependency?.status === "failed") {
    notes.push(
      typeof githubDependency.summary === "string" && githubDependency.summary.trim().length > 0
        ? githubDependency.summary
        : "Latest GitHub Actions run failed. Repair the workflow before treating the pushed repo state as healthy.",
    );
  } else if (githubDependency?.status === "warning") {
    notes.push(
      typeof githubDependency.summary === "string" && githubDependency.summary.trim().length > 0
        ? githubDependency.summary
        : "GitHub Actions is still running or completed with a warning posture for the latest push.",
    );
  }

  if (num(extended?.incidents?.openCount) > 0) {
    notes.push("Open incidents are tracked separately in the Incidents page. Health truth should not be mistaken for remediation completion.");
  }

  if (num(extended?.repairs?.failedCount) > 0) {
    notes.push("Failed repairs require verification or reassignment before the runtime should be treated as healed.");
  }

  return notes;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="activity-cell px-3 py-2 flex justify-between items-center">
      <span className="text-[11px] text-muted-foreground font-mono tracking-wide">{label}</span>
      <span className="text-[11px] text-foreground font-mono font-bold">{String(value)}</span>
    </div>
  );
}

export default function SystemHealthPage() {
  const { apiKeyExpires } = useAuth();
  const { data: health, isLoading: healthLoading, isError: healthError } = useHealth();
  const { data: persistenceHealth, isLoading: persistenceHealthLoading, isError: persistenceHealthError } = usePersistenceHealth();
  const { data: persistenceSummary, isLoading: persistenceSummaryLoading, isError: persistenceSummaryError } = usePersistenceSummary();
  const { data: extended, isLoading: extendedLoading, isError: extendedError } = useExtendedHealth();
  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useDashboardOverview();

  const isLoading = extendedLoading || overviewLoading;
  const surfaceLoading = healthLoading || persistenceHealthLoading || persistenceSummaryLoading;

  const vm = useMemo(
    () => buildViewModel(extended as any, overview as any),
    [extended, overview],
  );
  const publicSurface = useMemo(
    () => buildRuntimeSurfaceVM(health as any, persistenceHealth as any, persistenceSummary as any, overview as any),
    [health, persistenceHealth, persistenceSummary, overview],
  );
  const operatorNotes = useMemo(
    () => buildRuntimeNotes(publicSurface, overview as any, extended as any),
    [publicSurface, overview, extended],
  );
  const truthLayers = useMemo(() => buildTruthLayerSummary(extended as any), [extended]);

  const isDegraded = vm.systemStatus !== "healthy" && vm.systemStatus !== "unknown";
  const openIncidentCount = num(extended?.incidents?.openCount);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="page-title">System Health</h2>
        <div className="console-inset p-3 rounded-sm">
          <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
            Technical runtime health, dependency posture, truth layers, and shared coordination. Incidents live in
            their own operator queue so this page can stay focused on technical truth.
          </p>
        </div>
      </div>

      {(extendedError || overviewError) && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Data Fetch Error</p>
            <p className="text-xs text-muted-foreground mt-1">
              Some health data could not be loaded. Displayed values may be incomplete.
            </p>
          </div>
        </div>
      )}

      {isDegraded && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Reduced Mode Active</p>
            <p className="text-xs text-muted-foreground mt-1">
              Some runtime or dependency layers are degraded. Treat durability, repair, or coordination guarantees as in flight.
            </p>
          </div>
        </div>
      )}

      {openIncidentCount > 0 && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Incidents Separated</p>
            <p className="text-xs text-muted-foreground mt-1">
              {openIncidentCount} open incident{openIncidentCount === 1 ? "" : "s"} remain active. Use the Incidents page for ownership, remediation, and acknowledgement workflow.
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="console-panel h-32 animate-pulse" style={{ opacity: 0.3 }} />
          ))}
        </div>
      )}

      <SummaryCard title="Runtime Surfaces" icon={<Server className="w-4 h-4" />} variant="highlight">
        <div className="space-y-4">
          {(healthError || persistenceHealthError || persistenceSummaryError) && (
            <div className="warning-banner">
              <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">
                  Runtime Surface Drift
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  One or more public runtime surfaces failed to load. The private extended-health surface below is still available.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricModule
              title="Liveness"
              icon={<Activity className="w-4 h-4" />}
              value={surfaceLoading ? "--" : publicSurface.livenessStatus.toUpperCase()}
              subtitle={publicSurface.livenessTimestamp ?? "/health"}
              glow={publicSurface.livenessStatus !== "healthy"}
            />
            <MetricModule
              title="Persistence Health"
              icon={<HardDrive className="w-4 h-4" />}
              value={surfaceLoading ? "--" : publicSurface.persistenceHealthStatus.toUpperCase()}
              subtitle={`${publicSurface.persistenceDatabaseLabel} · ${publicSurface.persistenceCollections} cols · ${publicSurface.coordinationStore}/${publicSurface.coordinationStatus}`}
              glow={publicSurface.persistenceHealthStatus !== "healthy"}
            />
            <MetricModule
              title="Persistence Summary"
              icon={<ListChecks className="w-4 h-4" />}
              value={surfaceLoading ? "--" : publicSurface.persistenceSummaryStatus.toUpperCase()}
              subtitle={publicSurface.persistenceAvailable ? "durable surface ready" : "durability reduced"}
              glow={publicSurface.persistenceSummaryStatus !== "healthy"}
            />
            <MetricModule
              title="Runtime Mode"
              icon={<Wrench className="w-4 h-4" />}
              value={publicSurface.runtimeModeLabel}
              subtitle="overview contract"
              glow={publicSurface.runtimeModeLabel !== "Normal"}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-3">
            <div className="console-inset p-3 rounded-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Persistence Envelope
                </p>
                <div className="flex gap-2">
                  <StatusBadge label={publicSurface.persistenceHealthStatus} size="sm" />
                  <StatusBadge label={publicSurface.persistenceSummaryStatus} size="sm" />
                </div>
              </div>

              <p className="text-[10px] font-mono text-muted-foreground">
                Coordination: {publicSurface.coordinationStore}/{publicSurface.coordinationStatus}
                {publicSurface.coordinationDetail ? ` — ${publicSurface.coordinationDetail}` : ""}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="activity-cell px-3 py-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Indicators</p>
                  {publicSurface.indicatorEntries.length > 0 ? (
                    publicSurface.indicatorEntries.map((entry) => (
                      <StatRow key={`indicator-${entry.label}`} label={entry.label} value={entry.value} />
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No indicator payload returned.</p>
                  )}
                </div>

                <div className="activity-cell px-3 py-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Retention</p>
                  {publicSurface.retentionEntries.length > 0 ? (
                    publicSurface.retentionEntries.map((entry) => (
                      <StatRow key={`retention-${entry.label}`} label={entry.label} value={entry.value} />
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No retention rules reported.</p>
                  )}
                </div>

                <div className="activity-cell px-3 py-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Storage</p>
                  {publicSurface.storageEntries.length > 0 ? (
                    publicSurface.storageEntries.map((entry) => (
                      <StatRow key={`storage-${entry.label}`} label={entry.label} value={entry.value} />
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No storage metadata exposed.</p>
                  )}
                </div>

                <div className="activity-cell px-3 py-3 space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Collections</p>
                  {publicSurface.collectionEntries.length > 0 ? (
                    publicSurface.collectionEntries.map((entry) => (
                      <StatRow key={`collection-${entry.label}`} label={entry.label} value={entry.value} />
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No collection summary returned.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="console-inset p-3 rounded-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Operator Notes
                </p>
                <StatusBadge label={publicSurface.runtimeModeLabel.toLowerCase()} size="sm" />
              </div>

              <div className="space-y-2">
                {operatorNotes.map((note, index) => (
                  <div key={`runtime-note-${index}`} className="activity-cell px-3 py-2.5">
                    <p className="text-[10px] font-mono text-foreground leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="Truth Layers" icon={<Activity className="w-4 h-4" />}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {truthLayers.map((layer) => (
            <div key={layer.id} className="console-inset p-3 rounded-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {layer.title}
                  </p>
                  <p className="mt-1 text-[10px] font-mono text-foreground leading-relaxed">{layer.summary}</p>
                </div>
                <StatusBadge label={layer.status} size="sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="console-inset p-3 rounded-sm space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Evidence</p>
                  {layer.evidence.length > 0 ? (
                    layer.evidence.map((item, index) => (
                      <div key={`${layer.id}-evidence-${index}`} className="activity-cell px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                            {item.label}
                          </span>
                          <StatusBadge label={item.status} size="sm" />
                        </div>
                        <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No evidence items exposed for this layer.</p>
                  )}
                </div>
                <div className="console-inset p-3 rounded-sm space-y-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Signals</p>
                  {layer.signals.length > 0 ? (
                    layer.signals.map((signal, index) => (
                      <div key={`${layer.id}-signal-${index}`} className="activity-cell px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                            {signal.severity}
                          </span>
                          <StatusBadge label={signal.severity} size="sm" />
                        </div>
                        <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                          {signal.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground">No live signals are currently attached to this truth layer.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SummaryCard>

      <SummaryCard title="Control Plane Status" icon={<Server className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatusBadge label={vm.systemStatus} size="md" />
            <StatRow label="Routing" value={vm.routingStatus} />
            <StatRow label="Fast-Start Mode" value={vm.fastStartMode ? "Yes" : "No"} />
            <StatRow label="Approvals Pending" value={vm.pendingApprovals} />
          </div>

          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatRow label="Queued" value={vm.queued} />
            <StatRow label="Processing" value={vm.processing} />
            <StatRow label="Declared Agents" value={vm.declaredAgents} />
            <StatRow label="Worker Capable" value={vm.spawnedWorkerCapableCount} />
          </div>

          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatRow label="Service Available" value={vm.serviceAvailableCount} />
            <StatRow label="Service Installed" value={vm.serviceInstalledCount} />
            <StatRow label="Service Running" value={vm.serviceRunningCount} />
            <StatRow label="Service Operational" value={vm.serviceOperationalCount} />
          </div>

          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatRow label="Self-Healing Total" value={vm.selfHealingTotal} />
            <StatRow label="Active Repairs" value={vm.activeRepairs} />
            <StatRow label="Verified Repairs" value={vm.verifiedRepairs} />
            <StatRow label="Failed Repairs" value={vm.failedRepairs} />
            {vm.lastDetectedAt && <StatRow label="Last Detected" value={new Date(vm.lastDetectedAt).toLocaleString()} />}
            {vm.lastVerifiedAt && <StatRow label="Last Verified" value={new Date(vm.lastVerifiedAt).toLocaleString()} />}
          </div>
        </div>
      </SummaryCard>

      <SummaryCard title="Dependencies" icon={<Network className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatusBadge label={vm.persistenceStatus} size="sm" />
            <StatRow label="Database" value={vm.persistenceDatabase ? "Connected" : "Unavailable"} />
            <StatRow label="Collections" value={vm.persistenceCollections} />
          </div>

          <div className="console-inset p-3 rounded-sm space-y-2">
            <StatRow label="Indexed Entries" value={vm.knowledgeIndexedEntries} />
            <StatRow label="Concepts" value={vm.knowledgeConceptCount} />
            <StatRow label="Verified Repairs" value={vm.selfHealingVerified} />
            <StatRow label="Failed Self-Healing" value={vm.selfHealingFailed} />
          </div>
        </div>
      </SummaryCard>

      {apiKeyExpires && (
        <div className="console-inset p-3 rounded-sm">
          <p className="text-[10px] font-mono text-muted-foreground">
            Operator key expiry: <span className="text-foreground">{new Date(apiKeyExpires).toLocaleString()}</span>
          </p>
        </div>
      )}
    </div>
  );
}
