import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Download, Link2, NotebookText, Play, Square } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useReviewSessionBucket,
  useReviewSessionDetail,
  useReviewSessionExport,
  useReviewSessionLinkRun,
  useReviewSessionNote,
  useReviewSessionStop,
  useReviewSessions,
} from "@/hooks/use-console-api";
import { SummaryCard } from "@/components/console/SummaryCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import type { ReviewSessionBucket, ReviewSessionRecord, ReviewTelemetrySample } from "@/types/console";

const BUCKET_OPTIONS: Array<{ value: ReviewSessionBucket; label: string; description: string }> = [
  {
    value: "baseline_idle",
    label: "Baseline Idle",
    description: "Machine before OpenClaw stack startup.",
  },
  {
    value: "startup_cost",
    label: "Startup Cost",
    description: "Boot and handoff cost while the stack comes alive.",
  },
  {
    value: "steady_state_running_cost",
    label: "Steady State",
    description: "Normal running cost after startup stabilizes.",
  },
  {
    value: "burst_workload",
    label: "Burst Workload",
    description: "Short, intentional load spikes and queue pressure.",
  },
  {
    value: "user_experience_evidence",
    label: "User Experience",
    description: "Operator-facing responsiveness and qualitative evidence.",
  },
];

function formatBucket(bucket: ReviewSessionBucket) {
  return BUCKET_OPTIONS.find((option) => option.value === bucket)?.label ?? bucket;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDurationSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || value <= 0) return "0s";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatMb(value: number | null | undefined) {
  if (typeof value !== "number") return "n/a";
  return `${value.toFixed(1)} MB`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number") return "n/a";
  return `${value.toFixed(2)}%`;
}

