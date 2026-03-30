import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDiagSummary } from "@/contexts/DiagnosticsContext";
import { JsonRenderer } from "@/components/console/JsonRenderer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/console/StatusBadge";
import {
  getOrchestratorBaseSource,
  getOrchestratorBaseUrl,
} from "@/lib/runtime-config";
import { Activity, Play, Loader2, RefreshCw, AlertTriangle, Timer } from "lucide-react";
import { getToken } from "@/lib/api-client";

const ORCHESTRATOR_BASE_URL = getOrchestratorBaseUrl();
const ORCHESTRATOR_BASE_SOURCE = getOrchestratorBaseSource();
const PROOF_BASE_URL = ORCHESTRATOR_BASE_URL;
const PROOF_BASE_SOURCE = ORCHESTRATOR_BASE_SOURCE;

interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
  retryAfter: number | null;
}

interface EndpointResult {
  path: string;
  surface: "orchestrator" | "proof";
  status: number | null;
  latencyMs: number | null;
  requestId: string | null;
  error: string | null;
  body: unknown | null;
  rateLimit: RateLimitInfo;
}

interface EndpointDefinition {
  path: string;
  auth: boolean;
  surface: "orchestrator" | "proof";
}

const ENDPOINTS: EndpointDefinition[] = [
  { path: "/health", auth: false, surface: "orchestrator" },
  { path: "/api/persistence/health", auth: false, surface: "orchestrator" },
  { path: "/api/knowledge/summary", auth: false, surface: "orchestrator" },
  { path: "/api/command-center/overview", auth: false, surface: "proof" },
  { path: "/api/command-center/control", auth: false, surface: "proof" },
  { path: "/api/command-center/demand", auth: false, surface: "proof" },
  { path: "/api/command-center/demand-live", auth: false, surface: "proof" },
  { path: "/api/milestones/latest", auth: false, surface: "proof" },
  { path: "/api/milestones/dead-letter", auth: false, surface: "proof" },
  { path: "/api/auth/me", auth: true, surface: "orchestrator" },
  { path: "/api/dashboard/overview", auth: true, surface: "orchestrator" },
  { path: "/api/tasks/catalog", auth: true, surface: "orchestrator" },
  { path: "/api/tasks/runs", auth: true, surface: "orchestrator" },
  { path: "/api/agents/overview", auth: true, surface: "orchestrator" },
  { path: "/api/skills/policy", auth: true, surface: "orchestrator" },
  { path: "/api/skills/registry", auth: true, surface: "orchestrator" },
  { path: "/api/skills/telemetry", auth: true, surface: "orchestrator" },
  { path: "/api/skills/audit", auth: true, surface: "orchestrator" },
  { path: "/api/health/extended", auth: true, surface: "orchestrator" },
  { path: "/api/persistence/summary", auth: true, surface: "orchestrator" },
];

const INTER_REQUEST_DELAY = 350;

function parseRateLimit(res: Response): RateLimitInfo {
  const get = (name: string) => res.headers.get(name);
  const rlLimit = get("ratelimit-limit") || get("x-ratelimit-limit");
  const rlRemaining = get("ratelimit-remaining") || get("x-ratelimit-remaining");
  const rlReset = get("ratelimit-reset") || get("x-ratelimit-reset");
  const retryAfter = get("retry-after");
  return {
    limit: rlLimit ? parseInt(rlLimit, 10) : null,
    remaining: rlRemaining ? parseInt(rlRemaining, 10) : null,
    reset: rlReset ? parseInt(rlReset, 10) : null,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
  };
}

function resolveBaseUrl(surface: "orchestrator" | "proof"): string {
  return surface === "proof" ? PROOF_BASE_URL : ORCHESTRATOR_BASE_URL;
}

function resolveBaseSource(surface: "orchestrator" | "proof"): string {
  return surface === "proof" ? PROOF_BASE_SOURCE : ORCHESTRATOR_BASE_SOURCE;
}

