export type CoordinationStore = "redis" | "memory";
export type CoordinationHealthStatus = "healthy" | "degraded" | "disabled";

export interface SharedCoordinationStoreOptions {
  redisUrl?: string | null;
  prefix?: string;
  connectTimeoutMs?: number;
  retryCooldownMs?: number;
  loggerPrefix?: string;
}

export interface CoordinationHealth {
  status: CoordinationHealthStatus;
  store: CoordinationStore;
  redisConfigured: boolean;
  redisReachable: boolean;
  detail: string;
  checkedAt: string;
  disabledUntil: string | null;
}

export interface LeaseClaimResult {
  acquired: boolean;
  store: CoordinationStore;
  owner: string;
  existingOwner: string | null;
  expiresAt: string | null;
}

export interface JsonReadResult<T> {
  value: T | null;
  store: CoordinationStore;
  expiresAt: string | null;
}

export interface JsonWriteResult {
  store: CoordinationStore;
  expiresAt: string | null;
}

export interface SharedCoordinationStore {
  getHealth(): Promise<CoordinationHealth>;
  claimLease(
    namespace: string,
    key: string,
    owner: string,
    ttlMs: number,
  ): Promise<LeaseClaimResult>;
  releaseLease(namespace: string, key: string, owner: string): Promise<boolean>;
  getJson<T = unknown>(namespace: string, key: string): Promise<JsonReadResult<T>>;
  setJson(
    namespace: string,
    key: string,
    value: unknown,
    options?: { ttlMs?: number | null },
  ): Promise<JsonWriteResult>;
  deleteKey(namespace: string, key: string): Promise<void>;
  getRemainingTtlMs(namespace: string, key: string): Promise<number | null>;
  close(): Promise<void>;
  resetMemory(): Promise<void>;
}

export function createSharedCoordinationStore(
  options?: SharedCoordinationStoreOptions,
): SharedCoordinationStore;
