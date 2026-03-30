import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface DiagSummary {
  pass: number;
  fail: number;
  rateLimited: number;
  total: number;
  avgLatencyMs: number;
  lastRunAt: string | null; // ISO string
}

const empty: DiagSummary = { pass: 0, fail: 0, rateLimited: 0, total: 0, avgLatencyMs: 0, lastRunAt: null };

interface DiagStoreCtx {
  summary: DiagSummary;
  setSummary: (s: DiagSummary) => void;
}

const Ctx = createContext<DiagStoreCtx>({ summary: empty, setSummary: () => {} });

export function DiagnosticsProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<DiagSummary>(empty);
  return <Ctx.Provider value={{ summary, setSummary }}>{children}</Ctx.Provider>;
}

export function useDiagSummary() {
  return useContext(Ctx);
}
