import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_PREFIX = "openclaw:coordination";
const DEFAULT_CONNECT_TIMEOUT_MS = 250;
const DEFAULT_RETRY_COOLDOWN_MS = 30_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

let redisModulePromise = null;

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeIso(expiresAt) {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return null;
  }
  return new Date(expiresAt).toISOString();
}

async function loadRedisModule() {
  if (redisModulePromise) {
    return redisModulePromise;
  }

  redisModulePromise = (async () => {
    const resolutionPaths = [
      undefined,
      [resolve(__dirname, "../..")],
      [resolve(__dirname, "../../orchestrator")],
    ];

    let lastError = null;
    for (const paths of resolutionPaths) {
      try {
        const resolved = requireFromHere.resolve("redis", paths ? { paths } : undefined);
        return await import(pathToFileURL(resolved).href);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Unable to resolve redis module for coordination");
  })();

  return redisModulePromise;
}

export function createSharedCoordinationStore(options = {}) {
  const redisUrl =
    typeof options.redisUrl === "string"
      ? options.redisUrl.trim()
      : process.env.REDIS_URL?.trim() ?? "";
  const prefix =
    typeof options.prefix === "string" && options.prefix.trim().length > 0
      ? options.prefix.trim()
      : DEFAULT_PREFIX;
  const loggerPrefix =
    typeof options.loggerPrefix === "string" && options.loggerPrefix.trim().length > 0
      ? options.loggerPrefix.trim()
      : "coordination";
  const connectTimeoutMs = normalizePositiveInt(
    options.connectTimeoutMs,
    DEFAULT_CONNECT_TIMEOUT_MS,
  );
  const retryCooldownMs = normalizePositiveInt(
    options.retryCooldownMs,
    DEFAULT_RETRY_COOLDOWN_MS,
  );

  const memoryEntries = new Map();

  let redisClient = null;
  let redisConnectPromise = null;
  let redisDisabledUntil = 0;
  let lastWarning = null;

  function logWarning(message) {
    if (lastWarning === message) return;
    lastWarning = message;
    console.warn(`[${loggerPrefix}] ${message}`);
  }

  function buildKey(namespace, key) {
    const normalizedNamespace = String(namespace ?? "").trim();
    const normalizedKey = String(key ?? "").trim();
    if (!normalizedNamespace || !normalizedKey) {
      throw new Error("coordination namespace and key are required");
    }
    return `${prefix}:${normalizedNamespace}:${normalizedKey}`;
  }

  function pruneMemory(now = Date.now()) {
    for (const [key, entry] of memoryEntries.entries()) {
      if (typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
        memoryEntries.delete(key);
      }
    }
  }

  async function getRedisClient() {
    if (!redisUrl) return null;

    if (redisClient?.isOpen) {
      return redisClient;
    }

    if (redisConnectPromise) {
      return redisConnectPromise;
    }

    if (redisDisabledUntil > Date.now()) {
      return null;
    }

    redisConnectPromise = (async () => {
      try {
        const redisModule = await loadRedisModule();
        const createClient = redisModule.createClient ?? redisModule.default?.createClient;
        if (typeof createClient !== "function") {
          throw new Error("redis module did not expose createClient");
        }

        const nextClient = createClient({
          url: redisUrl,
          socket: {
            connectTimeout: connectTimeoutMs,
            reconnectStrategy: false,
          },
        });
        nextClient.on("error", (error) => {
          logWarning(`redis client error: ${error.message}`);
        });

        await nextClient.connect();
        redisClient = nextClient;
        lastWarning = null;
        return nextClient;
      } catch (error) {
        redisDisabledUntil = Date.now() + retryCooldownMs;
        logWarning(
          `redis unavailable; using in-memory coordination fallback for ${Math.round(
            retryCooldownMs / 1000,
          )}s after ${connectTimeoutMs}ms timeout: ${error.message}`,
        );
        if (redisClient?.isOpen) {
          await redisClient.disconnect().catch(() => {});
        }
        redisClient = null;
        return null;
      } finally {
        redisConnectPromise = null;
      }
    })();

    return redisConnectPromise;
  }

  async function claimLease(namespace, key, owner, ttlMs) {
    const normalizedOwner = String(owner ?? "").trim();
    if (!normalizedOwner) {
      throw new Error("coordination lease owner is required");
    }

    const fullKey = buildKey(namespace, key);
    const ttl = Math.max(1_000, normalizePositiveInt(ttlMs, 60_000));
    const payload = JSON.stringify({
      owner: normalizedOwner,
      acquiredAt: new Date().toISOString(),
    });

    const client = await getRedisClient();
    if (client) {
      try {
        const result = await client.set(fullKey, payload, { NX: true, PX: ttl });
        if (result === "OK") {
          return {
            acquired: true,
            store: "redis",
            owner: normalizedOwner,
            existingOwner: null,
            expiresAt: new Date(Date.now() + ttl).toISOString(),
          };
        }

        const existingRaw = await client.get(fullKey);
        const remainingTtlMs = await client.pTTL(fullKey);
        let existingOwner = null;
        try {
          existingOwner = JSON.parse(existingRaw ?? "null")?.owner ?? null;
        } catch {
          existingOwner = null;
        }

        return {
          acquired: false,
          store: "redis",
          owner: normalizedOwner,
          existingOwner,
          expiresAt:
            typeof remainingTtlMs === "number" && remainingTtlMs > 0
              ? new Date(Date.now() + remainingTtlMs).toISOString()
              : null,
        };
      } catch (error) {
        logWarning(`redis lease claim failed; falling back to memory: ${error.message}`);
      }
    }

    pruneMemory();
    const existing = memoryEntries.get(fullKey);
    if (
      existing &&
      (existing.expiresAt === null || existing.expiresAt > Date.now())
    ) {
      let existingOwner = null;
      try {
        existingOwner = JSON.parse(existing.value)?.owner ?? null;
      } catch {
        existingOwner = null;
      }
      return {
        acquired: false,
        store: "memory",
        owner: normalizedOwner,
        existingOwner,
        expiresAt: normalizeIso(existing.expiresAt),
      };
    }

    memoryEntries.set(fullKey, {
      value: payload,
      expiresAt: Date.now() + ttl,
    });
    return {
      acquired: true,
      store: "memory",
      owner: normalizedOwner,
      existingOwner: null,
      expiresAt: new Date(Date.now() + ttl).toISOString(),
    };
  }

  async function releaseLease(namespace, key, owner) {
    const normalizedOwner = String(owner ?? "").trim();
    if (!normalizedOwner) {
      throw new Error("coordination lease owner is required");
    }

    const fullKey = buildKey(namespace, key);
    const client = await getRedisClient();
    if (client) {
      try {
        const existingRaw = await client.get(fullKey);
        const existingOwner = JSON.parse(existingRaw ?? "null")?.owner ?? null;
        if (existingOwner !== normalizedOwner) {
          return false;
        }
        await client.del(fullKey);
        return true;
      } catch (error) {
        logWarning(`redis lease release failed; falling back to memory: ${error.message}`);
      }
    }

    pruneMemory();
    const existing = memoryEntries.get(fullKey);
    if (!existing) return false;

    try {
      const existingOwner = JSON.parse(existing.value)?.owner ?? null;
      if (existingOwner !== normalizedOwner) {
        return false;
      }
    } catch {
      return false;
    }

    memoryEntries.delete(fullKey);
    return true;
  }

  async function getJson(namespace, key) {
    const fullKey = buildKey(namespace, key);

    const client = await getRedisClient();
    if (client) {
      try {
        const [existingRaw, remainingTtlMs] = await Promise.all([
          client.get(fullKey),
          client.pTTL(fullKey),
        ]);
        return {
          value: existingRaw ? JSON.parse(existingRaw) : null,
          store: "redis",
          expiresAt:
            typeof remainingTtlMs === "number" && remainingTtlMs > 0
              ? new Date(Date.now() + remainingTtlMs).toISOString()
              : null,
        };
      } catch (error) {
        logWarning(`redis read failed; falling back to memory: ${error.message}`);
      }
    }

    pruneMemory();
    const existing = memoryEntries.get(fullKey);
    if (!existing) {
      return { value: null, store: "memory", expiresAt: null };
    }

    return {
      value: JSON.parse(existing.value),
      store: "memory",
      expiresAt: normalizeIso(existing.expiresAt),
    };
  }

  async function setJson(namespace, key, value, options = {}) {
    const fullKey = buildKey(namespace, key);
    const payload = JSON.stringify(value);
    const ttlMs =
      options.ttlMs === null || options.ttlMs === undefined
        ? null
        : Math.max(1_000, normalizePositiveInt(options.ttlMs, 1_000));

    const client = await getRedisClient();
    if (client) {
      try {
        if (ttlMs === null) {
          await client.set(fullKey, payload);
        } else {
          await client.set(fullKey, payload, { PX: ttlMs });
        }
        return { store: "redis", expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null };
      } catch (error) {
        logWarning(`redis write failed; falling back to memory: ${error.message}`);
      }
    }

    pruneMemory();
    memoryEntries.set(fullKey, {
      value: payload,
      expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
    });
    return {
      store: "memory",
      expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null,
    };
  }

  async function deleteKey(namespace, key) {
    const fullKey = buildKey(namespace, key);
    const client = await getRedisClient();
    if (client) {
      try {
        await client.del(fullKey);
      } catch (error) {
        logWarning(`redis delete failed; falling back to memory: ${error.message}`);
      }
    }
    memoryEntries.delete(fullKey);
  }

  async function getRemainingTtlMs(namespace, key) {
    const fullKey = buildKey(namespace, key);
    const client = await getRedisClient();
    if (client) {
      try {
        const remainingTtlMs = await client.pTTL(fullKey);
        return typeof remainingTtlMs === "number" && remainingTtlMs > 0
          ? remainingTtlMs
          : null;
      } catch (error) {
        logWarning(`redis ttl read failed; falling back to memory: ${error.message}`);
      }
    }

    pruneMemory();
    const existing = memoryEntries.get(fullKey);
    if (!existing || existing.expiresAt === null) {
      return null;
    }
    return Math.max(0, existing.expiresAt - Date.now());
  }

  async function getHealth() {
    const checkedAt = new Date().toISOString();
    if (!redisUrl) {
      return {
        status: "disabled",
        store: "memory",
        redisConfigured: false,
        redisReachable: false,
        detail: "REDIS_URL is not configured; coordination is running in memory-only mode.",
        checkedAt,
        disabledUntil: null,
      };
    }

    const client = await getRedisClient();
    if (client) {
      return {
        status: "healthy",
        store: "redis",
        redisConfigured: true,
        redisReachable: true,
        detail: "Redis-backed coordination is active for shared claims, locks, and budgets.",
        checkedAt,
        disabledUntil: null,
      };
    }

    return {
      status: "degraded",
      store: "memory",
      redisConfigured: true,
      redisReachable: false,
      detail:
        lastWarning ??
        "Redis is configured but unavailable; coordination is temporarily falling back to memory.",
      checkedAt,
      disabledUntil: normalizeIso(redisDisabledUntil),
    };
  }

  async function close() {
    if (redisClient?.isOpen) {
      await redisClient.disconnect();
    }
    redisClient = null;
    redisConnectPromise = null;
    redisDisabledUntil = 0;
  }

  async function resetMemory() {
    memoryEntries.clear();
    redisDisabledUntil = 0;
    lastWarning = null;
    if (redisClient?.isOpen) {
      await redisClient.disconnect().catch(() => {});
    }
    redisClient = null;
    redisConnectPromise = null;
  }

  return {
    getHealth,
    claimLease,
    releaseLease,
    getJson,
    setJson,
    deleteKey,
    getRemainingTtlMs,
    close,
    resetMemory,
  };
}
