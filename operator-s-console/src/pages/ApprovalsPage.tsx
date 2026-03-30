import { useEffect, useMemo, useState } from "react";
import { usePendingApprovals, useApprovalDecision } from "@/hooks/use-console-api";
import { useAuth } from "@/contexts/AuthContext";
import { SummaryCard } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import { SmartValue } from "@/components/console/JsonRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, CheckCircle2, XCircle, Inbox, Loader2, PanelRightOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { num, str, toArray } from "@/lib/safe-render";

interface ApprovalRowVM {
  taskId: string;
  type: string;
  status: string;
  requestedAt: string;
  payload: Record<string, unknown> | null;
  payloadKeys: string[];
  impact: Record<string, unknown> | null;
  payloadPreview: Record<string, unknown> | null;
  riskLevel: string;
  dependencyClass: string;
  internalOnly: boolean;
  publicTriggerable: boolean;
}

function buildApprovalRows(data: any): ApprovalRowVM[] {
  return toArray(data?.pending).map((item: any) => ({
    taskId: str(item?.taskId, "—"),
    type: str(item?.type, "unknown"),
    status: str(item?.status, "pending"),
    requestedAt: str(item?.requestedAt ?? item?.requested_at, ""),
    payload: item?.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : null,
    payloadKeys: Object.keys(item?.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {}).filter((key) => key !== "__raw"),
    impact: item?.impact && typeof item.impact === "object" ? item.impact : null,
    payloadPreview: item?.payloadPreview && typeof item.payloadPreview === "object" ? item.payloadPreview : null,
    riskLevel: str(item?.impact?.riskLevel, "medium"),
    dependencyClass: str(item?.impact?.dependencyClass, "worker"),
    internalOnly: item?.impact?.internalOnly === true,
    publicTriggerable: item?.impact?.publicTriggerable === true,
  }));
}

