import { afterEach, describe, expect, it, vi } from "vitest";

import { createSharedCoordinationStore } from "../../agents/shared/runtime-coordination.js";
import * as runtimeCoordination from "../src/coordination/runtime-coordination.js";
import { MongoConnection } from "../src/persistence/mongo-connection.js";
import { PersistenceIntegration } from "../src/persistence/persistence-integration.js";
import {
  buildDocRepairFingerprint,
  buildDocRepairRepairId,
} from "../src/coordination/runtime-coordination.js";
import {
  loadProcessedDraftIds,
  loadSharedBudgetState,
  rememberProcessedDraftId,
  resetRedditCoordinationStoreForTests,
  saveSharedBudgetState,
} from "../../agents/reddit-helper/src/coordination.ts";

afterEach(() => {
  PersistenceIntegration.resetHealthCacheForTests();
  vi.restoreAllMocks();
});

describe("shared coordination store", () => {
  afterEach(async () => {
    await resetRedditCoordinationStoreForTests();
  });

  it("claims a lease once and reports the existing owner for duplicates", async () => {
    const store = createSharedCoordinationStore({
      redisUrl: "",
      prefix: `test:coordination:${Date.now()}`,
      loggerPrefix: "coordination-test",
    });

    const first = await store.claimLease("task-execution", "run-1", "worker-a", 10_000);
    const second = await store.claimLease("task-execution", "run-1", "worker-b", 10_000);

    expect(first).toMatchObject({
      acquired: true,
      store: "memory",
      owner: "worker-a",
    });
    expect(second).toMatchObject({
      acquired: false,
      store: "memory",
      existingOwner: "worker-a",
    });

    await store.close();
  });

  it("persists reddit-helper budgets and processed draft ids through shared coordination state", async () => {
    const budgetDate = "2026-03-20";

    expect(await loadSharedBudgetState(budgetDate)).toMatchObject({
      budgetDate,
      llmCallsToday: 0,
      tokensToday: 0,
      budgetStatus: "ok",
    });

    await saveSharedBudgetState({
      budgetDate,
      llmCallsToday: 2,
      tokensToday: 480,
      budgetStatus: "ok",
    });

    expect(await loadSharedBudgetState(budgetDate)).toMatchObject({
      budgetDate,
      llmCallsToday: 2,
      tokensToday: 480,
      budgetStatus: "ok",
    });

    expect(await loadProcessedDraftIds()).toEqual([]);
    await rememberProcessedDraftId("draft-1");
    await rememberProcessedDraftId("draft-2");
    await rememberProcessedDraftId("draft-1");
    expect(await loadProcessedDraftIds()).toEqual(["draft-1", "draft-2"]);
  });

  it("builds stable doc-repair fingerprints and ids regardless of path order", () => {
    const firstPaths = ["docs/a.md", "docs/b.md", "docs/a.md"];
    const secondPaths = ["docs/b.md", "docs/a.md"];

    expect(buildDocRepairFingerprint(firstPaths)).toBe("docs/a.md|docs/b.md");
    expect(buildDocRepairFingerprint(firstPaths)).toBe(
      buildDocRepairFingerprint(secondPaths),
    );
    expect(buildDocRepairRepairId(firstPaths)).toBe(
      buildDocRepairRepairId(secondPaths),
    );
  });
});

describe("persistence health snapshot caching", () => {
  it("deduplicates live dependency probes across concurrent and repeated reads", async () => {
    const mongoSpy = vi
      .spyOn(MongoConnection, "healthCheck")
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return true;
      });
    const coordinationSpy = vi
      .spyOn(runtimeCoordination, "getRuntimeCoordinationHealth")
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          status: "healthy",
          store: "redis",
          redisConfigured: true,
          redisReachable: true,
          detail: "Redis-backed coordination is active for shared claims, locks, and budgets.",
          checkedAt: new Date().toISOString(),
          disabledUntil: null,
        };
      });

    const first = PersistenceIntegration.healthCheck();
    const second = PersistenceIntegration.healthCheck();
    const [firstResult, secondResult, thirdResult] = await Promise.all([
      first,
      second,
      PersistenceIntegration.healthCheck(),
    ]);

    expect(firstResult.status).toBe("healthy");
    expect(secondResult).toEqual(firstResult);
    expect(thirdResult).toEqual(firstResult);
    expect(mongoSpy).toHaveBeenCalledTimes(1);
    expect(coordinationSpy).toHaveBeenCalledTimes(1);
  });
});
