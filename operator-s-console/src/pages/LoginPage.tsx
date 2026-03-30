import { useState } from "react";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { LobsterEmblem } from "@/components/console/LobsterEmblem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrchestratorBaseSource, isOrchestratorBaseConfigured } from "@/lib/runtime-config";
import { KeyRound, AlertTriangle, Loader2, CheckCircle2, Wifi, ServerOff } from "lucide-react";

const BASE_CONFIGURED = isOrchestratorBaseConfigured();
const BASE_SOURCE = getOrchestratorBaseSource();

export default function LoginPage() {
  const { login, testConnection, isLoading, error } = useAuth();
  const [token, setToken] = useState("");
  const [testResult, setTestResult] = useState<AuthUser | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      login(token.trim());
    }
  };

  const handleTest = async () => {
    if (!token.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const user = await testConnection(token.trim());
      setTestResult(user);
    } catch (e: any) {
      setTestError(e?.message || "Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: `linear-gradient(180deg, hsl(216, 12%, 14%) 0%, hsl(216, 14%, 11%) 20%, hsl(216, 16%, 9%) 60%, hsl(216, 18%, 7%) 100%)`,
    }}>
      <div className="console-panel w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <LobsterEmblem size={64} />
          <h1 className="font-display font-black text-foreground tracking-[0.15em] text-xl" style={{
            textShadow: '0 2px 4px hsl(216, 18%, 3% / 0.6), 0 0 20px hsl(22, 90%, 52% / 0.08)',
          }}>
            OPENCLAW
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em]">
            Operator Console Authentication
          </p>
        </div>

        {!BASE_CONFIGURED && (
          <div className="warning-banner">
            <ServerOff className="w-4 h-4 text-status-error mt-0.5 shrink-0" />
            <p className="text-[11px] text-status-error font-mono">
              VITE_ORCHESTRATOR_API_BASE_URL is not configured. The console cannot connect to any backend.
            </p>
          </div>
        )}

        {BASE_CONFIGURED && BASE_SOURCE === "same-origin-fallback" && (
          <div className="console-inset p-3 rounded-sm">
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
              Build-time API env is missing. This console is using the same origin that served <span className="text-foreground">/operator</span>.
            </p>
          </div>
        )}

        {BASE_CONFIGURED && BASE_SOURCE === "lovable-fallback" && (
          <div className="warning-banner">
            <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-status-warning font-mono">
              Build-time API env is missing on this Lovable deployment. Using the canonical orchestrator fallback instead.
            </p>
          </div>
        )}

        {error && (
          <div className="warning-banner">
            <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
            <p className="text-[11px] text-status-warning font-mono">{error}</p>
          </div>
        )}

        {testResult && (
          <div className="console-panel p-3 space-y-2" style={{ borderColor: 'hsl(142, 65%, 40% / 0.3)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-status-healthy" />
              <span className="text-[11px] font-mono font-bold text-status-healthy uppercase tracking-wider">Connection OK</span>
            </div>
            <div className="console-inset p-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Actor</span>
                <span className="text-[10px] font-mono text-foreground font-bold">{testResult.actor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Role</span>
                <span className="text-[10px] font-mono text-foreground font-bold uppercase">{testResult.role}</span>
              </div>
              {testResult.apiKeyLabel && (
                <div className="flex justify-between">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Key Label</span>
                  <span className="text-[10px] font-mono text-foreground font-bold">{testResult.apiKeyLabel}</span>
                </div>
              )}
              {testResult.apiKeyVersion && (
                <div className="flex justify-between">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wide">Key Version</span>
                  <span className="text-[10px] font-mono text-foreground font-bold">{testResult.apiKeyVersion}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {testError && (
          <div className="warning-banner">
            <AlertTriangle className="w-4 h-4 text-status-error mt-0.5 shrink-0" />
            <p className="text-[11px] text-status-error font-mono">{testError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-[0.12em]">
              Orchestrator API Bearer Token
            </label>
            <Input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setTestResult(null); setTestError(null); }}
              placeholder="Enter your operator token..."
              className="bg-panel-inset border-border font-mono text-sm"
              autoFocus
            />
            <p className="text-[9px] text-muted-foreground font-mono tracking-wide">
              Token is stored locally in this browser so protected routes survive preview redirects.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !token.trim()}
              className="flex-1 font-mono text-xs uppercase tracking-wider"
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !token.trim()}
              className="flex-1 font-mono text-xs uppercase tracking-wider"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5 mr-2" />
              )}
              Authenticate
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
