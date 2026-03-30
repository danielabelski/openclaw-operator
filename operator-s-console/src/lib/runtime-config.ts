type ConfigSource = "env" | "lovable-fallback" | "same-origin-fallback" | "missing";

function readEnvValue(key: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env[key] ?? "").trim();
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function isLovableHostedOrigin(hostname: string): boolean {
  return hostname.trim().toLowerCase().endsWith(".lovable.app");
}

function isIntegratedLocalOperatorOrigin(location: Location): boolean {
  const hostname = location.hostname.trim().toLowerCase();
  const port = location.port.trim();
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  return isLocalhost && (port === "3000" || port === "3312");
}

function resolveBaseUrl(): { value: string; source: ConfigSource } {
  const envKey = "VITE_ORCHESTRATOR_API_BASE_URL";
  const configured = normalizeBaseUrl(readEnvValue(envKey));
  const hostedFallback = normalizeBaseUrl(
    readEnvValue("VITE_ORCHESTRATOR_HOSTED_FALLBACK_URL"),
  );

  if (typeof window !== "undefined") {
    if (isIntegratedLocalOperatorOrigin(window.location)) {
      return {
        value: normalizeBaseUrl(window.location.origin),
        source: "same-origin-fallback",
      };
    }

    if (configured) {
      return { value: configured, source: "env" };
    }

    if (isLovableHostedOrigin(window.location.hostname) && hostedFallback) {
      return {
        value: hostedFallback,
        source: "lovable-fallback",
      };
    }

    return {
      value: normalizeBaseUrl(window.location.origin),
      source: "same-origin-fallback",
    };
  }

  if (configured) {
    return { value: configured, source: "env" };
  }

  return {
    value: "",
    source: "missing",
  };
}

const orchestratorBase = resolveBaseUrl();

export function getOrchestratorBaseUrl(): string {
  return orchestratorBase.value;
}

export function isOrchestratorBaseConfigured(): boolean {
  return getOrchestratorBaseUrl().length > 0;
}

export function getOrchestratorBaseSource(): ConfigSource {
  return orchestratorBase.source;
}
