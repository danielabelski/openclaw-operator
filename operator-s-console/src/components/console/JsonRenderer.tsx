// Small JSON renderer — displays objects/arrays as formatted JSON in a <pre>
// Use anywhere a field might be non-primitive to avoid [object Object]

import { cn } from "@/lib/utils";

interface JsonRendererProps {
  data: unknown;
  className?: string;
  maxHeight?: string;
}

export function JsonRenderer({ data, className, maxHeight = "300px" }: JsonRendererProps) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic text-[10px] font-mono">null</span>;
  }

  if (typeof data !== "object") {
    return <span className="text-[11px] font-mono text-foreground">{String(data)}</span>;
  }

  return (
    <pre
      className={cn(
        "console-inset p-3 text-[10px] font-mono text-foreground/80 overflow-auto whitespace-pre-wrap break-all rounded-sm",
        className
      )}
      style={{ maxHeight }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/** Render a value: if primitive, as string; if object/array, as JsonRenderer */
export function SmartValue({ value, className }: { value: unknown; className?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic text-[10px] font-mono">—</span>;
  }
  if (typeof value === "object") {
    return <JsonRenderer data={value} className={className} />;
  }
  return <span className={cn("text-[11px] font-mono text-foreground", className)}>{String(value)}</span>;
}