async function probeEndpoint(endpoint: EndpointDefinition): Promise<EndpointResult> {
  const { path, auth, surface } = endpoint;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (auth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl = resolveBaseUrl(surface);
  if (!baseUrl) {
    return {
      path,
      surface,
      status: null,
      latencyMs: null,
      requestId: null,
      error:
        surface === "proof"
          ? "Orchestrator public proof base is not configured"
          : "Orchestrator API base is not configured",
      body: null,
      rateLimit: { limit: null, remaining: null, reset: null, retryAfter: null },
    };
  }

  const start = performance.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const latencyMs = Math.round(performance.now() - start);
    const requestId = res.headers.get("X-Request-Id");
    const rateLimit = parseRateLimit(res);
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return {
      path,
      surface,
      status: res.status,
      latencyMs,
      requestId,
      error: res.ok ? null : res.status === 429 ? null : `HTTP ${res.status}`,
      body,
      rateLimit,
    };
  } catch (e: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      path,
      surface,
      status: null,
      latencyMs,
      requestId: null,
      error: e?.message || "Network error",
      body: null,
      rateLimit: { limit: null, remaining: null, reset: null, retryAfter: null },
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusColor(result: EndpointResult): string {
  if (!result.status) return "error";
  if (result.status === 429) return "approval";
  if (result.status >= 200 && result.status < 300) return "healthy";
  if (result.status === 401 || result.status === 403) return "warning";
  return "error";
}

function statusLabel(result: EndpointResult): string {
  if (!result.status) return "UNREACHABLE";
  if (result.status === 429) return "429 RATE LIMITED";
  if (result.status >= 200 && result.status < 300) return `${result.status} OK`;
  if (result.status === 401) return "401 UNAUTHORIZED";
  if (result.status === 403) return "403 FORBIDDEN";
  if (result.status >= 500) return `${result.status} SERVER ERROR`;
  return `${result.status}`;
}

function RateLimitCountdown({ resetEpoch, retryAfter }: { resetEpoch: number | null; retryAfter: number | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    const calcSeconds = () => {
      if (retryAfter != null && retryAfter > 0) return retryAfter;
      if (resetEpoch != null) return Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
      return 0;
    };
    setSecondsLeft(calcSeconds());
    const interval = setInterval(() => {
      const s = calcSeconds();
      setSecondsLeft(s);
      if (s <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [resetEpoch, retryAfter]);

  if (secondsLeft <= 0) return <span className="text-[9px] font-mono text-status-healthy">Ready to retry</span>;
  return (
    <span className="text-[10px] font-mono text-status-warning flex items-center gap-1">
      <Timer className="w-3 h-3" /> Retry in {secondsLeft}s
    </span>
  );
}

function DiagnosticResultRow({
  result,
  isExpanded,
  onToggle,
  onRetry,
}: {
  result: EndpointResult;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: (path: string, surface: "orchestrator" | "proof") => void;
}) {
  const is429 = result.status === 429;

  return (
    <div
      className="console-panel p-3 cursor-pointer hover:bg-panel-highlight/30 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StatusBadge label={statusColor(result)} />
          <span className="text-[11px] font-mono text-foreground truncate">{result.path}</span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">{result.surface}</span>
          <span className="text-[9px] font-mono text-muted-foreground">{statusLabel(result)}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {is429 && (
            <RateLimitCountdown resetEpoch={result.rateLimit.reset} retryAfter={result.rateLimit.retryAfter} />
          )}
          {result.latencyMs != null && (
            <span className="text-[10px] font-mono text-muted-foreground">{result.latencyMs}ms</span>
          )}
          {result.requestId && (
            <span className="text-[9px] font-mono text-muted-foreground/60 hidden sm:inline" title="X-Request-Id">
              {result.requestId}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {result.requestId && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">X-Request-Id:</span>
              <span className="text-[10px] font-mono text-foreground">{result.requestId}</span>
            </div>
          )}
          {result.rateLimit.limit != null && (
            <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
              <span>Limit: <span className="text-foreground">{result.rateLimit.limit}</span></span>
              <span>Remaining: <span className="text-foreground">{result.rateLimit.remaining ?? "—"}</span></span>
              {result.rateLimit.reset != null && (
                <span>Reset: <span className="text-foreground">{new Date(result.rateLimit.reset * 1000).toLocaleTimeString()}</span></span>
              )}
            </div>
          )}
          {result.error && (
            <div className="warning-banner">
              <AlertTriangle className="w-3.5 h-3.5 text-status-error shrink-0" />
              <span className="text-[10px] font-mono text-status-error">{result.error}</span>
            </div>
          )}
          {is429 && (
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-[10px] uppercase tracking-wider"
              onClick={() => onRetry(result.path, result.surface)}
            >
              <RefreshCw className="w-3 h-3 mr-1.5" /> Retry after cooldown
            </Button>
          )}
          {result.body && (
            <JsonRenderer data={result.body} maxHeight="200px" />
          )}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsPage() {
  const { hasRole } = useAuth();
  const { setSummary } = useDiagSummary();
  const [results, setResults] = useState<EndpointResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const abortRef = useRef(false);

  const isOperator = hasRole("operator");

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    setExpandedIdx(null);
    abortRef.current = false;

    const newResults: EndpointResult[] = [];
    for (let i = 0; i < ENDPOINTS.length; i++) {
      if (abortRef.current) break;
      const ep = ENDPOINTS[i];
      const result = await probeEndpoint(ep);
      newResults.push(result);
      setResults([...newResults]);
      // Inter-request delay (skip after last)
      if (i < ENDPOINTS.length - 1 && !abortRef.current) {
        await delay(INTER_REQUEST_DELAY);
      }
    }
    // Publish summary
    const pass = newResults.filter((r) => r.status && r.status >= 200 && r.status < 300).length;
    const fail = newResults.filter((r) => !r.status || (r.status >= 400 && r.status !== 429)).length;
    const rl = newResults.filter((r) => r.status === 429).length;
    const avg = newResults.length > 0 ? Math.round(newResults.reduce((s, r) => s + (r.latencyMs || 0), 0) / newResults.length) : 0;
    setSummary({ pass, fail, rateLimited: rl, total: newResults.length, avgLatencyMs: avg, lastRunAt: new Date().toISOString() });
    setIsRunning(false);
  }, [setSummary]);

  const retryOne = useCallback(async (path: string, surface: "orchestrator" | "proof") => {
    const ep = ENDPOINTS.find((e) => e.path === path && e.surface === surface);
    if (!ep) return;
    const result = await probeEndpoint(ep);
    setResults((prev) =>
      prev.map((r) => (r.path === path && r.surface === surface ? result : r)),
    );
  }, []);

  if (!isOperator) {
    return (
      <div className="space-y-5">
        <h2 className="page-title">Diagnostics</h2>
        <div className="warning-banner">
          <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
          <p className="text-[11px] font-mono text-status-warning">Operator role required for diagnostics.</p>
        </div>
      </div>
    );
  }

  const passCount = results.filter((r) => r.status && r.status >= 200 && r.status < 300).length;
  const failCount = results.filter((r) => !r.status || (r.status >= 400 && r.status !== 429)).length;
  const rateLimitedCount = results.filter((r) => r.status === 429).length;
  const orchestratorBaseLabel = ORCHESTRATOR_BASE_URL
    ? `${ORCHESTRATOR_BASE_URL} (${resolveBaseSource("orchestrator")})`
    : "not configured";
  const proofBaseLabel = PROOF_BASE_URL
    ? `${PROOF_BASE_URL} (${resolveBaseSource("proof")}, shared public surface)`
    : "not configured";

  return (
    <div className="space-y-5">
      <h2 className="page-title">Diagnostics</h2>

      <div className="console-inset p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground font-mono tracking-wide">
          <Activity className="w-3 h-3 inline mr-1.5 text-primary" />
          Contract verification — probes protected orchestrator routes and the orchestrator-owned public proof routes independently.
        </p>
        {!ORCHESTRATOR_BASE_URL && (
          <div className="warning-banner mt-2">
            <AlertTriangle className="w-4 h-4 text-status-error shrink-0" />
            <p className="text-[11px] font-mono text-status-error">
              VITE_ORCHESTRATOR_API_BASE_URL is not set. All requests will fail.
            </p>
          </div>
        )}
        {ORCHESTRATOR_BASE_URL && ORCHESTRATOR_BASE_SOURCE === "same-origin-fallback" && (
          <div className="console-inset mt-2 p-3 rounded-sm">
            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
              VITE_ORCHESTRATOR_API_BASE_URL is missing. Diagnostics are using the same origin that served this console.
            </p>
          </div>
        )}
        {ORCHESTRATOR_BASE_URL && ORCHESTRATOR_BASE_SOURCE === "lovable-fallback" && (
          <div className="warning-banner mt-2">
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
            <p className="text-[11px] font-mono text-status-warning">
              VITE_ORCHESTRATOR_API_BASE_URL is missing on this Lovable deployment. Diagnostics are using the canonical orchestrator fallback.
            </p>
          </div>
        )}
        {PROOF_BASE_URL && PROOF_BASE_SOURCE === "same-origin-fallback" && (
          <div className="console-inset mt-2 p-3 rounded-sm">
            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
              Public proof routes are sharing the same origin fallback, so protected and public checks are probing the same live orchestrator host.
            </p>
          </div>
        )}
        {PROOF_BASE_URL && PROOF_BASE_SOURCE === "lovable-fallback" && (
          <div className="warning-banner mt-2">
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
            <p className="text-[11px] font-mono text-status-warning">
              Public proof routes are sharing the orchestrator fallback base on this Lovable deployment.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-[10px] font-mono text-muted-foreground">
          <span>Orchestrator: <span className="text-foreground">{orchestratorBaseLabel}</span></span>
          <span>Proof: <span className="text-foreground">{proofBaseLabel}</span></span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={runAll}
          disabled={isRunning}
          className="font-mono text-xs uppercase tracking-wider"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : results.length > 0 ? (
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-2" />
          )}
          {isRunning
            ? `Testing (${results.length}/${ENDPOINTS.length})...`
            : results.length > 0
            ? "Re-run All"
            : "Run Diagnostics"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <span>
              Pass: <span className="text-status-healthy font-bold">{passCount}</span>
            </span>
            <span>
              Fail: <span className="text-status-error font-bold">{failCount}</span>
            </span>
            {rateLimitedCount > 0 && (
              <span>
                Rate Limited: <span className="text-status-warning font-bold">{rateLimitedCount}</span>
              </span>
            )}
            <span>
              Avg:{" "}
              <span className="text-foreground font-bold">
                {Math.round(results.reduce((s, r) => s + (r.latencyMs || 0), 0) / results.length)}ms
              </span>
            </span>
          </div>

          {results.map((result, idx) => (
            <DiagnosticResultRow
              key={result.path}
              result={result}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              onRetry={retryOne}
            />
          ))}
        </div>
      )}
    </div>
  );
}
