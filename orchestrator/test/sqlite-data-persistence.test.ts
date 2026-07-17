import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { COLLECTIONS } from "../src/persistence/schemas.ts";
import { SqliteDataPersistence } from "../src/persistence/sqlite-data-persistence.ts";
import { createStateStore } from "../src/state-store.ts";

const roots: string[] = [];

afterEach(async () => {
  await SqliteDataPersistence.close();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("normalized SQLite persistence", () => {
  it("imports all nine Mongo collections with typed rows and lossless archive evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "openclaw-normalized-sqlite-"));
    roots.push(root);
    const path = join(root, "operator.sqlite");
    const now = new Date("2026-07-16T00:00:00.000Z");
    const coreState = { updatedAt: now.toISOString(), taskExecutions: [{ id: "run-1" }] };
    const documents = {
      [COLLECTIONS.METRICS]: [{ _id: "metric-1", name: "latency", value: 12, unit: "ms", timestamp: now, labels: { lane: "test" } }],
      [COLLECTIONS.ALERTS]: [{ _id: "alert-1", name: "warning", severity: "warning", status: "firing", message: "test", fingerprint: "fp-1", timestamp: now }],
      [COLLECTIONS.KNOWLEDGE_BASE]: [{ _id: "kb-source-1", id: "kb-1", title: "Test", category: "runbook", severity: "low", solution: "Verify", createdAt: now, updatedAt: now }],
      [COLLECTIONS.CONSOLIDATIONS]: [{ _id: "consolidation-1", date: "2026-07-16", timestamp: now, snapshots: { count: 1, timeRange: { start: now, end: now } }, alerts: { total: 0, bySeverity: {}, topIssues: [] }, metrics: { total: 1, anomalies: [], trends: [] }, summary: "ok", insights: [], recommendations: [] }],
      [COLLECTIONS.SNAPSHOTS]: [{ _id: "snapshot-1", snapshotDate: "2026-07-16", timestamp: now, metrics: { activeMetrics: 1, anomalies: 0, p50Latency: 1, p95Latency: 2, p99Latency: 3 }, alerts: { total: 0, active: 0, resolved: 0, bySeverity: {} }, health: { orchestratorUp: true, prometheusUp: true, mongoUp: true, redisUp: true } }],
      [COLLECTIONS.SYSTEM_STATE]: [{ _id: "state-source-1", key: "orchestrator-runtime-state", encoding: "gzip-json", payload: gzipSync(Buffer.from(JSON.stringify(coreState))), payloadBytes: 1, version: 7, updatedAt: now }],
      [COLLECTIONS.AUDIT_LOGS]: [{ _id: "audit-1", action: "test", actor: "operator", resource: "sqlite", timestamp: now, status: "success" }],
      [COLLECTIONS.CONCEPTS]: [{ _id: "concept-source-1", id: "concept-1", name: "SQLite", type: "service", relatedConcepts: [], frequency: 1, createdAt: now, updatedAt: now }],
      [COLLECTIONS.CONCEPT_LINKS]: [{ _id: "link-1", fromId: "concept-1", toId: "concept-2", relationship: "related_to", strength: 0.9, evidence: ["test"], frequency: 1, createdAt: now, updatedAt: now }],
    };

    await SqliteDataPersistence.initialize(path);
    SqliteDataPersistence.startMigration("run-1", "rehearsal", "orchestrator-runtime-state");
    const evidence = Object.entries(documents).map(([collection, values]) =>
      SqliteDataPersistence.importMongoCollection(
        "run-1",
        collection as (typeof COLLECTIONS)[keyof typeof COLLECTIONS],
        values,
      ),
    );

    const stateStore = createStateStore<typeof coreState>(`sqlite:${path}`);
    await stateStore.save(coreState);
    expect(await stateStore.load()).toEqual(coreState);

    expect(evidence).toHaveLength(9);
    for (const item of evidence) {
      expect(item.sourceCount).toBe(1);
      expect(item.typedCount).toBe(1);
      expect(item.archiveCount).toBe(1);
      expect(item.archiveChecksum).toBe(item.sourceChecksum);
    }
    expect(await SqliteDataPersistence.getCollectionStats()).toEqual(
      Object.fromEntries(Object.values(COLLECTIONS).map((name) => [name, 1])),
    );
    expect((await SqliteDataPersistence.getMetrics("latency"))[0]).toMatchObject({ name: "latency", value: 12 });
    expect((await SqliteDataPersistence.getAlerts("warning", "firing"))[0]).toMatchObject({ fingerprint: "fp-1" });
    expect((await SqliteDataPersistence.getAllKBEntries())[0]).toMatchObject({ id: "kb-1", title: "Test" });
    expect(await SqliteDataPersistence.getSystemStateRecord("orchestrator-runtime-state")).toMatchObject({ version: 7, encoding: "gzip-json" });
    expect(await SqliteDataPersistence.healthCheck()).toBe(true);
  });
});
