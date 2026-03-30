import type { ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type GuidanceTone = "info" | "warning" | "tip";

interface GuidancePanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: GuidanceTone;
  eyebrow?: string;
}

const toneStyles: Record<GuidanceTone, { icon: typeof Info; className: string; iconClassName: string }> = {
  info: {
    icon: Info,
    className: "border-border/70 bg-panel-inset",
    iconClassName: "text-sky-300",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-status-warning/30 bg-status-warning/5",
    iconClassName: "text-status-warning",
  },
  tip: {
    icon: Lightbulb,
    className: "border-primary/20 bg-primary/5",
    iconClassName: "text-primary",
  },
};

export function GuidancePanel({
  title,
  children,
  className,
  tone = "info",
  eyebrow,
}: GuidancePanelProps) {
  const toneStyle = toneStyles[tone];
  const Icon = toneStyle.icon;

  return (
    <div className={cn("console-inset rounded-sm border px-4 py-3", toneStyle.className, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneStyle.iconClassName)} />
        <div className="min-w-0 space-y-1.5">
          {eyebrow && (
            <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-foreground">
            {title}
          </p>
          <div className="space-y-1.5 text-[10px] font-mono text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GuidanceListProps {
  items: string[];
  className?: string;
}

export function GuidanceList({ items, className }: GuidanceListProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {items.map((item, index) => (
        <div
          key={`${index}-${item}`}
          className="activity-cell flex items-start gap-2 px-3 py-2"
        >
          <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
          <p className="text-[10px] font-mono text-foreground leading-relaxed">{item}</p>
        </div>
      ))}
    </div>
  );
}
