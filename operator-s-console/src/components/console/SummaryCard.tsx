import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SummaryCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight" | "warning" | "inset";
  collapsible?: boolean;
  headerAction?: ReactNode;
}

const panelVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export function SummaryCard({
  title,
  icon,
  children,
  className,
  variant = "default",
  collapsible = false,
  headerAction,
}: SummaryCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      className={cn(
        "console-panel p-0 overflow-hidden relative z-0 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-primary/15",
        variant === "highlight" && "console-glow border-primary/30",
        variant === "warning" && "border-status-warning/25",
        className
      )}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px opacity-80"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(22, 90%, 52% / 0.14) 18%, hsl(22, 90%, 52% / 0.42) 50%, hsl(22, 90%, 52% / 0.14) 82%, transparent 100%)",
        }}
      />
      {/* Panel header */}
      <div
        className={cn(
          "px-5 pt-4 pb-3 flex items-center justify-between relative z-10",
          "border-b border-border/40",
          collapsible && "cursor-pointer select-none"
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(216, 12%, 15%) 0%, hsl(216, 14%, 11%) 100%)',
        }}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className={cn(
              "text-primary",
              variant === "warning" && "text-status-warning"
            )}>
              {icon}
            </span>
          )}
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {headerAction && (
            <div onClick={(event) => event.stopPropagation()}>
              {headerAction}
            </div>
          )}
          {collapsible && (
            <motion.div
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          )}
          <div className="flex gap-1.5">
            <div className="rivet" />
            <div className="rivet" />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-5 bottom-0 h-px opacity-70"
          style={{
            background: "linear-gradient(90deg, transparent 0%, hsl(216, 8%, 30% / 0.15) 18%, hsl(22, 90%, 52% / 0.2) 50%, hsl(216, 8%, 30% / 0.15) 82%, transparent 100%)",
          }}
        />
      </div>

      {/* Panel content with animated collapse */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className={cn(
              "p-5 relative z-10",
              variant === "inset" && "console-inset m-2 p-4"
            )}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Metric module — hardware-style big numeric readout
interface MetricModuleProps {
  title: string;
  icon?: ReactNode;
  value: string | number | unknown;
  subtitle: string;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

/** Safely extract a displayable string from a value that might be an object */
function safeMetricDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value).padStart(2, "0");
  if (typeof value === "string") return value.padStart(2, "0");
  // If it's an object, try to extract a numeric field
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Common patterns: { count: N }, { value: N }, { total: N }, or just a number nested
    for (const key of ["count", "value", "total", "pending", "pendingCount"]) {
      if (typeof obj[key] === "number") return String(obj[key]).padStart(2, "0");
    }
    return JSON.stringify(value);
  }
  return String(value);
}

export function MetricModule({ title, icon, value, subtitle, className, glow, onClick }: MetricModuleProps) {
  return (
    <motion.div
      className={cn(
        "console-panel overflow-hidden relative z-0 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-primary/15",
        onClick && "cursor-pointer hover:border-primary/20 hover:bg-panel-highlight/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        glow && "console-glow",
        className
      )}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className="pointer-events-none absolute inset-x-3 top-0 h-px opacity-80"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(22, 90%, 52% / 0.08) 12%, hsl(22, 90%, 52% / 0.28) 50%, hsl(22, 90%, 52% / 0.08) 88%, transparent 100%)",
        }}
      />
      {/* Header strip */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40 relative z-10" style={{
        background: 'linear-gradient(180deg, hsl(216, 12%, 14%) 0%, hsl(216, 14%, 11%) 100%)',
      }}>
        {icon && <span className="text-primary">{icon}</span>}
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</span>
        <span className={cn("ml-auto indicator-light text-indicator-blue opacity-70", glow && "text-indicator-amber animate-glow-breathe")} style={{ width: 6, height: 6 }} />
      </div>
      {/* Digital readout */}
      <div className="px-4 py-4 console-inset m-2 rounded-sm text-center relative z-10">
        <p className="metric-value text-4xl">{safeMetricDisplay(value)}</p>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.15em] mt-2 font-semibold">{subtitle}</p>
      </div>
    </motion.div>
  );
}
