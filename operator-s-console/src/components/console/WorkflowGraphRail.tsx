import { StatusBadge } from "@/components/console/StatusBadge";
import type { RunRowVM } from "@/lib/task-runs";
import { str, toArray } from "@/lib/safe-render";

const STAGE_ORDER = ["ingress", "queue", "approval", "agent", "result", "proof", "repair"] as const;

function formatDuration(durationMs: number | null | undefined) {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) return "—";
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`;
}

export function WorkflowGraphRail({ run }: { run: RunRowVM }) {
  if (!run.workflowGraph) return null;

  const nodes = toArray<Record<string, unknown>>(run.workflowGraph.nodes);
  const stageNodes = nodes.filter((node) => str(node.kind, "") !== "event");
  const eventNodes = nodes.filter((node) => str(node.kind, "") === "event");
  const supplementalNodes = stageNodes.filter((node) => !STAGE_ORDER.includes(str(node.stage, "") as typeof STAGE_ORDER[number]));
  const causalLinks = toArray<Record<string, unknown>>(run.workflowGraph.causalLinks);
  const stageEvents = STAGE_ORDER.map((stage) => ({
    stage,
    stageNode: stageNodes.find((node) => str(node.stage, "") === stage) ?? null,
    events: eventNodes.filter((node) => str(node.stage, "") === stage),
    timing: run.workflow.timingBreakdown[stage] ?? null,
  })).filter((section) => section.stageNode || section.events.length > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="console-inset p-3 rounded-sm">
          <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Stop Classification</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {run.workflow.stopClassification && <StatusBadge label={run.workflow.stopClassification} size="sm" />}
            {run.workflow.graphStatus && <StatusBadge label={run.workflow.graphStatus} size="sm" />}
            {run.workflow.blockedStage && <StatusBadge label={`blocked:${run.workflow.blockedStage}`} size="sm" />}
          </div>
          <p className="mt-2 text-[10px] font-mono text-foreground leading-relaxed">
            {run.workflow.stopReason ?? "This run is currently progressing without a terminal stop condition."}
          </p>
        </div>
        <div className="console-inset p-3 rounded-sm">
          <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Graph Density</p>
          <p className="mt-2 text-[11px] font-mono text-foreground">
            {run.workflow.nodeCount} nodes · {run.workflow.edgeCount} edges · {causalLinks.length} causal
          </p>
          <p className="mt-2 text-[10px] font-mono text-muted-foreground leading-relaxed">
            Canonical graph from orchestrator run routes. Stages, event nodes, and proof links are all derived server-side.
          </p>
        </div>
        <div className="console-inset p-3 rounded-sm">
          <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Stage Coverage</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stageEvents.map((section) => (
              <span
                key={section.stage}
                className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground"
              >
                {section.stage} · {section.events.length} ev
              </span>
            ))}
            {supplementalNodes.map((node, index) => (
              <span
                key={str(node.id, `supplemental-${index}`)}
                className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground"
              >
                {str(node.kind, "node")} · {str(node.label, "unnamed")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {stageEvents.map((section) => (
          <div key={section.stage} className="console-inset p-3 rounded-sm space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-foreground">
                  {str(section.stageNode?.label, section.stage)}
                </p>
                <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {str(section.stageNode?.detail, "No stage detail recorded.")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {section.stageNode?.status && <StatusBadge label={str(section.stageNode.status, "pending")} size="sm" />}
                {section.timing && <StatusBadge label={formatDuration(section.timing.durationMs)} size="sm" />}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="activity-cell px-2 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Started</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {section.timing?.startedAt ? new Date(section.timing.startedAt).toLocaleTimeString() : "—"}
                </p>
              </div>
              <div className="activity-cell px-2 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Completed</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {section.timing?.completedAt ? new Date(section.timing.completedAt).toLocaleTimeString() : "—"}
                </p>
              </div>
              <div className="activity-cell px-2 py-2">
                <p className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">Events</p>
                <p className="mt-1 text-[10px] font-mono text-foreground">
                  {section.timing?.eventCount ?? section.events.length}
                </p>
              </div>
            </div>

            {section.events.length > 0 ? (
              <div className="space-y-2">
                {section.events.map((node, index) => (
                  <div key={str(node.id, `${section.stage}-event-${index}`)} className="activity-cell px-3 py-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                        {str(node.label, "event")}
                      </span>
                      <div className="flex items-center gap-2">
                        {node.status && <StatusBadge label={str(node.status, "pending")} size="sm" />}
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {node.timestamp ? new Date(String(node.timestamp)).toLocaleString() : "—"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                      {str(node.detail, "No event detail recorded.")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="activity-cell px-3 py-2">
                <p className="text-[10px] font-mono text-muted-foreground">
                  No event nodes were emitted for this stage.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-2">
        <div className="console-inset p-3 rounded-sm space-y-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Causal Links</p>
          {causalLinks.length > 0 ? (
            causalLinks.map((link, index) => (
              <div key={str(link.id, `causal-${index}`)} className="activity-cell px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-foreground uppercase tracking-wide">
                    {str(link.from, "from")} → {str(link.to, "to")}
                  </span>
                  <div className="flex gap-2">
                    {link.relationship && <StatusBadge label={str(link.relationship, "related")} size="sm" />}
                    {link.classification && <StatusBadge label={str(link.classification, "runtime")} size="sm" />}
                  </div>
                </div>
                <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {str(link.detail, "No causal detail recorded.")}
                </p>
              </div>
            ))
          ) : (
            <div className="activity-cell px-3 py-2">
              <p className="text-[10px] font-mono text-muted-foreground">No causal links were emitted for this run.</p>
            </div>
          )}
        </div>

        <div className="console-inset p-3 rounded-sm space-y-2">
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Supplemental Nodes</p>
          {supplementalNodes.length > 0 ? (
            supplementalNodes.map((node, index) => (
              <div key={str(node.id, `supplemental-node-${index}`)} className="activity-cell px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                    {str(node.label, "unnamed")}
                  </span>
                  <div className="flex gap-2">
                    <StatusBadge label={str(node.kind, "node")} size="sm" />
                    {node.status && <StatusBadge label={str(node.status, "live")} size="sm" />}
                  </div>
                </div>
                <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {str(node.detail, "No node detail recorded.")}
                </p>
              </div>
            ))
          ) : (
            <div className="activity-cell px-3 py-2">
              <p className="text-[10px] font-mono text-muted-foreground">
                No tool, dependency, proof, or verification nodes were attached to this run.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
