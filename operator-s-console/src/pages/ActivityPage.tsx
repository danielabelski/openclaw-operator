import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Bot, Brain, Clock, Eye, History, RefreshCw } from "lucide-react";
import { useDashboardOverview, useMemoryRecall, useTaskRuns } from "@/hooks/use-console-api";
import { SummaryCard, MetricModule } from "@/components/console/SummaryCard";
import { ActivityModuleRow } from "@/components/console/ActivityModuleRow";
import { ActivityPagination } from "@/components/console/ActivityPagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/console/StatusBadge";
import { buildRunMetrics, buildRunRows } from "@/lib/task-runs";
import { num, str, toArray, toNullableString } from "@/lib/safe-render";
import type { RecentTask } from "@/types/console";

function buildRecentTasks(dashboard: any): RecentTask[] {
  return toArray(dashboard?.recentTasks).map((task: any) => {
    const rawStatus = str(task?.result ?? task?.status, "unknown");
    const normalizedStatus =
      rawStatus === "ok" ? "success" : rawStatus === "error" ? "failed" : rawStatus;

    return {
      id: str(task?.id ?? task?.taskId, ""),
      taskId: str(task?.taskId ?? task?.id, ""),
      type: str(task?.type, "unknown"),
      label: str(task?.message ?? task?.label ?? task?.type, "unknown"),
      message: toNullableString(task?.message) ?? undefined,
      status: normalizedStatus,
      result: toNullableString(task?.result) ?? undefined,
      agent: str(task?.agent ?? "system", "system"),
      startedAt: toNullableString(task?.startedAt ?? task?.handledAt) ?? undefined,
      completedAt: toNullableString(task?.completedAt ?? task?.handledAt) ?? undefined,
      createdAt: toNullableString(task?.createdAt) ?? undefined,
      handledAt: toNullableString(task?.handledAt) ?? undefined,
    };
  });
}

interface MemoryItemVM {
  agentId: string;
  lastRunAt: string | null;
  lastStatus: string;
  totalRuns: number;
  successCount: number;
  errorCount: number;
}

function buildMemoryItems(data: any): MemoryItemVM[] {
  return toArray(data?.items).map((item: any) => ({
    agentId: str(item?.agentId, "unknown-agent"),
    lastRunAt: toNullableString(item?.lastRunAt),
    lastStatus: str(item?.lastStatus, "unknown"),
    totalRuns: num(item?.totalRuns),
    successCount: num(item?.successCount),
    errorCount: num(item?.errorCount),
  }));
}

