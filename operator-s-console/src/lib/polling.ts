import { getRateLimit } from "@/lib/api-client";

const DEFAULT_JITTER_MS = 4000;

export function jitteredInterval(baseMs: number, spreadMs = DEFAULT_JITTER_MS): number {
  return baseMs + Math.floor(Math.random() * spreadMs);
}

export function nextProtectedPollInterval(
  baseMs: number,
  error: { status?: number } | null | undefined,
): number | false {
  if (error?.status === 401 || error?.status === 403) {
    return false;
  }

  if (error?.status === 429) {
    const rateLimit = getRateLimit();
    if (rateLimit.retryAfter && rateLimit.retryAfter > 0) {
      return rateLimit.retryAfter * 1000;
    }

    if (rateLimit.reset) {
      const waitMs = Math.max(1000, rateLimit.reset * 1000 - Date.now());
      return waitMs;
    }
  }

  return jitteredInterval(baseMs);
}