export default function ApprovalsPage() {
  const { data: approvalsData, isLoading } = usePendingApprovals();
  const { hasRole, user } = useAuth();
  const isOperator = hasRole("operator");
  const decisionMutation = useApprovalDecision();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const approvals = useMemo(() => buildApprovalRows(approvalsData), [approvalsData]);
  const selectedApproval = approvals.find((item) => item.taskId === selectedTaskId) ?? approvals[0] ?? null;
  const approvalSummary = useMemo(
    () => ({
      highRiskCount: approvals.filter((item) => item.riskLevel === "high").length,
      externalCount: approvals.filter((item) => item.dependencyClass === "external").length,
      publicCount: approvals.filter((item) => item.publicTriggerable).length,
      oldestRequestedAt:
        approvals
          .map((item) => item.requestedAt)
          .filter(Boolean)
          .sort()[0] ?? null,
    }),
    [approvals],
  );

  useEffect(() => {
    if (!approvals.length) {
      setSelectedTaskId(null);
      setNote("");
      return;
    }

    if (!selectedTaskId || !approvals.some((item) => item.taskId === selectedTaskId)) {
      setSelectedTaskId(approvals[0].taskId);
      setNote("");
    }
  }, [approvals, selectedTaskId]);

  const handleDecision = (decision: "approved" | "rejected") => {
    if (!selectedApproval) return;

    decisionMutation.mutate(
      { id: selectedApproval.taskId, decision, actor: user?.actor, note: note || undefined },
      {
        onSuccess: (response) => {
          toast.success(`Approval ${decision}${response.replayTaskId ? ` — replay task: ${response.replayTaskId}` : ""}`);
          setNote("");
          setSelectedTaskId((current) => {
            const currentIndex = approvals.findIndex((item) => item.taskId === current);
            const nextItem = approvals[currentIndex + 1] ?? approvals[currentIndex - 1] ?? null;
            return nextItem?.taskId ?? null;
          });
        },
        onError: (err: any) => {
          toast.error(err?.body?.error || err.message || "Decision failed");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <h2 className="page-title">Approval Inbox</h2>
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="console-panel h-48 animate-pulse" style={{ opacity: 0.3 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Approval Inbox</h2>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">Review gated work before it can continue.</p>
        </div>
        <div className="activity-cell px-3 py-1.5 flex items-center gap-2">
          {approvals.length ? (
            <>
              <span className="indicator-light text-indicator-amber animate-pulse" />
              <span className="text-[9px] font-mono text-status-warning uppercase tracking-wider">{approvals.length} Pending</span>
            </>
          ) : (
            <>
              <span className="indicator-light text-indicator-green" />
              <span className="text-[9px] font-mono text-status-healthy uppercase tracking-wider">Clear</span>
            </>
          )}
        </div>
      </div>

      <div className="console-inset p-3">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <ShieldCheck className="w-3 h-3 inline mr-1.5 text-primary" />
          Select a queued review item, inspect its impact and payload, then commit the operator decision from a separate action box.
          {!isOperator && <span className="text-status-warning ml-2">Read-only — operator role required to approve or reject.</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-2xl">{approvals.length}</p>
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Pending Reviews</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-2xl">{approvalSummary.highRiskCount}</p>
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">High Risk</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-2xl">{approvalSummary.externalCount}</p>
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">External Dependency</p>
        </div>
        <div className="console-inset p-3 rounded-sm text-center">
          <p className="metric-value text-2xl">{approvalSummary.publicCount}</p>
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Public Triggerable</p>
        </div>
      </div>

      {!approvals.length ? (
        <SummaryCard title="Approvals Inbox" icon={<Inbox className="w-4 h-4" />}>
          <div className="py-10 text-center">
            <div className="console-inset w-14 h-14 rounded-sm mx-auto mb-4 flex items-center justify-center">
              <Inbox className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-mono">No approvals are waiting right now.</p>
          </div>
        </SummaryCard>
      ) : (
        <div className="grid xl:grid-cols-[0.9fr_1fr_0.7fr] gap-3 items-start">
          <SummaryCard title="Approval Queue" icon={<PanelRightOpen className="w-4 h-4" />} variant="inset">
            <div className="space-y-2">
              {approvals.map((item) => {
                const isSelected = item.taskId === selectedApproval?.taskId;
                return (
                  <button
                    key={item.taskId}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(item.taskId);
                      setNote("");
                    }}
                    className={`activity-module-row w-full text-left transition-colors ${isSelected ? "ring-1 ring-primary/40" : "hover:bg-panel-highlight/30"}`}
                  >
                    <div className="flex items-center gap-1.5 p-1.5 relative z-10 flex-wrap">
                      <div className="activity-cell flex items-center gap-2 px-3 py-2 min-w-[140px] flex-1">
                        <ShieldCheck className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wide truncate">
                          {item.type}
                        </span>
                      </div>
                      <div className="activity-cell px-2.5 py-2 flex items-center">
                        <StatusBadge label={item.status} size="sm" />
                      </div>
                      <div className="activity-cell px-3 py-2 hidden sm:flex items-center">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                          {(() => {
                            if (!item.requestedAt) return "—";
                            try {
                              return formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true });
                            } catch {
                              return item.requestedAt;
                            }
                          })()}
                        </span>
                      </div>
                      <div className="activity-cell px-3 py-2 hidden md:flex items-center">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                          {item.payloadKeys.length} field{item.payloadKeys.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {item.riskLevel && (
                        <div className="activity-cell px-3 py-2 hidden xl:flex items-center">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                            {item.riskLevel} risk
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </SummaryCard>

          <SummaryCard title="Review Detail" icon={<ShieldCheck className="w-4 h-4" />}>
            {selectedApproval ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="console-inset p-3 rounded-sm">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Task Type</p>
                    <p className="text-[11px] font-mono text-foreground mt-1">{selectedApproval.type}</p>
                  </div>
                  <div className="console-inset p-3 rounded-sm">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Requested</p>
                    <p className="text-[11px] font-mono text-foreground mt-1">
                      {selectedApproval.requestedAt ? new Date(selectedApproval.requestedAt).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="console-inset p-3 rounded-sm">
                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Payload Fields</p>
                    <p className="text-[11px] font-mono text-foreground mt-1">
                      {str(selectedApproval.payloadPreview?.keyCount, String(selectedApproval.payloadKeys.length))}
                    </p>
                  </div>
                </div>

                <div className="console-inset p-3 rounded-sm space-y-2">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Operator Decision Path</p>
                  <p className="text-[10px] font-mono text-foreground leading-relaxed">
                    Approval releases the task back into orchestrator execution using the existing request payload. Rejection keeps the task blocked and records operator intent.
                  </p>
                </div>

                {selectedApproval.impact && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className="console-inset p-3 rounded-sm text-center">
                      <p className="metric-value text-xl">{toArray(selectedApproval.impact.affectedSurfaces).length}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Surfaces</p>
                    </div>
                    <div className="console-inset p-3 rounded-sm text-center">
                      <p className="metric-value text-xl">{toArray(selectedApproval.impact.dependencyRequirements).length}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Dependencies</p>
                    </div>
                    <div className="console-inset p-3 rounded-sm text-center">
                      <p className="metric-value text-xl">{toArray(selectedApproval.impact.caveats).length}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Caveats</p>
                    </div>
                    <div className="console-inset p-3 rounded-sm text-center">
                      <p className="metric-value text-xl">{selectedApproval.impact.internalOnly ? "INT" : "PUB"}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Exposure</p>
                    </div>
                    <div className="console-inset p-3 rounded-sm text-center">
                      <p className="metric-value text-xl">{selectedApproval.impact.replayBehavior ? "REPLAY" : "DIRECT"}</p>
                      <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mt-1">Execution Path</p>
                    </div>
                  </div>
                )}

                {selectedApproval.impact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="console-inset p-3 rounded-sm space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Impact Model</p>
                      <p className="text-[10px] font-mono text-foreground leading-relaxed">
                        {str(selectedApproval.impact.purpose, "No task purpose recorded.")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide">
                          Risk {str(selectedApproval.impact.riskLevel, "medium")}
                        </span>
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide">
                          {str(selectedApproval.impact.dependencyClass, "worker")}
                        </span>
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide">
                          {str(selectedApproval.impact.approvalReason, "policy-task-type")}
                        </span>
                      </div>
                    </div>
                    <div className="console-inset p-3 rounded-sm space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Affected Surfaces</p>
                      <div className="flex flex-wrap gap-1.5">
                        {toArray(selectedApproval.impact.affectedSurfaces).map((surface) => (
                          <span
                            key={String(surface)}
                            className="activity-cell px-2 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wide"
                          >
                            {String(surface)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedApproval.impact && (
                  <div className="console-inset p-3 rounded-sm space-y-2">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Blast Radius</p>
                    <p className="text-[10px] font-mono text-foreground leading-relaxed">
                      {selectedApproval.impact.internalOnly
                        ? "This request remains inside internal orchestration surfaces."
                        : "This request can affect externally visible or user-facing surfaces."}
                      {" "}
                      {selectedApproval.impact.publicTriggerable
                        ? "The task is also exposed to public operator triggering."
                        : "The task is not publicly triggerable."}
                      {" "}
                      {selectedApproval.impact.replayBehavior
                        ? `Approval re-enters execution using replay behavior: ${String(selectedApproval.impact.replayBehavior)}.`
                        : "Approval releases the request directly into orchestrator execution."}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedApproval.impact.operationalStatus && (
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                          status:{String(selectedApproval.impact.operationalStatus)}
                        </span>
                      )}
                      {selectedApproval.impact.internalOnly !== undefined && (
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                          {selectedApproval.impact.internalOnly ? "internal-only" : "operator-surface"}
                        </span>
                      )}
                      {selectedApproval.impact.publicTriggerable !== undefined && (
                        <span className="activity-cell px-2 py-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
                          {selectedApproval.impact.publicTriggerable ? "public-triggerable" : "private-trigger"}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {selectedApproval.impact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em] mb-2">Dependencies</p>
                      <div className="flex flex-wrap gap-1.5">
                        {toArray(selectedApproval.impact.dependencyRequirements).map((item) => (
                          <span
                            key={String(item)}
                            className="activity-cell px-2 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wide"
                          >
                            {String(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em] mb-2">Caveats</p>
                      <div className="space-y-1.5">
                        {toArray(selectedApproval.impact.caveats).map((item) => (
                          <p key={String(item)} className="text-[10px] font-mono text-foreground leading-relaxed">
                            {String(item)}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedApproval.payloadKeys.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApproval.payloadKeys.map((key) => (
                      <span
                        key={key}
                        className="activity-cell px-2 py-1 text-[9px] font-mono text-muted-foreground uppercase tracking-wide"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                )}

                {selectedApproval.payload && (
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em] mb-1.5">Task Parameters</p>
                    <div className="console-inset p-3 text-xs font-mono text-foreground space-y-2 max-h-[34vh] overflow-y-auto">
                      {Object.entries(selectedApproval.payload)
                        .filter(([key]) => key !== "__raw")
                        .map(([key, value]) => (
                          <div key={key}>
                            <span className="text-muted-foreground">{key}:</span>{" "}
                            <SmartValue value={value} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {selectedApproval.payloadPreview && num(selectedApproval.payloadPreview.internalKeyCount) > 0 && (
                  <div className="console-inset p-3 rounded-sm">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Internal Payload Fields</p>
                    <p className="text-[10px] font-mono text-foreground mt-1 leading-relaxed">
                      {num(selectedApproval.payloadPreview.internalKeyCount)} internal orchestration field
                      {num(selectedApproval.payloadPreview.internalKeyCount) !== 1 ? "s are" : " is"} attached and omitted from the main payload list.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">Select an approval to review.</p>
              </div>
            )}
          </SummaryCard>

          <SummaryCard title="Decision Action" icon={<ShieldCheck className="w-4 h-4" />} variant="warning">
            {selectedApproval ? (
              <div className="space-y-4">
                <div className="console-inset p-3 rounded-sm space-y-2">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Current Review</p>
                  <p className="text-[10px] font-mono text-foreground leading-relaxed">
                    {selectedApproval.type} is waiting with {selectedApproval.riskLevel} risk, {selectedApproval.dependencyClass} dependency posture,
                    {" "}
                    {selectedApproval.internalOnly ? "internal-only blast radius" : "operator-visible blast radius"}.
                  </p>
                  {approvalSummary.oldestRequestedAt && (
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Oldest visible request: {(() => {
                        try {
                          return formatDistanceToNow(new Date(approvalSummary.oldestRequestedAt), { addSuffix: true });
                        } catch {
                          return approvalSummary.oldestRequestedAt;
                        }
                      })()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">
                    Operator Note (optional)
                  </label>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Record why you approved or rejected this request..."
                    className="bg-panel-inset border-border font-mono text-sm min-h-[160px]"
                  />
                </div>

                <div className="console-inset p-3 rounded-sm">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Decision Rules</p>
                  <p className="text-[10px] font-mono text-foreground mt-2 leading-relaxed">
                    Approve only when the payload, dependency posture, and blast radius match operator intent. Reject when the request is mistargeted,
                    under-explained, or unsafe to continue.
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="destructive"
                    onClick={() => handleDecision("rejected")}
                    disabled={decisionMutation.isPending || !isOperator}
                    className="font-mono text-xs uppercase tracking-wider"
                  >
                    {decisionMutation.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <XCircle className="w-3 h-3 mr-1.5" />}
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleDecision("approved")}
                    disabled={decisionMutation.isPending || !isOperator}
                    className="font-mono text-xs uppercase tracking-wider"
                  >
                    {decisionMutation.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                    Approve
                  </Button>
                </div>
                {!isOperator && (
                  <p className="text-[10px] font-mono text-status-warning leading-relaxed">
                    Operator role is required to commit a decision. You can still inspect queue and detail truth from this view.
                  </p>
                )}
              </div>
            ) : (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">Select an approval to decide.</p>
              </div>
            )}
          </SummaryCard>
        </div>
      )}
    </div>
  );
}