function RecentTaskFeed({ tasks }: { tasks: RecentTask[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paged = tasks.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div style={{ height: 5 * 52, position: "relative", overflow: "hidden" }}>
        <ScrollArea className="h-full">
          <div className="space-y-2 pr-2">
            {paged.map((task, index) => (
              <ActivityModuleRow key={task.id || task.taskId || index} task={task} />
            ))}
            {paged.length === 0 && (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">No recent control-plane tasks recorded.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="mt-3">
        <ActivityPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </>
  );
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: dashboardLoading, isError: dashboardError, error: dashboardErrorObj } = useDashboardOverview();
  const { data: runsData, isLoading: runsLoading, isError: runsError, error: runsErrorObj } = useTaskRuns({ limit: 12 });
  const { data: memoryData, isLoading: memoryLoading, isError: memoryError, error: memoryErrorObj } = useMemoryRecall({
    limit: 12,
    includeErrors: true,
  });

  const recentTasks = useMemo(() => buildRecentTasks(dashboard), [dashboard]);
  const runVM = useMemo(() => buildRunRows(runsData), [runsData]);
  const runMetrics = useMemo(() => buildRunMetrics(runVM.runs), [runVM.runs]);
  const memoryItems = useMemo(() => buildMemoryItems(memoryData), [memoryData]);
  const memoryErrorAgents = memoryItems.filter((item) => item.errorCount > 0).length;

  if (dashboardLoading && runsLoading && memoryLoading) {
    return (
      <div className="space-y-5">
        <h2 className="page-title">Activity</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="console-panel h-24 animate-pulse" style={{ opacity: 0.3 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="page-title">Activity</h2>

      <div className="console-inset p-3">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <Activity className="w-3 h-3 inline mr-1.5 text-primary" />
          Combined operator activity view using the current dashboard aggregate, run history, and memory recall surfaces.
        </p>
      </div>

      {(dashboardError || runsError || memoryError) && (
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
          <div>
            <p className="text-[11px] font-mono font-semibold text-status-warning uppercase tracking-wider">Partial Activity Data</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(dashboardErrorObj as Error | undefined)?.message
                || (runsErrorObj as Error | undefined)?.message
                || (memoryErrorObj as Error | undefined)?.message
                || "One or more activity feeds failed to load. Remaining evidence is still shown below."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricModule
          title="Recent Tasks"
          icon={<Activity className="w-4 h-4" />}
          value={recentTasks.length}
          subtitle="Control-Plane Events"
          onClick={() => navigate("/tasks")}
        />
        <MetricModule
          title="Failed Runs"
          icon={<History className="w-4 h-4" />}
          value={runMetrics.failedCount}
          subtitle={`${runMetrics.activeCount} active`}
          glow={runMetrics.failedCount > 0}
          onClick={() => navigate("/task-runs")}
        />
        <MetricModule
          title="Memory Agents"
          icon={<Brain className="w-4 h-4" />}
          value={memoryItems.length}
          subtitle={`${num(memoryData?.totalRuns)} tracked runs`}
          onClick={() => navigate("/knowledge")}
        />
        <MetricModule
          title="Error Agents"
          icon={<Bot className="w-4 h-4" />}
          value={memoryErrorAgents}
          subtitle="Memory Recall"
          glow={memoryErrorAgents > 0}
          onClick={() => navigate("/knowledge")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-3">
        <SummaryCard
          title="Recent Control-Plane Tasks"
          icon={<Clock className="w-4 h-4" />}
          headerAction={(
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="text-[9px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              Open Tasks
            </button>
          )}
        >
          <RecentTaskFeed tasks={recentTasks} />
        </SummaryCard>

        <SummaryCard
          title="Recent Run Feed"
          icon={<History className="w-4 h-4" />}
          headerAction={(
            <button
              type="button"
              onClick={() => navigate("/task-runs")}
              className="text-[9px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
            >
              Open Run History
            </button>
          )}
        >
          <div className="space-y-2">
            {runVM.runs.map((run) => (
              <button
                key={run.runId}
                type="button"
                onClick={() => navigate(`/task-runs/${encodeURIComponent(run.runId)}`)}
                className="activity-module-row w-full text-left transition-colors hover:bg-panel-highlight/30"
              >
                <div className="flex items-center gap-1.5 p-1.5 relative z-10 flex-wrap">
                  <div className="activity-cell flex items-center gap-2 px-3 py-2 min-w-[140px] flex-1">
                    <span className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wide truncate">
                      {run.type}
                    </span>
                  </div>
                  <div className="activity-cell px-2.5 py-2 flex items-center">
                    <StatusBadge label={run.status} size="sm" />
                  </div>
                  <div className="activity-cell px-3 py-2 hidden sm:flex items-center">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                      Attempt {Math.max(1, run.attempt)}
                    </span>
                  </div>
                  <div className="activity-cell px-3 py-2 hidden md:flex items-center">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {(() => {
                        const ts = run.lastHandledAt || run.completedAt || run.startedAt || run.createdAt;
                        if (!ts) return "—";
                        try {
                          return formatDistanceToNow(new Date(ts), { addSuffix: true });
                        } catch {
                          return ts;
                        }
                      })()}
                    </span>
                  </div>
                  {run.repair && (
                    <div className="activity-cell px-2.5 py-2 hidden lg:flex items-center">
                      <StatusBadge label={str(run.repair.status, "warning")} size="sm" />
                    </div>
                  )}
                  <div className="activity-cell px-2.5 py-2 flex items-center">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
            {runVM.runs.length === 0 && (
              <div className="console-inset p-6 text-center">
                <p className="text-sm text-muted-foreground font-mono">No recent run history returned.</p>
              </div>
            )}
          </div>
        </SummaryCard>
      </div>

      <SummaryCard
        title="Agent Memory Feed"
        icon={<RefreshCw className="w-4 h-4" />}
        headerAction={(
          <button
            type="button"
            onClick={() => navigate("/knowledge")}
            className="text-[9px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
          >
            Open Knowledge
          </button>
        )}
      >
        <div className="space-y-2">
          {memoryItems.map((item) => (
            <div key={`${item.agentId}-${item.lastRunAt ?? "none"}`} className="activity-module-row">
              <div className="flex items-center gap-1.5 p-1.5 relative z-10 flex-wrap">
                <div className="activity-cell flex items-center gap-2 px-3 py-2 min-w-[150px] flex-1">
                  <Bot className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-mono text-[11px] font-bold text-foreground uppercase tracking-wide truncate">
                    {item.agentId}
                  </span>
                </div>
                <div className="activity-cell px-2.5 py-2 flex items-center">
                  <StatusBadge label={item.lastStatus} size="sm" />
                </div>
                <div className="activity-cell px-3 py-2 hidden md:flex items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                    Runs {item.totalRuns}
                  </span>
                </div>
                <div className="activity-cell px-3 py-2 hidden lg:flex items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                    {item.successCount} ok / {item.errorCount} err
                  </span>
                </div>
                <div className="activity-cell px-3 py-2 hidden xl:flex items-center">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {item.lastRunAt ? formatDistanceToNow(new Date(item.lastRunAt), { addSuffix: true }) : "No recent run"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {memoryItems.length === 0 && (
            <div className="console-inset p-6 text-center">
              <p className="text-sm text-muted-foreground font-mono">No memory recall items returned.</p>
            </div>
          )}
        </div>
      </SummaryCard>
    </div>
  );
}
