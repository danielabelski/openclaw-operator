import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTaskCatalog } from "@/hooks/use-console-api";
import { useAuth } from "@/contexts/AuthContext";
import { bool, str, toArray } from "@/lib/safe-render";
import { cn } from "@/lib/utils";
import { ArrowRight, Command as CommandIcon, Compass, Play, Search, Zap } from "lucide-react";
import { toast } from "sonner";

interface PaletteTask {
  type: string;
  label: string;
  purpose: string;
  operationalStatus: string;
  approvalGated: boolean;
}

const NAV_SHORTCUTS = [
  { to: "/", label: "Overview", keywords: "dashboard home" },
  { to: "/tasks", label: "Tasks", keywords: "task catalog execute" },
  { to: "/task-runs", label: "Runs", keywords: "history queue executions" },
  { to: "/approvals", label: "Approvals", keywords: "review gated" },
  { to: "/incidents", label: "Incidents", keywords: "alerts remediation ownership" },
  { to: "/agents", label: "Agents", keywords: "workers fleet" },
  { to: "/governance", label: "Governance", keywords: "policy controls" },
  { to: "/knowledge", label: "Knowledge", keywords: "memory docs" },
  { to: "/system-health", label: "System Health", keywords: "health incidents" },
  { to: "/diagnostics", label: "Diagnostics", keywords: "logs traces" },
];

function buildPaletteTasks(catalog: any): PaletteTask[] {
  return toArray(catalog?.tasks)
    .filter((task: any) => task?.exposeInV1 !== false && !task?.internalOnly)
    .map((task: any) => ({
      type: str(task?.type, "unknown"),
      label: str(task?.label, "Unknown Task"),
      purpose: str(task?.purpose, "—"),
      operationalStatus: str(task?.operationalStatus, "unknown"),
      approvalGated: bool(task?.approvalGated),
    }));
}

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();
  const { data: catalog } = useTaskCatalog();

  const tasks = useMemo(() => buildPaletteTasks(catalog), [catalog]);

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onOpenRequest = () => setOpen(true);

    window.addEventListener("keydown", onHotkey);
    window.addEventListener("open-global-command-palette", onOpenRequest as EventListener);

    return () => {
      window.removeEventListener("keydown", onHotkey);
      window.removeEventListener("open-global-command-palette", onOpenRequest as EventListener);
    };
  }, []);

  const handleNavigate = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const handleTaskSelect = (task: PaletteTask) => {
    if (!hasRole("operator")) {
      toast.error("Operator role required to execute tasks");
      setOpen(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("openTask", task.type);
    setOpen(false);
    navigate({ pathname: "/tasks", search: `?${params.toString()}` });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      <div
        className="relative flex items-start justify-center px-3 pt-[10vh] sm:px-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-palette-shell w-full max-w-2xl overflow-hidden rounded-lg border border-border/40">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

          <Command className="bg-transparent" shouldFilter loop>
            <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CommandInput
                placeholder="Navigate sections or find a task..."
                className="h-11 border-0 bg-transparent font-mono text-sm focus:ring-0"
              />
              <kbd className="hidden h-5 items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                <CommandIcon className="h-2.5 w-2.5" />
                K
              </kbd>
            </div>

            <CommandList className="max-h-[62vh] p-2">
              <CommandEmpty className="py-8 text-center font-mono text-xs text-muted-foreground">
                No results in shortcuts or tasks.
              </CommandEmpty>

              <CommandGroup heading="Console Sections">
                {NAV_SHORTCUTS.map((item) => {
                  const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);

                  return (
                    <CommandItem
                      key={item.to}
                      value={`${item.label} ${item.keywords}`}
                      onSelect={() => handleNavigate(item.to)}
                      className="group flex items-center gap-3 rounded-md px-3 py-2.5 data-[selected=true]:bg-accent/60"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40",
                          isActive && "border-primary/40 bg-primary/15 text-primary",
                        )}
                      >
                        <Compass className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs uppercase tracking-wide text-foreground">
                          {item.label}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">Open {item.label} view</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <CommandSeparator className="mx-2" />

              <CommandGroup heading="Task Shortcuts">
                {tasks.map((task) => (
                  <CommandItem
                    key={task.type}
                    value={`${task.label} ${task.type} ${task.purpose} ${task.operationalStatus}`}
                    onSelect={() => handleTaskSelect(task)}
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 data-[selected=true]:bg-accent/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                      <Play className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-mono text-xs uppercase tracking-wide text-foreground">
                          {task.label}
                        </p>
                        {task.approvalGated && <Zap className="h-3 w-3 shrink-0 text-status-approval" />}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">{task.purpose}</p>
                    </div>
                    <span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {task.operationalStatus}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>

            <div className="flex items-center justify-between border-t border-border/30 px-4 py-2 text-[10px] font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/50 bg-muted/30 px-1">↵</kbd>
                run command
              </span>
              <span>Cmd/Ctrl + K</span>
            </div>
          </Command>
        </div>
      </div>
    </div>
  );
}
