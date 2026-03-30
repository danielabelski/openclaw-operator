import { Play, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/console/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskRowVM {
  type: string;
  label: string;
  purpose: string;
  operationalStatus: string;
  approvalGated: boolean;
  category?: string;
  availabilityLabel?: string;
  dependencyClass?: string;
  dependencyRequirements?: string[];
  baselineConfidence?: string;
  caveats: string[];
  totalRuns: number;
  successRate: string;
}

interface TaskBentoCardProps {
  task: TaskRowVM;
  isOperator: boolean;
  isPending: boolean;
  onRun: (task: TaskRowVM) => void;
}

const LIVE_STATUSES = new Set(["active", "running"]);

export function TaskBentoCard({ task, isOperator, isPending, onRun }: TaskBentoCardProps) {
  const isLiveStatus = LIVE_STATUSES.has(task.operationalStatus.toLowerCase());

  return (
    <div
      className={cn(
        "group console-panel rounded-lg p-4 flex h-full flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_32px_hsl(216,18%,3%/0.6),0_0_0_1px_hsl(var(--primary)/0.15)] cursor-pointer relative overflow-hidden",
        isLiveStatus && "task-bento-card-live",
      )}
      style={{
        background: "linear-gradient(180deg, hsl(216, 16%, 11%) 0%, hsl(216, 18%, 8%) 100%)",
        border: "1px solid hsl(216, 10%, 16% / 0.6)",
      }}
      onClick={() => onRun(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/10 text-primary shrink-0">
          <Play className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge label={task.operationalStatus} />
          {task.approvalGated && <AlertTriangle className="w-3 h-3 text-status-approval" />}
        </div>
      </div>

      <h3 className="font-mono text-sm font-bold text-foreground leading-tight tracking-wide">{task.label}</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        {task.category && (
          <span className="rounded border border-border/60 bg-panel-inset px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            {task.category}
          </span>
        )}
        {task.dependencyClass && (
          <span className="rounded border border-border/60 bg-panel-inset px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            {task.dependencyClass}
          </span>
        )}
        {task.baselineConfidence && (
          <span className="rounded border border-border/60 bg-panel-inset px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            {task.baselineConfidence} confidence
          </span>
        )}
      </div>

      {task.availabilityLabel && (
        <div className="flex items-center justify-between gap-2">
          <span className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-primary">
            {task.availabilityLabel}
          </span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed line-clamp-2">{task.purpose}</p>

      {task.dependencyRequirements && task.dependencyRequirements.length > 0 && (
        <p className="text-[10px] font-mono text-muted-foreground/80 leading-relaxed line-clamp-2">
          Depends on: {task.dependencyRequirements.join(" · ")}
        </p>
      )}

      <div className="opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-40 transition-all duration-300 overflow-hidden space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
          Execution: submit → queue → {task.approvalGated ? "approval → " : ""}worker → result
        </p>
        {task.caveats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.caveats.map((caveat, index) => (
              <span
                key={`${task.type}-caveat-${index}`}
                className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.1em]"
              >
                ⚠ {caveat}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
          <span>{task.totalRuns} runs</span>
          <span>{task.successRate}</span>
        </div>
        <Button
          size="sm"
          disabled={isPending || !isOperator}
          className="h-6 px-2 text-[10px] font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(event) => {
            event.stopPropagation();
            onRun(task);
          }}
          title={!isOperator ? "Operator role required" : undefined}
        >
          <Play className="w-2.5 h-2.5 mr-1" />
          {isOperator ? "Execute" : "View"}
        </Button>
      </div>
    </div>
  );
}
