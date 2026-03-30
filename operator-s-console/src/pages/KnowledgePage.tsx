import { useMemo, useState } from "react";
import { Brain, Database, Network, Search, Clock, RefreshCw } from "lucide-react";
import { SummaryCard, MetricModule } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import { JsonRenderer } from "@/components/console/JsonRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentsOverview, useKnowledgeQuery, useKnowledgeSummary, useMemoryRecall } from "@/hooks/use-console-api";
import { num, str, toArray, toNullableString } from "@/lib/safe-render";

interface KnowledgeSummaryVM {
  lastUpdated: string | null;
  totalEntries: number;
  criticalEntries: number;
  recentUpdates: number;
  totalConcepts: number;
  totalLinks: number;
  avgConnectivity: string;
  topIssues: Array<Record<string, unknown>>;
  recentLearnings: Array<Record<string, unknown>>;
  freshnessStatus: string;
  staleAfterHours: number;
  latestEntryUpdatedAt: string | null;
  indexedDocs: number;
  docIndexVersion: number;
  entryToDocRatio: string;
  unknownProvenanceCount: number;
  provenanceBySourceType: Array<{ label: string; count: number }>;
  coverageSignals: Array<Record<string, unknown>>;
  stalenessSignals: Array<Record<string, unknown>>;
  repairSignals: Array<Record<string, unknown>>;
  contradictionSignals: Array<Record<string, unknown>>;
  repairLoop: {
    status: string;
    recommendedTaskType: string;
    contradictionCount: number;
    unknownProvenanceCount: number;
    freshnessStatus: string;
    openKnowledgeIncidents: number;
    focusAreas: string[];
    nextActions: string[];
    lastDriftRepairAt: string | null;
  };
  provenanceGraph: {
    totalNodes: number;
    totalEdges: number;
    hotspots: string[];
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  contradictionGraph: {
    contradictionCount: number;
    hotspots: string[];
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  freshnessGraph: {
    score: number;
    status: string;
    hotspots: string[];
    bands: Record<string, number>;
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
}

function normalizeKnowledgeSourceLabel(source: unknown, index: number): string {
  if (typeof source === "string" && source.trim().length > 0) return source;
  if (typeof source === "number" || typeof source === "boolean") return String(source);
  if (source && typeof source === "object") {
    const candidate = source as Record<string, unknown>;
    return str(
      candidate.label ??
        candidate.title ??
        candidate.id ??
        candidate.name ??
        candidate.sourceType ??
        candidate.path,
      `source-${index + 1}`,
    );
  }
  return `source-${index + 1}`;
}

function buildKnowledgeSummaryVM(data: any): KnowledgeSummaryVM {
  const graphs = data?.runtime?.graphs ?? data?.diagnostics?.graphs ?? {};
  const stats = data?.stats ?? {};
  const networkStats = data?.networkStats ?? {};
  const provenanceBySourceType = Object.entries(
    data?.diagnostics?.provenance?.bySourceType ?? {},
  ).map(([label, count]) => ({
    label: str(label, "unknown"),
    count: num(count),
  }));

  return {
    lastUpdated: toNullableString(data?.lastUpdated),
    totalEntries: num(stats?.total),
    criticalEntries: toArray(stats?.criticalEntries).length,
    recentUpdates: toArray(stats?.recentUpdates).length,
    totalConcepts: num(networkStats?.totalConcepts),
    totalLinks: num(networkStats?.totalLinks),
    avgConnectivity:
      typeof networkStats?.avgConnectivity === "number"
        ? networkStats.avgConnectivity.toFixed(2)
        : "0.00",
    topIssues: toArray<Record<string, unknown>>(data?.topIssues),
    recentLearnings: toArray<Record<string, unknown>>(data?.recentLearnings),
    freshnessStatus: str(data?.runtime?.freshness?.status ?? data?.diagnostics?.freshness?.status, "empty"),
    staleAfterHours: num(data?.runtime?.freshness?.staleAfterHours ?? data?.diagnostics?.freshness?.staleAfterHours),
    latestEntryUpdatedAt: toNullableString(
      data?.runtime?.freshness?.latestEntryUpdatedAt ?? data?.diagnostics?.freshness?.latestEntryUpdatedAt
    ),
    indexedDocs: num(data?.runtime?.index?.indexedDocs),
    docIndexVersion: num(data?.runtime?.index?.docIndexVersion),
    entryToDocRatio:
      typeof data?.runtime?.coverage?.entryToDocRatio === "number"
        ? data.runtime.coverage.entryToDocRatio.toFixed(4)
        : "0.0000",
    unknownProvenanceCount: num(data?.diagnostics?.provenance?.unknownProvenanceCount),
    provenanceBySourceType,
    coverageSignals: toArray<Record<string, unknown>>(data?.runtime?.signals?.coverage),
    stalenessSignals: toArray<Record<string, unknown>>(data?.runtime?.signals?.staleness),
    repairSignals: toArray<Record<string, unknown>>(data?.runtime?.signals?.repair),
    contradictionSignals: toArray<Record<string, unknown>>(data?.runtime?.signals?.contradictions ?? data?.diagnostics?.contradictionSignals),
    repairLoop: {
      status: str(data?.runtime?.repairLoop?.status, "clear"),
      recommendedTaskType: str(data?.runtime?.repairLoop?.recommendedTaskType, "drift-repair"),
      contradictionCount: num(data?.runtime?.repairLoop?.contradictionCount),
      unknownProvenanceCount: num(data?.runtime?.repairLoop?.unknownProvenanceCount),
      freshnessStatus: str(data?.runtime?.repairLoop?.freshnessStatus, "empty"),
      openKnowledgeIncidents: num(data?.runtime?.repairLoop?.openKnowledgeIncidents),
      focusAreas: toArray<string>(data?.runtime?.repairLoop?.focusAreas).map((entry) => str(entry, "")),
      nextActions: toArray<string>(data?.runtime?.repairLoop?.nextActions).map((entry) => str(entry, "")),
      lastDriftRepairAt: toNullableString(data?.runtime?.repairLoop?.lastDriftRepairAt),
    },
    provenanceGraph: {
      totalNodes: num(graphs?.provenance?.totalNodes),
      totalEdges: num(graphs?.provenance?.totalEdges),
      hotspots: toArray<string>(graphs?.provenance?.hotspots).map((entry) => str(entry, "")),
      nodes: toArray<Record<string, unknown>>(graphs?.provenance?.nodes),
      edges: toArray<Record<string, unknown>>(graphs?.provenance?.edges),
    },
    contradictionGraph: {
      contradictionCount: num(graphs?.contradictions?.contradictionCount),
      hotspots: toArray<string>(graphs?.contradictions?.hotspots).map((entry) => str(entry, "")),
      nodes: toArray<Record<string, unknown>>(graphs?.contradictions?.nodes),
      edges: toArray<Record<string, unknown>>(graphs?.contradictions?.edges),
    },
    freshnessGraph: {
      score: num(graphs?.freshness?.score),
      status: str(graphs?.freshness?.status, "empty"),
      hotspots: toArray<string>(graphs?.freshness?.hotspots).map((entry) => str(entry, "")),
      bands:
        graphs?.freshness?.bands && typeof graphs.freshness.bands === "object"
          ? graphs.freshness.bands as Record<string, number>
          : {},
      nodes: toArray<Record<string, unknown>>(graphs?.freshness?.nodes),
      edges: toArray<Record<string, unknown>>(graphs?.freshness?.edges),
    },
  };
}

export default function KnowledgePage() {
  const [query, setQuery] = useState("proof pipeline health");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [memoryLimit, setMemoryLimit] = useState("10");

  const { data: knowledgeSummary, isLoading: knowledgeLoading } = useKnowledgeSummary();
  const { data: agentsData } = useAgentsOverview();
  const knowledgeQuery = useKnowledgeQuery();
  const memoryRecall = useMemoryRecall({
    agentId: selectedAgent === "all" ? undefined : selectedAgent,
    limit: Number(memoryLimit),
    includeErrors: true,
  });

  const summary = useMemo(() => buildKnowledgeSummaryVM(knowledgeSummary), [knowledgeSummary]);
  const agents = useMemo(
    () =>
      toArray(agentsData?.agents).map((agent: any) => ({
        id: str(agent?.id, ""),
        name: str(agent?.name, str(agent?.id, "unknown")),
      })),
    [agentsData],
  );
  const querySourceLabels = useMemo(
    () => toArray(knowledgeQuery.data?.sources).map((source, index) => normalizeKnowledgeSourceLabel(source, index)),
    [knowledgeQuery.data?.sources],
  );

  const handleQuerySubmit = () => {
    if (!query.trim()) return;
    knowledgeQuery.mutate({ query: query.trim(), limit: 5 });
  };

  return (
    <div className="space-y-5">
      <h2 className="page-title">Knowledge</h2>

      <div className="console-inset p-3">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <Brain className="w-3 h-3 inline mr-1.5 text-primary" />
          Knowledge Atlas combines public summary, protected query, and per-agent memory recall.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricModule
          title="KB Entries"
          icon={<Database className="w-4 h-4" />}
          value={summary.totalEntries}
          subtitle="Indexed Records"
        />
        <MetricModule
          title="Critical Issues"
          icon={<Search className="w-4 h-4" />}
          value={summary.criticalEntries}
          subtitle="Priority Items"
          glow={summary.criticalEntries > 0}
        />
        <MetricModule
          title="Concept Graph"
          icon={<Network className="w-4 h-4" />}
          value={summary.totalConcepts}
          subtitle="Concept Nodes"
        />
        <MetricModule
          title="Recent Updates"
          icon={<Clock className="w-4 h-4" />}
          value={summary.recentUpdates}
          subtitle="Fresh Learnings"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricModule
          title="Indexed Docs"
          icon={<Database className="w-4 h-4" />}
          value={summary.indexedDocs}
          subtitle="Document Roots"
        />
        <MetricModule
          title="Freshness"
          icon={<RefreshCw className="w-4 h-4" />}
          value={summary.freshnessStatus.toUpperCase()}
          subtitle={`Stale after ${summary.staleAfterHours || 0}h`}
          glow={summary.freshnessStatus === "stale" || summary.freshnessStatus === "aging"}
        />
        <MetricModule
          title="Doc Coverage"
          icon={<Network className="w-4 h-4" />}
          value={summary.entryToDocRatio}
          subtitle="Entries / Indexed Docs"
        />
        <MetricModule
          title="Unknown Provenance"
          icon={<Search className="w-4 h-4" />}
          value={summary.unknownProvenanceCount}
          subtitle="Unclassified Entries"
          glow={summary.unknownProvenanceCount > 0}
        />
      </div>

      <SummaryCard title="Knowledge Repair Loop" icon={<RefreshCw className="w-4 h-4" />}>
        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-3">
          <div className="console-inset p-3 rounded-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Repair Posture
              </p>
              <StatusBadge label={summary.repairLoop.status} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Task Type</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {summary.repairLoop.recommendedTaskType}
                </p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Open Incidents</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {summary.repairLoop.openKnowledgeIncidents}
                </p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Contradictions</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {summary.repairLoop.contradictionCount}
                </p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Freshness</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {summary.repairLoop.freshnessStatus}
                </p>
              </div>
            </div>
            <div className="activity-cell px-3 py-2">
              <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Last Drift Repair</p>
              <p className="mt-1 text-[10px] font-mono text-foreground">
                {summary.repairLoop.lastDriftRepairAt
                  ? new Date(summary.repairLoop.lastDriftRepairAt).toLocaleString()
                  : "No repair recorded"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="console-inset p-3 rounded-sm space-y-2">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Focus Areas</p>
              {summary.repairLoop.focusAreas.length > 0 ? (
                summary.repairLoop.focusAreas.map((entry, index) => (
                  <div key={`focus-${index}`} className="activity-cell px-3 py-2">
                    <p className="text-[10px] font-mono text-foreground">{entry}</p>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground">No active focus areas.</p>
              )}
            </div>
            <div className="console-inset p-3 rounded-sm space-y-2">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Next Actions</p>
              {summary.repairLoop.nextActions.length > 0 ? (
                summary.repairLoop.nextActions.map((entry, index) => (
                  <div key={`repair-action-${index}`} className="activity-cell px-3 py-2">
                    <p className="text-[10px] font-mono text-foreground">{entry}</p>
                  </div>
                ))
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground">No repair actions are currently recommended.</p>
              )}
            </div>
          </div>
        </div>
      </SummaryCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SummaryCard title="Knowledge Summary" icon={<Database className="w-4 h-4" />}>
          {knowledgeLoading ? (
            <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
              Loading knowledge summary...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Last Updated</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">
                    {summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Avg Connectivity</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">{summary.avgConnectivity}</p>
                </div>
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Network Links</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">{summary.totalLinks}</p>
                </div>
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Recent Learnings</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">{summary.recentLearnings.length}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Latest Entry Update</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">
                    {summary.latestEntryUpdatedAt ? new Date(summary.latestEntryUpdatedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="activity-cell p-3">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Doc Index Version</p>
                  <p className="text-[11px] font-mono text-foreground mt-1">{summary.docIndexVersion}</p>
                </div>
              </div>
              {summary.topIssues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">Top Issues</p>
                  {summary.topIssues.slice(0, 3).map((issue, index) => (
                    <div key={index} className="console-inset p-3 rounded-sm">
                      <p className="text-[11px] font-mono font-semibold text-foreground">
                        {str(issue.title, `Issue ${index + 1}`)}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        {str(issue.description, "No description available.")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SummaryCard>

        <SummaryCard title="Knowledge Query" icon={<Search className="w-4 h-4" />}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-panel-inset border-border font-mono text-sm"
                placeholder="Ask the knowledge layer a question..."
              />
              <Button
                onClick={handleQuerySubmit}
                disabled={knowledgeQuery.isPending || !query.trim()}
                className="font-mono text-xs uppercase tracking-wider"
              >
                {knowledgeQuery.isPending ? "Querying..." : "Run Query"}
              </Button>
            </div>
            {knowledgeQuery.isError && (
              <div className="warning-banner">
                <p className="text-[10px] font-mono text-status-error">
                  {(knowledgeQuery.error as Error)?.message || "Knowledge query failed"}
                </p>
              </div>
            )}
            {knowledgeQuery.data && (
              <div className="space-y-3">
                {querySourceLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {querySourceLabels.map((source, index) => (
                      <span
                        key={`${source}-${index}`}
                        className="activity-cell px-2 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wide"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                )}
                {knowledgeQuery.data.meta && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Matched Entries</p>
                      <p className="text-[11px] font-mono text-foreground mt-1">{num(knowledgeQuery.data.meta?.matchedEntries)}</p>
                    </div>
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Freshness</p>
                      <p className="text-[11px] font-mono text-foreground mt-1">
                        {str(knowledgeQuery.data.meta?.freshness?.status, "empty")}
                      </p>
                    </div>
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Contradiction Signals</p>
                      <p className="text-[11px] font-mono text-foreground mt-1">
                        {toArray(knowledgeQuery.data.meta?.contradictionSignals).length}
                      </p>
                    </div>
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Repair Loop</p>
                      <p className="text-[11px] font-mono text-foreground mt-1">
                        {str(knowledgeQuery.data.meta?.repairLoop?.status, "clear")}
                      </p>
                    </div>
                  </div>
                )}
                {knowledgeQuery.data.meta?.repairLoop && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="console-inset p-3 rounded-sm space-y-2">
                      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Repair Focus</p>
                      {toArray<string>(knowledgeQuery.data.meta.repairLoop.focusAreas).length > 0 ? (
                        toArray<string>(knowledgeQuery.data.meta.repairLoop.focusAreas).map((entry, index) => (
                          <div key={`query-focus-${index}`} className="activity-cell px-3 py-2 text-[10px] font-mono text-foreground">
                            {str(entry, "")}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-mono text-muted-foreground">No repair focus areas for this query.</p>
                      )}
                    </div>
                    <div className="console-inset p-3 rounded-sm space-y-2">
                      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Recommended Actions</p>
                      {toArray<string>(knowledgeQuery.data.meta.repairLoop.nextActions).length > 0 ? (
                        toArray<string>(knowledgeQuery.data.meta.repairLoop.nextActions).map((entry, index) => (
                          <div key={`query-next-${index}`} className="activity-cell px-3 py-2 text-[10px] font-mono text-foreground">
                            {str(entry, "")}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-mono text-muted-foreground">No repair actions are currently recommended.</p>
                      )}
                    </div>
                  </div>
                )}
                <JsonRenderer data={knowledgeQuery.data.results} maxHeight="280px" />
              </div>
            )}
          </div>
        </SummaryCard>
      </div>

      <SummaryCard title="Knowledge Graphs" icon={<Network className="w-4 h-4" />}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="console-inset p-3 rounded-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">Provenance</p>
              <StatusBadge label={summary.unknownProvenanceCount > 0 ? "warning" : "stable"} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Nodes</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.provenanceGraph.totalNodes}</p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Edges</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.provenanceGraph.totalEdges}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.provenanceGraph.nodes.slice(0, 8).map((node, index) => (
                <span key={`prov-node-${index}`} className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                  {str(node.label, "node")} · {str(node.kind, "kind")}
                </span>
              ))}
            </div>
            {summary.provenanceGraph.hotspots.length > 0 && summary.provenanceGraph.hotspots.map((hotspot, index) => (
              <p key={`prov-hotspot-${index}`} className="text-[10px] font-mono text-status-warning leading-relaxed">{hotspot}</p>
            ))}
          </div>

          <div className="console-inset p-3 rounded-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">Contradictions</p>
              <StatusBadge label={summary.contradictionGraph.contradictionCount > 0 ? "warning" : "stable"} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Alerts</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.contradictionGraph.contradictionCount}</p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Edges</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.contradictionGraph.edges.length}</p>
              </div>
            </div>
            <div className="space-y-2">
              {summary.contradictionGraph.hotspots.length > 0 ? (
                summary.contradictionGraph.hotspots.map((hotspot, index) => (
                  <div key={`contradiction-hotspot-${index}`} className="activity-cell px-3 py-2">
                    <p className="text-[10px] font-mono text-foreground leading-relaxed">{hotspot}</p>
                  </div>
                ))
              ) : (
                <div className="activity-cell px-3 py-2">
                  <p className="text-[10px] font-mono text-muted-foreground">No contradiction hotspots are active.</p>
                </div>
              )}
            </div>
          </div>

          <div className="console-inset p-3 rounded-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">Freshness</p>
              <StatusBadge label={summary.freshnessGraph.status} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Score</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.freshnessGraph.score}</p>
              </div>
              <div className="activity-cell px-3 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Nodes</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">{summary.freshnessGraph.nodes.length}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.freshnessGraph.bands).map(([band, count]) => (
                <span key={`band-${band}`} className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                  {band}:{count}
                </span>
              ))}
            </div>
            {summary.freshnessGraph.hotspots.length > 0 && summary.freshnessGraph.hotspots.map((hotspot, index) => (
              <p key={`freshness-hotspot-${index}`} className="text-[10px] font-mono text-status-warning leading-relaxed">{hotspot}</p>
            ))}
          </div>
        </div>
      </SummaryCard>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        <SummaryCard title="Coverage Signals" icon={<Database className="w-4 h-4" />}>
          <div className="space-y-2">
            {summary.coverageSignals.length === 0 ? (
              <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
                No coverage warnings.
              </div>
            ) : (
              summary.coverageSignals.map((signal, index) => (
                <div key={str(signal.id, `coverage-${index}`)} className="console-inset p-3 rounded-sm">
                  <p className="text-[10px] font-mono text-foreground">{str(signal.message, "No message recorded.")}</p>
                </div>
              ))
            )}
          </div>
        </SummaryCard>

        <SummaryCard title="Staleness Signals" icon={<Clock className="w-4 h-4" />}>
          <div className="space-y-2">
            {summary.stalenessSignals.length === 0 ? (
              <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
                No staleness warnings.
              </div>
            ) : (
              summary.stalenessSignals.map((signal, index) => (
                <div key={str(signal.id, `staleness-${index}`)} className="console-inset p-3 rounded-sm">
                  <p className="text-[10px] font-mono text-foreground">{str(signal.message, "No message recorded.")}</p>
                </div>
              ))
            )}
          </div>
        </SummaryCard>

        <SummaryCard title="Contradiction Signals" icon={<Search className="w-4 h-4" />}>
          <div className="space-y-2">
            {summary.contradictionSignals.length === 0 ? (
              <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
                No contradiction signals.
              </div>
            ) : (
              summary.contradictionSignals.map((signal, index) => (
                <div key={str(signal.id, `contradiction-${index}`)} className="console-inset p-3 rounded-sm space-y-1.5">
                  <p className="text-[10px] font-mono text-foreground">{str(signal.message, "No message recorded.")}</p>
                  {toArray(signal.kinds).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {toArray(signal.kinds).map((kind) => (
                        <span
                          key={String(kind)}
                          className="activity-cell px-2 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wide"
                        >
                          {String(kind)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SummaryCard>

        <SummaryCard title="Repair Signals" icon={<RefreshCw className="w-4 h-4" />}>
          <div className="space-y-2">
            {summary.repairSignals.length === 0 ? (
              <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
                No repair-loop warnings.
              </div>
            ) : (
              summary.repairSignals.map((signal, index) => (
                <div key={str(signal.id, `repair-${index}`)} className="console-inset p-3 rounded-sm">
                  <p className="text-[10px] font-mono text-foreground">{str(signal.message, "No message recorded.")}</p>
                </div>
              ))
            )}
          </div>
        </SummaryCard>
      </div>

      <SummaryCard title="Provenance Breakdown" icon={<Network className="w-4 h-4" />}>
        <div className="space-y-2">
          {summary.provenanceBySourceType.length === 0 ? (
            <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
              No provenance-classified entries yet.
            </div>
          ) : (
            summary.provenanceBySourceType.map(({ label, count }, index) => (
              <div key={`${label}-${index}`} className="activity-module-row">
                <div className="flex items-center gap-1.5 p-1.5 relative z-10">
                  <div className="activity-cell px-3 py-2 min-w-[180px]">
                    <span className="font-mono text-[10px] text-foreground uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <div className="activity-cell px-3 py-2">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                      {count} entry{count !== 1 ? "ies" : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SummaryCard>

      <SummaryCard title="Agent Memory Recall" icon={<RefreshCw className="w-4 h-4" />}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[220px] h-9 text-xs font-mono bg-panel-inset border-border">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={memoryLimit} onValueChange={setMemoryLimit}>
              <SelectTrigger className="w-[120px] h-9 text-xs font-mono bg-panel-inset border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 items</SelectItem>
                <SelectItem value="10">10 items</SelectItem>
                <SelectItem value="20">20 items</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {memoryRecall.isLoading ? (
            <div className="console-inset p-4 text-center text-[11px] font-mono text-muted-foreground">
              Loading memory recall...
            </div>
          ) : memoryRecall.isError ? (
            <div className="warning-banner">
              <p className="text-[10px] font-mono text-status-error">
                {(memoryRecall.error as Error)?.message || "Memory recall failed"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>Total Agents: {num(memoryRecall.data?.totalAgents)}</span>
                <span>Total Runs: {num(memoryRecall.data?.totalRuns)}</span>
              </div>
              {toArray(memoryRecall.data?.items).map((item, index) => (
                <div key={`${str(item.agentId, "agent")}-${index}`} className="console-inset p-3 rounded-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-foreground">
                        {str(item.agentId, "unknown-agent")}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Last run: {toNullableString(item.lastRunAt) ? new Date(String(item.lastRunAt)).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="flex gap-2 text-[9px] font-mono text-muted-foreground uppercase tracking-wide">
                      <span className="activity-cell px-2 py-1">Status: {str(item.lastStatus, "unknown")}</span>
                      <span className="activity-cell px-2 py-1">Runs: {num(item.totalRuns)}</span>
                      <span className="activity-cell px-2 py-1">Errors: {num(item.errorCount)}</span>
                    </div>
                  </div>
                  <JsonRenderer data={item} maxHeight="220px" />
                </div>
              ))}
              {toArray(memoryRecall.data?.items).length === 0 && (
                <div className="console-inset p-6 text-center">
                  <p className="text-sm text-muted-foreground font-mono">No memory entries found for the selected filter.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SummaryCard>
    </div>
  );
}
