import { StatusBadge } from "@/components/console/StatusBadge";
import { JsonRenderer } from "@/components/console/JsonRenderer";
import { RunRowVM, buildTimelineEvents } from "@/lib/task-runs";
import { WorkflowGraphRail } from "@/components/console/WorkflowGraphRail";
import { Loader2, AlertTriangle } from "lucide-react";
import { str, toArray, toNullableString } from "@/lib/safe-render";
import { useMemo } from "react";

function TimelineTone({ tone }: { tone: "healthy" | "warning" | "error" | "info" | "neutral" }) {
  const className =
    tone === "healthy"
      ? "bg-status-healthy"
      : tone === "warning"
        ? "bg-status-warning"
        : tone === "error"
          ? "bg-status-error"
          : tone === "info"
            ? "bg-status-info"
            : "bg-muted-foreground";

  return <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${className}`} />;
}

function buildSpecialistContractVM(runResult?: unknown) {
  const raw =
    runResult && typeof runResult === "object"
      ? (runResult as {
          operatorSummary?: unknown;
          recommendedNextActions?: unknown;
          specialistContract?: Record<string, unknown>;
        })
      : null;

  if (!raw) return null;

  const contract =
    raw.specialistContract && typeof raw.specialistContract === "object"
      ? raw.specialistContract
      : null;
  const operatorSummary = str(contract?.operatorSummary ?? raw.operatorSummary, "");
  const recommendedNextActions = toArray<string>(
    contract?.recommendedNextActions ?? raw.recommendedNextActions,
  )
    .map((entry) => str(entry, ""))
    .filter(Boolean);

  if (!operatorSummary && recommendedNextActions.length === 0 && !contract) {
    return null;
  }

  return {
    workflowStage: str(contract?.workflowStage, "runtime"),
    status: str(contract?.status, "unknown"),
    operatorSummary,
    recommendedNextActions,
  };
}

function buildKnowledgeFreshnessVM(runResult?: unknown) {
  const raw =
    runResult && typeof runResult === "object"
      ? (runResult as { knowledgeFreshness?: Record<string, unknown> })
      : null;
  const freshness =
    raw?.knowledgeFreshness && typeof raw.knowledgeFreshness === "object"
      ? raw.knowledgeFreshness
      : null;

  if (!freshness) return null;

  return {
    status: str(freshness.status, "unknown"),
    reviewRecommended: freshness.reviewRecommended === true,
    warnings: toArray<string>(freshness.warnings).map((entry) => str(entry, "")).filter(Boolean),
    packGeneratedAt: toNullableString(freshness.packGeneratedAt),
    docsLatestModifiedAt: toNullableString(freshness.docsLatestModifiedAt),
    packAgeHours:
      typeof freshness.packAgeHours === "number" ? freshness.packAgeHours : null,
  };
}

export function TaskRunDetailContent({
  run,
  runResult,
  isLoading,
}: {
  run: RunRowVM | null;
  runResult?: unknown;
  isLoading?: boolean;
}) {
  const timelineEvents = useMemo(() => (run ? buildTimelineEvents(run) : []), [run]);
  const specialistContract = useMemo(() => buildSpecialistContractVM(runResult), [runResult]);
  const knowledgeFreshness = useMemo(() => buildKnowledgeFreshnessVM(runResult), [runResult]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <p className="text-sm text-muted-foreground font-mono text-center py-4">
        Run not found.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Type</p>
            <p className="text-[11px] font-mono font-bold text-foreground mt-0.5">{run.type}</p>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Status</p>
            <div className="mt-0.5"><StatusBadge label={run.status} size="sm" /></div>
          </div>
        </div>

        {run.createdAt && (
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Created</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">{new Date(run.createdAt).toLocaleString()}</p>
          </div>
        )}

        {run.startedAt && (
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Started</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">{new Date(run.startedAt).toLocaleString()}</p>
          </div>
        )}

        {run.completedAt && (
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Completed</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">{new Date(run.completedAt).toLocaleString()}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Attempt</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">{run.attempt || 1}</p>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Max Retries</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">{run.maxRetries}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Model</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">
              {run.model ?? "local-only"}
            </p>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Cost</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">
              ${run.cost.toFixed(6)}
            </p>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Latency</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">
              {run.latency !== null ? `${Math.round(run.latency)}ms` : "—"}
            </p>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Tokens</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">
              {run.usage?.totalTokens ?? 0}
            </p>
          </div>
        </div>

        {(run.budget || run.accounting?.note) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Budget Status</p>
              <div className="mt-0.5">
                <StatusBadge
                  label={str((run.budget as { status?: unknown } | null)?.status, "unknown")}
                  size="sm"
                />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-2">
                Remaining calls: {str((run.budget as { remainingLlmCalls?: unknown } | null)?.remainingLlmCalls, "—")}
                {" · "}
                Remaining tokens: {str((run.budget as { remainingTokens?: unknown } | null)?.remainingTokens, "—")}
              </p>
            </div>
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Accounting Note</p>
              <p className="text-[10px] font-mono text-foreground mt-1 leading-relaxed">
                {str((run.accounting as { note?: unknown } | null)?.note, "No additional accounting note recorded.")}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Workflow Stage</p>
            <div className="mt-0.5">
              <StatusBadge label={run.workflow.stage ?? run.status} size="sm" />
            </div>
          </div>
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Approval State</p>
            <p className="text-[11px] font-mono text-foreground mt-0.5">
              {run.approval.required ? run.approval.status ?? "required" : "not required"}
            </p>
          </div>
        </div>

        {(run.workflow.nextRetryAt || run.approval.requestedAt || run.approval.decidedAt) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Approval Requested</p>
              <p className="text-[11px] font-mono text-foreground mt-0.5">
                {run.approval.requestedAt ? new Date(run.approval.requestedAt).toLocaleString() : "—"}
              </p>
            </div>
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Approval Decided</p>
              <p className="text-[11px] font-mono text-foreground mt-0.5">
                {run.approval.decidedAt ? new Date(run.approval.decidedAt).toLocaleString() : "—"}
              </p>
            </div>
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Next Retry</p>
              <p className="text-[11px] font-mono text-foreground mt-0.5">
                {run.workflow.nextRetryAt ? new Date(run.workflow.nextRetryAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>
        )}

        <div className="console-inset p-2">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Replay View</p>
          <p className="text-[10px] font-mono text-foreground mt-1 leading-relaxed">
            This replay now uses orchestrator workflow events, approval state, retry scheduling, history entries, and linked repair records.
          </p>
        </div>

        {(run.workflow.graphStatus || run.workflow.currentStage || run.workflow.blockedStage || run.workflow.stopReason) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Graph Status</p>
              <div className="mt-0.5 flex flex-wrap gap-2">
                {run.workflow.graphStatus && <StatusBadge label={run.workflow.graphStatus} size="sm" />}
                {run.workflow.currentStage && <StatusBadge label={run.workflow.currentStage} size="sm" />}
                {run.workflow.blockedStage && <StatusBadge label={run.workflow.blockedStage} size="sm" />}
                {run.workflow.stopClassification && <StatusBadge label={run.workflow.stopClassification} size="sm" />}
              </div>
              {run.workflow.stopReason && (
                <p className="text-[10px] font-mono text-status-warning mt-2 leading-relaxed">
                  {run.workflow.stopReason}
                </p>
              )}
            </div>
            <div className="console-inset p-2">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Graph Density</p>
              <p className="text-[11px] font-mono text-foreground mt-0.5">
                {run.workflow.nodeCount} nodes · {run.workflow.edgeCount} edges
              </p>
              {(Object.keys(run.workflow.stageDurations).length > 0 || Object.keys(run.workflow.timingBreakdown).length > 0) && (
                <div className="mt-2 space-y-1">
                  {Object.entries(run.workflow.timingBreakdown).map(([stage, timing]) => (
                    <div key={stage} className="flex items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
                      <span className="uppercase tracking-wider">{stage}</span>
                      <span className="text-foreground">
                        {typeof timing?.durationMs === "number" ? `${Math.round(timing.durationMs)}ms` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {run.approval.note && (
          <div className="console-inset p-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Operator Note</p>
            <p className="text-[10px] font-mono text-foreground mt-1 leading-relaxed">{run.approval.note}</p>
          </div>
        )}

        {run.error && (
          <div className="warning-banner">
            <AlertTriangle className="w-3.5 h-3.5 text-status-error shrink-0" />
            <p className="text-[10px] font-mono text-status-error">{run.error}</p>
          </div>
        )}

        {specialistContract && (
          <div className="console-inset p-3 rounded-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Operator Summary</p>
              <div className="flex gap-2">
                <StatusBadge label={specialistContract.status} size="sm" />
                <StatusBadge label={specialistContract.workflowStage} size="sm" />
              </div>
            </div>
            <p className="text-[10px] font-mono text-foreground leading-relaxed">
              {specialistContract.operatorSummary || "No operator summary recorded."}
            </p>
            {specialistContract.recommendedNextActions.length > 0 && (
              <div className="space-y-1">
                {specialistContract.recommendedNextActions.map((entry, index) => (
                  <p
                    key={`operator-action-${index}`}
                    className="text-[10px] font-mono text-muted-foreground leading-relaxed"
                  >
                    {index + 1}. {entry}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {knowledgeFreshness && (knowledgeFreshness.reviewRecommended || knowledgeFreshness.warnings.length > 0) && (
          <div className="warning-banner">
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">
                  Knowledge Freshness
                </p>
                <StatusBadge label={knowledgeFreshness.status} size="sm" />
              </div>
              {knowledgeFreshness.packGeneratedAt && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  Pack generated: {new Date(knowledgeFreshness.packGeneratedAt).toLocaleString()}
                  {knowledgeFreshness.packAgeHours != null ? ` · age ${knowledgeFreshness.packAgeHours.toFixed(1)}h` : ""}
                </p>
              )}
              {knowledgeFreshness.docsLatestModifiedAt && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  Latest docs mirror change: {new Date(knowledgeFreshness.docsLatestModifiedAt).toLocaleString()}
                </p>
              )}
              {knowledgeFreshness.warnings.map((warning, index) => (
                <p key={`freshness-warning-${index}`} className="text-[10px] font-mono text-status-warning leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        )}

        {timelineEvents.length > 0 && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Execution Timeline</p>
            <div className="space-y-2">
              {timelineEvents.map((event, index) => (
                <div key={event.key} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <TimelineTone tone={event.tone} />
                    {index < timelineEvents.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border/80 min-h-[28px]" />
                    )}
                  </div>
                  <div className="console-inset p-3 rounded-sm flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                        {event.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : "No timestamp"}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1 leading-relaxed">
                      {event.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {run.workflowGraph && (
          <div className="space-y-2">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Workflow Graph</p>
            <WorkflowGraphRail run={run} />
            <div className="grid grid-cols-1 gap-2 2xl:grid-cols-3">
              <div className="console-inset p-3 rounded-sm">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Edges</p>
                <div className="mt-2 space-y-2">
                  {toArray<Record<string, unknown>>(run.workflowGraph.edges).map((edge, index) => (
                    <div key={str(edge.id, `edge-${index}`)} className="activity-cell px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-foreground uppercase tracking-wide">
                          {str(edge.from, "from")} → {str(edge.to, "to")}
                        </span>
                        <StatusBadge label={str(edge.status, "declared")} size="sm" />
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                        {str(edge.detail, "No edge detail recorded.")}
                      </p>
                      {edge.relationship && (
                        <p className="mt-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                          relationship: {str(edge.relationship, "related")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="console-inset p-3 rounded-sm">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Causal Links</p>
                <div className="mt-2 space-y-2">
                  {toArray<Record<string, unknown>>(run.workflowGraph.causalLinks).map((link, index) => (
                    <div key={str(link.id, `causal-link-${index}`)} className="activity-cell px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
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
                  ))}
                  {toArray<Record<string, unknown>>(run.workflowGraph.causalLinks).length === 0 && (
                    <div className="activity-cell px-3 py-2">
                      <p className="text-[10px] font-mono text-muted-foreground">No causal links were emitted for this run.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="console-inset p-3 rounded-sm">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Workflow Events</p>
                <div className="mt-2 space-y-2">
                  {toArray<Record<string, unknown>>(run.workflowGraph.events).map((event, index) => (
                    <div key={str(event.eventId, `graph-event-${index}`)} className="activity-cell px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                          {str(event.stage, "event")} · {str(event.state, "unknown")}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {event.timestamp ? new Date(String(event.timestamp)).toLocaleTimeString() : "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                        {str(event.detail, "No event detail recorded.")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {event.source && (
                          <span className="activity-cell px-2 py-1 text-[8px] font-mono uppercase tracking-wide text-muted-foreground">
                            src:{str(event.source, "runtime")}
                          </span>
                        )}
                        {event.actor && (
                          <span className="activity-cell px-2 py-1 text-[8px] font-mono uppercase tracking-wide text-muted-foreground">
                            actor:{str(event.actor, "system")}
                          </span>
                        )}
                        {event.toolId && (
                          <span className="activity-cell px-2 py-1 text-[8px] font-mono uppercase tracking-wide text-muted-foreground">
                            tool:{str(event.toolId, "unknown")}
                          </span>
                        )}
                        {event.proofTransport && (
                          <span className="activity-cell px-2 py-1 text-[8px] font-mono uppercase tracking-wide text-muted-foreground">
                            proof:{str(event.proofTransport, "transport")}
                          </span>
                        )}
                        {event.classification && (
                          <span className="activity-cell px-2 py-1 text-[8px] font-mono uppercase tracking-wide text-muted-foreground">
                            class:{str(event.classification, "runtime")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {run.proofLinks.length > 0 && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Proof Links</p>
            <div className="space-y-2">
              {run.proofLinks.map((link, index) => (
                <div key={str(link.id, `proof-${index}`)} className="console-inset p-3 rounded-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-foreground">
                      {str(link.type, "proof")}
                    </span>
                    <StatusBadge label={str(link.status, "pending")} size="sm" />
                  </div>
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground leading-relaxed">
                    {str(link.summary, "No proof summary recorded.")}
                  </p>
                  {toNullableString(link.lastAttemptAt) && (
                    <p className="mt-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                      Last attempt {new Date(String(link.lastAttemptAt)).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {run.repair && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Repair Metadata</p>
            <JsonRenderer data={run.repair} maxHeight="none" />
          </div>
        )}

        {run.history.length > 0 && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Execution History</p>
            <div className="space-y-2">
              {run.history.map((entry, index) => (
                <div key={index} className="console-inset p-3 rounded-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-foreground uppercase tracking-wide">
                      {str(entry.result, "unknown")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {toNullableString(entry.handledAt) ? new Date(String(entry.handledAt)).toLocaleString() : "—"}
                    </span>
                  </div>
                  {toNullableString(entry.message) && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{String(entry.message)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {runResult && (
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Result</p>
            <JsonRenderer data={runResult} maxHeight="220px" />
          </div>
        )}
    </div>
  );
}
