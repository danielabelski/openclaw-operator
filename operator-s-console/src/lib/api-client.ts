// OpenClaw API Client — real backend integration
import { normalizeObject } from "@/lib/normalize";
import { getOrchestratorBaseUrl } from "@/lib/runtime-config";

const TOKEN_STORAGE_KEY = "openclaw.operator.token";

function readStoredToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return token && token.trim().length > 0 ? token : null;
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (token && token.trim().length > 0) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage access can fail in privacy-restricted contexts; keep in-memory fallback.
  }
}

let _token: string | null = readStoredToken();
let _lastRequestId: string | null = null;
let _apiKeyExpires: string | null = null;

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null; // epoch seconds
  retryAfter: number | null; // seconds
}

let _rateLimit: RateLimitInfo = { limit: null, remaining: null, reset: null, retryAfter: null };

export function setToken(token: string | null) {
  _token = token;
  writeStoredToken(token);
}

export function getToken(): string | null {
  if (!_token) {
    _token = readStoredToken();
  }
  return _token;
}

export function clearToken() {
  _token = null;
  writeStoredToken(null);
}

export function getLastRequestId(): string | null {
  return _lastRequestId;
}

export function getApiKeyExpires(): string | null {
  return _apiKeyExpires;
}

export function getRateLimit(): RateLimitInfo {
  return { ..._rateLimit };
}

const BASE_URL = getOrchestratorBaseUrl();

export class ApiError extends Error {
  status: number;
  body: unknown;
  requestId: string | null;
  constructor(status: number, body: unknown, requestId: string | null = null) {
    const userMessage =
      status === 401 ? "Authentication required — invalid or expired token" :
      status === 403 ? "Insufficient permissions for this action" :
      status === 429 ? "Rate limited — please wait before retrying" :
      status >= 500 ? "Server error — the backend may be unavailable" :
      `API error ${status}`;
    super(userMessage);
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Capture response headers
  const requestId = res.headers.get("X-Request-Id");
  if (requestId) {
    _lastRequestId = requestId;
  }

  const expiresHeader = res.headers.get("X-API-Key-Expires");
  if (expiresHeader) {
    _apiKeyExpires = expiresHeader;
  }

  // Capture rate limit headers
  const rlLimit = res.headers.get("ratelimit-limit") || res.headers.get("x-ratelimit-limit");
  const rlRemaining = res.headers.get("ratelimit-remaining") || res.headers.get("x-ratelimit-remaining");
  const rlReset = res.headers.get("ratelimit-reset") || res.headers.get("x-ratelimit-reset");
  const retryAfter = res.headers.get("retry-after");

  _rateLimit = {
    limit: rlLimit ? parseInt(rlLimit, 10) : null,
    remaining: rlRemaining ? parseInt(rlRemaining, 10) : null,
    reset: rlReset ? parseInt(rlReset, 10) : null,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
  };

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, body, requestId);
  }

  const raw = await res.json();
  return normalizeObject<T>(raw);
}

export async function apiFetchText(
  path: string,
  options: RequestInit = {}
): Promise<string> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const requestId = res.headers.get("X-Request-Id");
  if (requestId) {
    _lastRequestId = requestId;
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, body, requestId);
  }

  return res.text();
}