function downloadPayload(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function latestSample(samples: ReviewTelemetrySample[]) {
  return samples.length > 0 ? samples[samples.length - 1] : null;
}

function getHandoffStatus(session: ReviewSessionRecord) {
  switch (session.state) {
    case "pending_handoff":
      return { label: "Pending", subtitle: "handoff pending", terminal: false };
    case "handoff_failed":
      return { label: "Failed", subtitle: "handoff failed", terminal: true };
    case "active":
      return { label: "Complete", subtitle: "handoff complete", terminal: false };
    case "completed":
      return { label: "Complete", subtitle: "handoff complete", terminal: true };
    default:
      return { label: "Unknown", subtitle: "handoff unknown", terminal: true };
  }
}

function sessionSubtitle(session: ReviewSessionRecord) {
  const baselineCaptured = session.baselineSummary ? "baseline captured" : "baseline missing";
  const handoff = getHandoffStatus(session);
  return `${baselineCaptured} · ${handoff.subtitle}`;
}

export default function ReviewSessionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useReviewSessions();
  const sessions = data?.sessions ?? [];
  const activeSession = data?.activeSession ?? null;
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [nextBucket, setNextBucket] = useState<ReviewSessionBucket>("steady_state_running_cost");
  const [bucketNote, setBucketNote] = useState("");
  const [noteBucket, setNoteBucket] = useState<ReviewSessionBucket>("steady_state_running_cost");
  const [noteText, setNoteText] = useState("");
  const [runId, setRunId] = useState("");

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    const preferredId = activeSession?.id ?? sessions[0]?.id ?? null;
    const stillExists = selectedSessionId ? sessions.some((session) => session.id === selectedSessionId) : false;
    if (!stillExists && preferredId) {
      setSelectedSessionId(preferredId);
    }
  }, [activeSession?.id, selectedSessionId, sessions]);

  const detailQuery = useReviewSessionDetail(selectedSessionId);
  const session = detailQuery.data?.session ?? null;
  const samples = detailQuery.data?.samples ?? [];
  const sample = latestSample(samples);
  const handoff = session ? getHandoffStatus(session) : null;

  useEffect(() => {
    if (!session) return;
    setNextBucket(session.activeBucket);
    setNoteBucket(session.activeBucket);
  }, [session?.activeBucket, session?.id]);

  const bucketMutation = useReviewSessionBucket();
  const noteMutation = useReviewSessionNote();
  const linkRunMutation = useReviewSessionLinkRun();
  const stopMutation = useReviewSessionStop();
  const exportMutation = useReviewSessionExport();

  const bucketTimeline = useMemo(() => [...(session?.bucketTimeline ?? [])].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)), [session?.bucketTimeline]);
  const scenarioNotes = useMemo(() => [...(session?.scenarioNotes ?? [])].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)), [session?.scenarioNotes]);
  const recentSamples = useMemo(() => [...samples].slice(-6).reverse(), [samples]);

  async function handleBucketSwitch() {
    if (!session) return;
    try {
      await bucketMutation.mutateAsync({
        id: session.id,
        bucket: nextBucket,
        note: bucketNote.trim() || undefined,
      });
      setBucketNote("");
      toast({ title: "Bucket updated", description: `Active bucket is now ${formatBucket(nextBucket)}.` });
    } catch (mutationError) {
      toast({
        title: "Bucket update failed",
        description: mutationError instanceof Error ? mutationError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleAddNote() {
    if (!session || noteText.trim().length === 0) return;
    try {
      await noteMutation.mutateAsync({ id: session.id, bucket: noteBucket, text: noteText.trim() });
      setNoteText("");
      toast({ title: "Note added", description: "Scenario evidence recorded." });
    } catch (mutationError) {
      toast({
        title: "Failed to add note",
        description: mutationError instanceof Error ? mutationError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleLinkRun() {
    if (!session || runId.trim().length === 0) return;
    try {
      await linkRunMutation.mutateAsync({ id: session.id, runId: runId.trim() });
      setRunId("");
      toast({ title: "Run linked", description: "Execution evidence attached to this review session." });
    } catch (mutationError) {
      toast({
        title: "Failed to link run",
        description: mutationError instanceof Error ? mutationError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleStop() {
    if (!session) return;
    try {
      await stopMutation.mutateAsync(session.id);
      toast({ title: "Session completed", description: "Review session is now closed." });
    } catch (mutationError) {
      toast({
        title: "Failed to stop session",
        description: mutationError instanceof Error ? mutationError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleExport(format: "json" | "markdown") {
    if (!session) return;
    try {
      const payload = await exportMutation.mutateAsync({ id: session.id, format });
      if (format === "markdown") {
        downloadPayload(`${session.id}.md`, payload as string, "text/markdown;charset=utf-8");
      } else {
        downloadPayload(
          `${session.id}.json`,
          JSON.stringify(payload, null, 2),
          "application/json;charset=utf-8",
        );
      }
      toast({ title: "Export ready", description: `${format.toUpperCase()} export downloaded.` });
    } catch (mutationError) {
      toast({
        title: "Export failed",
        description: mutationError instanceof Error ? mutationError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="page-title">Review Sessions</h2>
      </div>

      <div className="console-inset p-3">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <Activity className="w-3 h-3 inline mr-1.5 text-primary" />
          Honest review capture is bootstrap-led. Normal `npm run dev` is still your standard app boot, but baseline evidence only exists when the session is started through `npm run review-session:start`.
        </p>
      </div>

      {isError && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-error shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-error uppercase tracking-wider">Failed to load review sessions</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error)?.message || "Unknown error"}</p>
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-[0.8fr_1.2fr] gap-3">
        <SummaryCard title="Session Ledger" icon={<NotebookText className="w-4 h-4" />}>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="console-inset h-16 animate-pulse" style={{ opacity: 0.3 }} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">No review sessions recorded.</p>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Start one with `npm run review-session:start`. Running only `npm run dev` boots the stack but skips the pre-stack baseline capture by design.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((item) => {
                const isSelected = item.id === selectedSessionId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedSessionId(item.id)}
                    className={`w-full text-left console-inset rounded-sm p-3 transition-colors ${isSelected ? "border border-primary/30 bg-primary/5" : "hover:bg-panel-highlight/20"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">{sessionSubtitle(item)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{item.state}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SummaryCard>

        <SummaryCard
          title="Session Detail"
          icon={<Play className="w-4 h-4" />}
          headerAction={
            session ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleExport("markdown")} disabled={exportMutation.isPending}>
                  <Download className="w-4 h-4" />
                  Markdown
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleExport("json")} disabled={exportMutation.isPending}>
                  <Download className="w-4 h-4" />
                  JSON
                </Button>
              </div>
            ) : null
          }
        >
          {!selectedSessionId ? (
            <p className="text-sm text-muted-foreground">Select a review session to inspect it.</p>
          ) : detailQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="console-inset h-20 animate-pulse" style={{ opacity: 0.3 }} />
              ))}
            </div>
          ) : detailQuery.isError || !session ? (
            <div className="warning-banner">
              <AlertTriangle className="w-4 h-4 text-status-error shrink-0" />
              <div>
                <p className="text-[11px] font-mono font-semibold text-status-error uppercase tracking-wider">Failed to load review session detail</p>
                <p className="text-xs text-muted-foreground mt-1">{(detailQuery.error as Error)?.message || "Unknown error"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
                <div className="console-inset p-3 rounded-sm">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">State</p>
                  <p className="metric-value text-2xl mt-2">{session.state}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">Current bucket: {formatBucket(session.activeBucket)}</p>
                </div>
                <div className="console-inset p-3 rounded-sm">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Samples</p>
                  <p className="metric-value text-2xl mt-2">{samples.length}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">Latest capture: {formatDate(sample?.capturedAt)}</p>
                </div>
                <div className="console-inset p-3 rounded-sm">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Linked Runs</p>
                  <p className="metric-value text-2xl mt-2">{session.summary?.linkedRunCount ?? session.linkedRunIds.length}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">Spend: ${(session.summary?.linkedRunCostUsd ?? 0).toFixed(4)}</p>
                </div>
                <div className="console-inset p-3 rounded-sm">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Open Incidents</p>
                  <p className="metric-value text-2xl mt-2">{session.summary?.observedIncidentCount ?? sample?.activity.openIncidents ?? 0}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-2">Queue depth: {sample?.activity.queueDepth ?? 0}</p>
                </div>
              </div>

              <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-3">
                <SummaryCard title="Capture Truth" icon={<Activity className="w-4 h-4" />} variant="inset">
                  <div className="space-y-3 text-sm">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Baseline</p>
                        <p className="text-sm text-foreground mt-2">
                          {session.baselineSummary ? "Captured before stack startup" : "Missing"}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">
                          {formatDate(session.baselineStartedAt)} to {formatDate(session.baselineEndedAt)}
                        </p>
                      </div>
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Startup Handoff</p>
                        <p className="text-sm text-foreground mt-2">
                          {handoff?.label ?? "Unknown"}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">
                          {session.handoffReceivedAt
                            ? `Received ${formatDate(session.handoffReceivedAt)}`
                            : `Startup began ${formatDate(session.startupStartedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Machine</p>
                        <p className="text-[11px] font-mono text-foreground mt-2 leading-relaxed">
                          {session.machine.hostname} · {session.machine.platform}/{session.machine.arch}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">
                          {session.machine.cpuModel} · {session.machine.cpuCores} cores · {session.machine.memoryTotalMb} MB
                        </p>
                      </div>
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Latest Host Sample</p>
                        <p className="text-[11px] font-mono text-foreground mt-2 leading-relaxed">
                          CPU {formatPercent(sample?.host.cpuPercent)} · Load {sample?.host.load1?.toFixed(2) ?? "n/a"}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">
                          Memory {formatMb(sample ? sample.host.memoryUsedBytes / (1024 * 1024) : null)} of {formatMb(sample ? sample.host.memoryTotalBytes / (1024 * 1024) : null)}
                        </p>
                      </div>
                    </div>
                  </div>
                </SummaryCard>

                <SummaryCard title="Baseline Summary" icon={<NotebookText className="w-4 h-4" />} variant="inset">
                  {session.baselineSummary ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">CPU</p>
                        <p className="text-sm text-foreground mt-2">Avg {formatPercent(session.baselineSummary.cpuPercentAvg)}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">Peak {formatPercent(session.baselineSummary.cpuPercentPeak)}</p>
                      </div>
                      <div className="console-inset p-3 rounded-sm">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Memory</p>
                        <p className="text-sm text-foreground mt-2">Avg {formatMb(session.baselineSummary.memoryUsedMbAvg)}</p>
                        <p className="text-[10px] font-mono text-muted-foreground mt-2">Peak {formatMb(session.baselineSummary.memoryUsedMbPeak)}</p>
                      </div>
                      <div className="console-inset p-3 rounded-sm sm:col-span-2">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Load Average</p>
                        <p className="text-sm text-foreground mt-2">{session.baselineSummary.loadAvg1m.toFixed(2)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No baseline summary is present for this session.</p>
                  )}
                </SummaryCard>
              </div>

              <div className="grid xl:grid-cols-[1fr_1fr] gap-3">
                <SummaryCard title="Bucket Controls" icon={<Activity className="w-4 h-4" />}>
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Switch bucket</p>
                        <Select value={nextBucket} onValueChange={(value) => setNextBucket(value as ReviewSessionBucket)}>
                          <SelectTrigger className="bg-panel-inset border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUCKET_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">{BUCKET_OPTIONS.find((option) => option.value === nextBucket)?.description}</p>
                      </div>
                      <Button onClick={() => void handleBucketSwitch()} disabled={bucketMutation.isPending || session.state !== "active"}>
                        <Play className="w-4 h-4" />
                        Switch
                      </Button>
                    </div>
                    <Textarea
                      value={bucketNote}
                      onChange={(event) => setBucketNote(event.target.value)}
                      placeholder="Optional note for the bucket transition"
                      className="min-h-[88px]"
                    />
                    <div className="console-inset p-3 rounded-sm">
                      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Timeline</p>
                      <div className="mt-3 space-y-2 max-h-[220px] overflow-auto pr-1">
                        {bucketTimeline.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No bucket transitions recorded yet.</p>
                        ) : (
                          bucketTimeline.map((entry, index) => (
                            <div key={`${entry.capturedAt}-${index}`} className="border border-border/50 rounded-sm p-2">
                              <p className="text-[11px] font-mono text-foreground uppercase tracking-wide">{formatBucket(entry.bucket)}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatDate(entry.capturedAt)}</p>
                              {entry.note ? <p className="text-xs text-muted-foreground mt-2">{entry.note}</p> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </SummaryCard>

                <SummaryCard title="Evidence Actions" icon={<Link2 className="w-4 h-4" />}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Add scenario note</p>
                      <Select value={noteBucket} onValueChange={(value) => setNoteBucket(value as ReviewSessionBucket)}>
                        <SelectTrigger className="bg-panel-inset border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUCKET_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                        placeholder="Capture what the operator observed"
                        className="min-h-[110px]"
                      />
                      <Button onClick={() => void handleAddNote()} disabled={noteMutation.isPending || noteText.trim().length === 0}>
                        <NotebookText className="w-4 h-4" />
                        Add Note
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Link task run</p>
                      <div className="flex gap-2">
                        <Input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="run id or task id" />
                        <Button variant="outline" onClick={() => void handleLinkRun()} disabled={linkRunMutation.isPending || runId.trim().length === 0}>
                          <Link2 className="w-4 h-4" />
                          Link
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Use this when a run provides proof for burst behavior, latency, or operator experience.</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 console-inset p-3 rounded-sm">
                      <div>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Complete session</p>
                        <p className="text-xs text-muted-foreground mt-1">Stops sampling and seals the export state.</p>
                      </div>
                      <Button variant="destructive" onClick={() => void handleStop()} disabled={stopMutation.isPending || session.state !== "active"}>
                        <Square className="w-4 h-4" />
                        Stop
                      </Button>
                    </div>
                  </div>
                </SummaryCard>
              </div>

              <div className="grid xl:grid-cols-[1fr_1fr] gap-3">
                <SummaryCard title="Scenario Notes" icon={<NotebookText className="w-4 h-4" />} variant="inset">
                  <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                    {scenarioNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No scenario notes recorded yet.</p>
                    ) : (
                      scenarioNotes.map((entry, index) => (
                        <div key={`${entry.capturedAt}-${index}`} className="console-inset p-3 rounded-sm">
                          <p className="text-[11px] font-mono text-foreground uppercase tracking-wide">{formatBucket(entry.bucket)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDate(entry.capturedAt)}</p>
                          <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{entry.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </SummaryCard>

                <SummaryCard title="Recent Samples" icon={<Activity className="w-4 h-4" />} variant="inset">
                  <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
                    {recentSamples.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No telemetry samples captured yet.</p>
                    ) : (
                      recentSamples.map((entry, index) => (
                        <div key={`${entry.capturedAt}-${index}`} className="console-inset p-3 rounded-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-mono text-foreground uppercase tracking-wide">{formatBucket(entry.bucket)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(entry.capturedAt)}</p>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground mt-2">
                            CPU {formatPercent(entry.host.cpuPercent)} · Load {entry.host.load1.toFixed(2)} · Queue {entry.activity.queueDepth} · Runs {entry.activity.activeRuns}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-1">
                            Memory {formatMb(entry.host.memoryUsedBytes / (1024 * 1024))} · Process RSS {formatMb(entry.process.rssBytes ? entry.process.rssBytes / (1024 * 1024) : null)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </SummaryCard>
              </div>

              <SummaryCard title="Derived Summary" icon={<NotebookText className="w-4 h-4" />} variant="inset">
                {session.summary ? (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {BUCKET_OPTIONS.map((option) => {
                      const stats = session.summary?.bucketStats?.[option.value];
                      return (
                        <div key={option.value} className="console-inset p-3 rounded-sm">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{option.label}</p>
                          <p className="text-sm text-foreground mt-2">{formatDurationSeconds(stats?.durationSeconds ?? 0)}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-2">
                            {stats?.sampleCount ?? 0} samples · avg {formatPercent(stats?.cpuPercentAvg)} · peak {formatPercent(stats?.cpuPercentPeak)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Derived summary will appear after the orchestrator has enough session data to calculate it.</p>
                )}
              </SummaryCard>
            </div>
          )}
        </SummaryCard>
      </div>
    </div>
  );
}