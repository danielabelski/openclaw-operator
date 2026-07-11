import { useEffect, useMemo, useState } from "react";
import {
  useBusinessCycle,
  useBusinessCycles,
  useBusinessCycleRetry,
  useBusinessCycleTrigger,
  useBusinessOverview,
  useBusinessSchedulerUpdate,
} from "@/hooks/use-console-api";
import { useAuth } from "@/contexts/AuthContext";
import { SummaryCard } from "@/components/console/SummaryCard";
import { StatusBadge } from "@/components/console/StatusBadge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Target,
  UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import type { BusinessCandidate, BusinessCycle } from "@/types/console";

function displayTime(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function scoreLabel(candidate: BusinessCandidate) {
  return Number.isFinite(candidate.score?.value) ? candidate.score!.value.toFixed(1) : "—";
}

function cycleDuration(cycle: BusinessCycle) {
  if (!cycle.completedAt) return "In progress";
  const duration = Date.parse(cycle.completedAt) - Date.parse(cycle.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? `${Math.round(duration / 1000)}s` : "Unavailable";
}

function operationErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; body?: { reason?: unknown } };
    if (typeof candidate.body?.reason === "string") return candidate.body.reason;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return fallback;
}

export default function BusinessValuePage() {
  const { hasRole } = useAuth();
  const canOperate = hasRole("operator");
  const overview = useBusinessOverview();
  const history = useBusinessCycles();
  const trigger = useBusinessCycleTrigger();
  const scheduler = useBusinessSchedulerUpdate();
  const retry = useBusinessCycleRetry();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const cycleDetail = useBusinessCycle(selectedCycleId);

  const cycles = useMemo(() => history.data?.cycles ?? [], [history.data?.cycles]);
  useEffect(() => {
    if (!selectedCycleId && cycles[0]?.cycleId) setSelectedCycleId(cycles[0].cycleId);
  }, [cycles, selectedCycleId]);

  const data = overview.data;
  const operations = data?.operations;
  const schedulerState = operations?.scheduler;
  const selectedCycle = cycleDetail.data?.cycle ?? cycles.find((cycle) => cycle.cycleId === selectedCycleId) ?? null;
  const candidates = useMemo(
    () => [...(data?.businessValue?.candidates ?? [])].sort(
      (left, right) => (right.score?.value ?? -Infinity) - (left.score?.value ?? -Infinity),
    ),
    [data?.businessValue?.candidates],
  );
  const selectedCandidate = selectedCycle?.selectedTask
    ? selectedCycle.candidates.find((item) => item.id === selectedCycle.selectedTask?.candidateId) ?? null
    : null;
  const approvalCandidates = operations?.approvalGatedCandidates ?? [];
  const selectedApproval = approvalCandidates.find((item) => item.candidateId === selectedApprovalId) ?? approvalCandidates[0] ?? null;

  const runControl = () => {
    trigger.mutate(undefined, {
      onSuccess: (result) => toast.success(`Business-value cycle queued${result.taskId ? ` · ${result.taskId}` : ""}`),
      onError: (error: unknown) => toast.error(operationErrorMessage(error, "Cycle trigger failed")),
    });
  };

  const setScheduler = (action: "pause" | "resume" | "disable") => {
    scheduler.mutate(action, {
      onSuccess: () => toast.success(`Automatic cycles ${action === "resume" ? "resumed" : `${action}d`}`),
      onError: (error: unknown) => toast.error(operationErrorMessage(error, "Scheduler update failed")),
    });
  };

  if (overview.isLoading || history.isLoading) {
    return <div className="console-panel h-64 animate-pulse opacity-30" />;
  }

  if (overview.isError || !data || !operations || !schedulerState) {
    return (
      <SummaryCard title="Business Value Loop" icon={<AlertTriangle className="w-4 h-4" />} variant="warning">
        <p className="text-sm text-status-error">Live business-value state is unavailable.</p>
        <p className="text-xs font-mono text-muted-foreground mt-2">No status or KPI value has been inferred.</p>
      </SummaryCard>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="page-title">Business Value</h2>
            <StatusBadge label={operations.loopStatus} />
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-2 max-w-4xl leading-relaxed">
            {data.mission.mission}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={runControl} disabled={!canOperate || trigger.isPending || operations.loopStatus === "active"}>
            {trigger.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Run one cycle
          </Button>
          {schedulerState.mode === "enabled" ? (
            <Button size="sm" variant="outline" onClick={() => setScheduler("pause")} disabled={!canOperate || scheduler.isPending}>
              <Pause className="w-4 h-4 mr-2" /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setScheduler("resume")} disabled={!canOperate || scheduler.isPending}>
              <Play className="w-4 h-4 mr-2" /> Resume
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setScheduler("disable")} disabled={!canOperate || scheduler.isPending || schedulerState.mode === "disabled"}>
            <Square className="w-4 h-4 mr-2" /> Disable
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          ["Automatic mode", schedulerState.mode, `Every ${schedulerState.cadenceMinutes / 60}h`],
          ["Last successful", operations.lastSuccessfulCycle?.cycleId ?? "Unavailable", displayTime(operations.lastSuccessfulCycle?.completedAt)],
          ["Worker", operations.activeWorker ?? "Unavailable", operations.activeModel ?? "Model unavailable"],
          ["Verification", operations.verificationStatus, operations.selectedTask?.executionStatus ?? "No selected execution"],
        ].map(([label, value, note]) => (
          <div key={label} className="console-panel p-4 min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="text-sm font-mono text-foreground mt-2 break-words">{value}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-2 break-words">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-3">
        <SummaryCard title="Ranked Candidate Work" icon={<Target className="w-4 h-4" />}>
          <div className="divide-y divide-border/50">
            {candidates.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground py-4">No evidence-backed candidates are currently available.</p>
            ) : candidates.map((candidate, index) => (
              <div key={candidate.id} className="py-3 first:pt-0 last:pb-0 grid grid-cols-[3rem_1fr_auto] gap-3 items-start">
                <div className="metric-value text-xl text-center">{scoreLabel(candidate)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{index + 1}. {candidate.title}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">{candidate.expectedOutcome} · {candidate.kpiId}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{candidate.objective}</p>
                </div>
                <StatusBadge label={candidate.approval === "approval-required" ? "awaiting-approval" : candidate.approval} />
              </div>
            ))}
          </div>
        </SummaryCard>

        <SummaryCard title="Current Operation" icon={<Activity className="w-4 h-4" />}>
          <dl className="space-y-3 text-xs">
            {[
              ["Selected project", operations.selectedCandidate?.projectId ?? "Unavailable"],
              ["Selected task", operations.selectedTask?.title ?? "Unavailable"],
              ["Task status", operations.selectedTask?.executionStatus ?? operations.selectedExecution?.status ?? "Unavailable"],
              ["Next scheduled run", displayTime(schedulerState.nextRunAt)],
              ["Last trigger", schedulerState.lastTriggerReason ?? "Unavailable"],
              ["Last skipped", schedulerState.lastSkipReason ?? "None"],
            ].map(([term, description]) => (
              <div key={term} className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border/40 pb-2 last:border-0">
                <dt className="font-mono text-muted-foreground">{term}</dt>
                <dd className="text-foreground break-words">{description}</dd>
              </div>
            ))}
          </dl>
          <div className="console-inset p-3 mt-4">
            <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Next safe task</p>
            <p className="text-xs text-foreground mt-2 leading-relaxed">{operations.nextSafeTask ?? "Unavailable"}</p>
          </div>
        </SummaryCard>
      </div>

      <div className="grid xl:grid-cols-[0.75fr_1.25fr] gap-3">
        <SummaryCard title="Cycle History" icon={<History className="w-4 h-4" />}>
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-2">
              {cycles.length === 0 ? (
                <p className="text-xs font-mono text-muted-foreground">No cycle history has been recorded.</p>
              ) : cycles.map((cycle) => (
                <button
                  key={cycle.cycleId}
                  type="button"
                  onClick={() => setSelectedCycleId(cycle.cycleId)}
                  className={`w-full text-left p-3 border rounded-sm transition-colors ${selectedCycleId === cycle.cycleId ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-primary/25"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge label={cycle.status} />
                    <span className="text-[9px] font-mono text-muted-foreground">{cycleDuration(cycle)}</span>
                  </div>
                  <p className="text-[10px] font-mono text-foreground mt-2 break-all">{cycle.cycleId}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{displayTime(cycle.startedAt)}</p>
                  <p className="text-[9px] font-mono text-muted-foreground mt-1">{cycle.triggerSource} · {cycle.triggerReason}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SummaryCard>

        <SummaryCard title="Cycle Evidence" icon={<ShieldCheck className="w-4 h-4" />} headerAction={
          selectedCycle?.status === "failed" ? (
            <Button size="sm" variant="outline" disabled={!canOperate || retry.isPending} onClick={() => retry.mutate(selectedCycle.cycleId)}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Retry
            </Button>
          ) : null
        }>
          {!selectedCycle ? (
            <p className="text-xs font-mono text-muted-foreground">Select a cycle to inspect its evidence.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={selectedCycle.status} />
                <StatusBadge label={selectedCycle.verificationStatus} />
                <span className="text-[10px] font-mono text-muted-foreground self-center">
                  {selectedCycle.triggerSource} · {selectedCycle.candidates.length} candidates · {selectedCycle.approvalGatedCandidates.length} awaiting approval
                </span>
              </div>
              {selectedCandidate?.score && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Selected score breakdown</p>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                    {Object.entries(selectedCandidate.score.components).map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b border-border/40 pb-1 text-[10px] font-mono">
                        <span className="text-muted-foreground">{key}</span><span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Worker and model</p>
                  <p className="mt-2">{selectedCycle.selectedTask?.worker ?? "Unavailable"}</p>
                  <p className="font-mono text-muted-foreground mt-1">{selectedCycle.selectedTask?.model ?? "Model unavailable"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">KPI / outcome</p>
                  <p className="mt-2">{selectedCandidate?.kpiId ?? "Unavailable"}</p>
                  <p className="font-mono text-muted-foreground mt-1">{selectedCandidate?.expectedOutcome ?? "Unavailable"}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Acceptance criteria</p>
                <ul className="mt-2 space-y-1 text-xs text-foreground">
                  {(selectedCandidate?.acceptanceCriteria ?? []).map((criterion) => <li key={criterion}>• {criterion}</li>)}
                  {!selectedCandidate?.acceptanceCriteria.length && <li className="text-muted-foreground">Unavailable</li>}
                </ul>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">Evidence</p>
                <div className="mt-2 divide-y divide-border/40">
                  {selectedCycle.evidence.map((item) => (
                    <div key={`${item.path}:${item.createdAt}`} className="py-2 first:pt-0">
                      <p className="text-[10px] font-mono text-foreground break-all">{item.path}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{item.summary}</p>
                    </div>
                  ))}
                  {selectedCycle.evidence.length === 0 && <p className="text-xs text-muted-foreground">No evidence recorded.</p>}
                </div>
              </div>
            </div>
          )}
        </SummaryCard>
      </div>

      <div className="grid xl:grid-cols-2 gap-3">
        <SummaryCard title="Approval-Gated Candidates" icon={<UserRoundCog className="w-4 h-4" />} variant={approvalCandidates.length ? "warning" : "default"}>
          {approvalCandidates.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-status-healthy"><CheckCircle2 className="w-4 h-4" /> No business candidates are waiting for approval.</div>
          ) : (
            <div className="grid sm:grid-cols-[0.9fr_1.1fr] gap-3">
              <div className="space-y-2">
                {approvalCandidates.map((candidate) => (
                  <button key={candidate.candidateId} type="button" onClick={() => setSelectedApprovalId(candidate.candidateId)} className="w-full text-left p-2 border border-border rounded-sm hover:border-primary/30">
                    <p className="text-xs font-semibold">{candidate.title}</p>
                    <p className="text-[9px] font-mono text-status-approval mt-1">Awaiting approval</p>
                  </button>
                ))}
              </div>
              <div className="console-inset p-3">
                <p className="text-xs font-semibold">{selectedApproval?.title}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{selectedApproval?.reason}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-3 break-all">{selectedApproval?.evidence.join(" · ")}</p>
              </div>
            </div>
          )}
        </SummaryCard>

        <SummaryCard title="Blockers and Timing" icon={<Clock3 className="w-4 h-4" />}>
          <div className="space-y-3 text-xs">
            {operations.blockers.length === 0 ? <p className="text-status-healthy">No current blockers are recorded.</p> : operations.blockers.map((item, index) => (
              <div key={`${item.projectId}:${index}`} className="border-b border-border/40 pb-2">
                <p className="font-mono text-muted-foreground">{item.projectId ?? "runtime"}</p>
                <p className="mt-1">{item.blocker}</p>
              </div>
            ))}
            {schedulerState.backoffUntil && <p className="text-status-warning">Failure backoff until {displayTime(schedulerState.backoffUntil)}</p>}
          </div>
        </SummaryCard>
      </div>
    </div>
  );
}
