import { StatusBadge } from "@/components/console/StatusBadge";
import type { AgentTopology } from "@/types/console";
import { str, toArray } from "@/lib/safe-render";

const NODE_KIND_LABELS: Record<string, string> = {
  "control-plane": "Control",
  task: "Tasks",
  agent: "Agents",
  skill: "Skills",
  surface: "Surfaces",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  "dispatches-task": "Dispatch",
  "routes-to-agent": "Route",
  "uses-skill": "Skill",
  "publishes-proof": "Proof",
  "feeds-agent": "Feeds",
  "verifies-agent": "Verifies",
  "monitors-agent": "Monitors",
  "audits-agent": "Audits",
  "coordinates-agent": "Coordinates",
};

export function TopologyRelationshipView({ topology }: { topology: AgentTopology }) {
  const nodes = toArray(topology.nodes);
  const edges = toArray(topology.edges);
  const nodeGroups = Object.entries(
    nodes.reduce<Record<string, typeof nodes>>((acc, node) => {
      const key = str(node.kind, "other");
      acc[key] = [...(acc[key] ?? []), node];
      return acc;
    }, {}),
  );
  const edgeGroups = Object.entries(
    edges.reduce<Record<string, typeof edges>>((acc, edge) => {
      const key = str(edge.relationship, "related");
      acc[key] = [...(acc[key] ?? []), edge];
      return acc;
    }, {}),
  ).sort((left, right) => right[1].length - left[1].length);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-xl">{topology.counts.totalNodes ?? 0}</p>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Nodes</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-xl">{topology.counts.totalEdges ?? 0}</p>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Edges</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-xl">{topology.counts.routeEdges ?? 0}</p>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Route</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-xl">{topology.counts.relationshipEdges ?? 0}</p>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Relations</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-xl">{topology.counts.proofEdges ?? 0}</p>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Proof</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-2">
        <div className="console-inset p-3 rounded-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Relationship Lanes
            </p>
            <StatusBadge label={topology.status} size="sm" />
          </div>
          <div className="space-y-2">
            {edgeGroups.map(([relationship, relationshipEdges]) => (
              <div key={relationship} className="console-inset p-3 rounded-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                    {RELATIONSHIP_LABELS[relationship] ?? relationship}
                  </p>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    {relationshipEdges.length} edges
                  </span>
                </div>
                <div className="space-y-1.5">
                  {relationshipEdges.slice(0, 6).map((edge) => (
                    <div key={edge.id} className="activity-cell px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-foreground uppercase tracking-wide">
                          {edge.from} → {edge.to}
                        </span>
                        <StatusBadge label={edge.status} size="sm" />
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                        {edge.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="console-inset p-3 rounded-sm space-y-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Node Atlas
          </p>
          <div className="space-y-2">
            {nodeGroups.map(([kind, kindNodes]) => (
              <div key={kind} className="console-inset p-3 rounded-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                    {NODE_KIND_LABELS[kind] ?? kind}
                  </p>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    {kindNodes.length} nodes
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {kindNodes.slice(0, 12).map((node) => (
                    <div key={node.id} className="activity-cell px-2.5 py-2 min-w-[140px] max-w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground truncate">
                          {node.label}
                        </span>
                        <StatusBadge label={node.status} size="sm" />
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed line-clamp-2">
                        {node.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
