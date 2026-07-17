import { createHash, randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import type {
  AlertDocument,
  AuditLogDocument,
  ConceptDocument,
  ConceptLinkDocument,
  ConsolidationDocument,
  KBDocument,
  MetricDocument,
  SnapshotDocument,
  SystemStateDocument,
} from "./schemas.js";
import { COLLECTIONS } from "./schemas.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

type SqliteDatabase = InstanceType<typeof DatabaseSync>;

export const NORMALIZED_SQLITE_SCHEMA_VERSION = 2;
export const NORMALIZED_SQLITE_SCHEMA_NAME = "openclaw-operator-normalized";

type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export type SqliteMigrationCollectionEvidence = {
  collection: CollectionName;
  sourceCount: number;
  typedCount: number;
  archiveCount: number;
  sourceChecksum: string;
  archiveChecksum: string;
};

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $binary: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (!value || typeof value !== "object") return value;

  const bson = value as {
    _bsontype?: string;
    toHexString?: () => string;
    value?: (raw?: boolean) => Uint8Array | Buffer;
    sub_type?: number;
  };
  if (bson._bsontype === "ObjectId" && typeof bson.toHexString === "function") {
    return { $oid: bson.toHexString() };
  }
  if (bson._bsontype === "Binary" && typeof bson.value === "function") {
    return {
      $binary: Buffer.from(bson.value(true)).toString("base64"),
      $subType: bson.sub_type ?? 0,
    };
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, jsonValue(entry)]),
  );
}

export function canonicalDocumentJson(value: unknown): string {
  return JSON.stringify(jsonValue(value));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sourceDocumentId(value: unknown): string {
  if (!value || typeof value !== "object") return sha256(canonicalDocumentJson(value));
  const doc = value as Record<string, unknown>;
  const raw = doc._id;
  if (typeof raw === "string" && raw) return raw;
  if (raw && typeof raw === "object") {
    const candidate = raw as { toHexString?: () => string; toString?: () => string };
    if (typeof candidate.toHexString === "function") return candidate.toHexString();
    if (typeof candidate.toString === "function") {
      const rendered = candidate.toString();
      if (rendered && rendered !== "[object Object]") return rendered;
    }
  }
  for (const key of ["id", "key", "fingerprint", "date", "snapshotDate"]) {
    if (typeof doc[key] === "string" && doc[key]) return `${key}:${doc[key]}`;
  }
  return sha256(canonicalDocumentJson(value));
}

function iso(value: unknown, fallback = new Date().toISOString()): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function json(value: unknown, fallback: unknown): string {
  return JSON.stringify(value ?? fallback);
}

function binary(value: unknown): Buffer {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value === "object") {
    const candidate = value as {
      buffer?: Uint8Array;
      value?: (raw?: boolean) => Uint8Array | Buffer;
    };
    if (candidate.buffer instanceof Uint8Array) return Buffer.from(candidate.buffer);
    if (typeof candidate.value === "function") return Buffer.from(candidate.value(true));
  }
  throw new Error("system_state payload is not a supported binary value");
}

function configure(database: SqliteDatabase): void {
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
}

function createSchema(database: SqliteDatabase): void {
  configure(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS operator_schema_meta (
      schema_name TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_records (
      source_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      labels_json TEXT NOT NULL,
      retention TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_metric_name_timestamp ON metric_records(name, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_metric_timestamp ON metric_records(timestamp DESC);

    CREATE TABLE IF NOT EXISTS alert_records (
      source_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      resolved_at TEXT,
      duration_ms REAL,
      labels_json TEXT NOT NULL,
      annotations_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alert_timestamp ON alert_records(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_alert_fingerprint_status ON alert_records(fingerprint, status);
    CREATE INDEX IF NOT EXISTS idx_alert_severity ON alert_records(severity);

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      source_id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      root_cause TEXT,
      solution TEXT NOT NULL,
      prerequisites_json TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      expected_outcome TEXT,
      tags_json TEXT NOT NULL,
      related_entries_json TEXT NOT NULL,
      related_concepts_json TEXT NOT NULL,
      occurrences INTEGER,
      success_rate REAL,
      last_seen TEXT,
      first_seen TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_severity ON knowledge_entries(severity);
    CREATE INDEX IF NOT EXISTS idx_knowledge_updated_at ON knowledge_entries(updated_at DESC);

    CREATE TABLE IF NOT EXISTS consolidation_records (
      source_id TEXT PRIMARY KEY,
      consolidation_date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      snapshots_json TEXT NOT NULL,
      alerts_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      recommendations_json TEXT NOT NULL,
      kb_entries_generated INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_consolidation_date ON consolidation_records(consolidation_date DESC);

    CREATE TABLE IF NOT EXISTS snapshot_records (
      source_id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      alerts_json TEXT NOT NULL,
      health_json TEXT NOT NULL,
      cost_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_date_timestamp ON snapshot_records(snapshot_date, timestamp DESC);

    CREATE TABLE IF NOT EXISTS system_state_records (
      source_id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL UNIQUE,
      encoding TEXT NOT NULL,
      payload BLOB NOT NULL,
      payload_bytes INTEGER NOT NULL,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log_records (
      source_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      resource TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_action_timestamp ON audit_log_records(action, timestamp DESC);

    CREATE TABLE IF NOT EXISTS concept_records (
      source_id TEXT PRIMARY KEY,
      concept_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      related_concepts_json TEXT NOT NULL,
      frequency INTEGER NOT NULL,
      evidence_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_concept_type_frequency ON concept_records(type, frequency DESC);
    CREATE INDEX IF NOT EXISTS idx_concept_id ON concept_records(concept_id);

    CREATE TABLE IF NOT EXISTS concept_link_records (
      source_id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      strength REAL NOT NULL,
      evidence_json TEXT NOT NULL,
      frequency INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_concept_link_from_strength ON concept_link_records(from_id, strength DESC);

    CREATE TABLE IF NOT EXISTS migration_runs (
      run_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      source_store TEXT NOT NULL,
      target_store TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      core_state_key TEXT,
      core_state_sha256 TEXT,
      evidence_json TEXT
    );

    CREATE TABLE IF NOT EXISTS migration_source_documents (
      run_id TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document_json TEXT NOT NULL,
      document_sha256 TEXT NOT NULL,
      PRIMARY KEY (run_id, collection_name, source_id),
      FOREIGN KEY (run_id) REFERENCES migration_runs(run_id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_migration_source_collection
      ON migration_source_documents(run_id, collection_name, source_id);

    CREATE TABLE IF NOT EXISTS migration_collection_evidence (
      run_id TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      source_count INTEGER NOT NULL,
      typed_count INTEGER NOT NULL,
      archive_count INTEGER NOT NULL,
      source_checksum TEXT NOT NULL,
      archive_checksum TEXT NOT NULL,
      PRIMARY KEY (run_id, collection_name),
      FOREIGN KEY (run_id) REFERENCES migration_runs(run_id) ON DELETE RESTRICT
    );
  `);

  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO operator_schema_meta (schema_name, schema_version, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(schema_name) DO UPDATE SET
      schema_version = excluded.schema_version,
      updated_at = excluded.updated_at
  `).run(NORMALIZED_SQLITE_SCHEMA_NAME, NORMALIZED_SQLITE_SCHEMA_VERSION, now, now);
}

const TABLE_BY_COLLECTION: Record<CollectionName, string> = {
  [COLLECTIONS.METRICS]: "metric_records",
  [COLLECTIONS.ALERTS]: "alert_records",
  [COLLECTIONS.KNOWLEDGE_BASE]: "knowledge_entries",
  [COLLECTIONS.CONSOLIDATIONS]: "consolidation_records",
  [COLLECTIONS.SNAPSHOTS]: "snapshot_records",
  [COLLECTIONS.SYSTEM_STATE]: "system_state_records",
  [COLLECTIONS.AUDIT_LOGS]: "audit_log_records",
  [COLLECTIONS.CONCEPTS]: "concept_records",
  [COLLECTIONS.CONCEPT_LINKS]: "concept_link_records",
};

function rowCount(database: SqliteDatabase, table: string): number {
  return Number((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

function aggregateChecksum(items: Array<{ sourceId: string; hash: string }>): string {
  const digest = createHash("sha256");
  for (const item of items.sort((left, right) => left.sourceId.localeCompare(right.sourceId))) {
    digest.update(item.sourceId).update("\0").update(item.hash).update("\n");
  }
  return digest.digest("hex");
}

export function collectionDocumentChecksum(documents: unknown[]): string {
  return aggregateChecksum(
    documents.map((value) => ({
      sourceId: sourceDocumentId(value),
      hash: sha256(canonicalDocumentJson(value)),
    })),
  );
}

export class SqliteDataPersistence {
  private static database: SqliteDatabase | null = null;
  private static path: string | null = null;

  static async initialize(path: string): Promise<void> {
    if (this.database && this.path === path) return;
    await this.close();
    const database = new DatabaseSync(path);
    createSchema(database);
    this.database = database;
    this.path = path;
  }

  static getPath(): string {
    if (!this.path) throw new Error("SQLite persistence is not initialized");
    return this.path;
  }

  static getDatabase(): SqliteDatabase {
    if (!this.database) throw new Error("SQLite persistence is not initialized");
    return this.database;
  }

  static async healthCheck(): Promise<boolean> {
    if (!this.database) return false;
    const row = this.database.prepare("PRAGMA quick_check").get() as { quick_check?: string };
    return row.quick_check === "ok";
  }

  static async close(): Promise<void> {
    if (this.database) this.database.close();
    this.database = null;
    this.path = null;
  }

  static async getDatabaseSize(): Promise<number> {
    const path = this.getPath();
    let total = 0;
    for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
      try {
        total += (await stat(candidate)).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return total;
  }

  static async getCollectionStats(): Promise<Record<string, number>> {
    const database = this.getDatabase();
    return Object.fromEntries(
      Object.entries(TABLE_BY_COLLECTION).map(([collection, table]) => [collection, rowCount(database, table)]),
    );
  }

  static startMigration(runId: string, mode: string, coreStateKey: string): void {
    this.getDatabase().prepare(`
      INSERT INTO migration_runs
        (run_id, mode, source_store, target_store, started_at, status, core_state_key)
      VALUES (?, ?, 'mongo', 'sqlite', ?, 'running', ?)
    `).run(runId, mode, new Date().toISOString(), coreStateKey);
  }

  static completeMigration(runId: string, coreStateSha256: string, evidence: unknown): void {
    this.getDatabase().prepare(`
      UPDATE migration_runs
      SET completed_at = ?, status = 'verified', core_state_sha256 = ?, evidence_json = ?
      WHERE run_id = ?
    `).run(new Date().toISOString(), coreStateSha256, JSON.stringify(evidence), runId);
  }

  static failMigration(runId: string, evidence: unknown): void {
    this.getDatabase().prepare(`
      UPDATE migration_runs
      SET completed_at = ?, status = 'failed', evidence_json = ?
      WHERE run_id = ?
    `).run(new Date().toISOString(), JSON.stringify(evidence), runId);
  }

  static importMongoCollection(
    runId: string,
    collection: CollectionName,
    documents: unknown[],
  ): SqliteMigrationCollectionEvidence {
    const database = this.getDatabase();
    const sourceItems: Array<{ sourceId: string; hash: string }> = [];
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const value of documents) {
        const sourceId = sourceDocumentId(value);
        const documentJson = canonicalDocumentJson(value);
        const hash = sha256(documentJson);
        sourceItems.push({ sourceId, hash });
        database.prepare(`
          INSERT INTO migration_source_documents
            (run_id, collection_name, source_id, document_json, document_sha256)
          VALUES (?, ?, ?, ?, ?)
        `).run(runId, collection, sourceId, documentJson, hash);
        this.insertTypedDocument(collection, sourceId, value as Record<string, unknown>);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    const sourceChecksum = aggregateChecksum(sourceItems);
    const archiveRows = database.prepare(`
      SELECT source_id, document_sha256
      FROM migration_source_documents
      WHERE run_id = ? AND collection_name = ?
      ORDER BY source_id
    `).all(runId, collection) as Array<{ source_id: string; document_sha256: string }>;
    const archiveChecksum = aggregateChecksum(
      archiveRows.map((row) => ({ sourceId: row.source_id, hash: row.document_sha256 })),
    );
    const evidence: SqliteMigrationCollectionEvidence = {
      collection,
      sourceCount: documents.length,
      typedCount: rowCount(database, TABLE_BY_COLLECTION[collection]),
      archiveCount: archiveRows.length,
      sourceChecksum,
      archiveChecksum,
    };
    database.prepare(`
      INSERT INTO migration_collection_evidence
        (run_id, collection_name, source_count, typed_count, archive_count, source_checksum, archive_checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      collection,
      evidence.sourceCount,
      evidence.typedCount,
      evidence.archiveCount,
      evidence.sourceChecksum,
      evidence.archiveChecksum,
    );
    return evidence;
  }

  private static insertTypedDocument(
    collection: CollectionName,
    sourceId: string,
    doc: Record<string, unknown>,
  ): void {
    const database = this.getDatabase();
    switch (collection) {
      case COLLECTIONS.METRICS:
        database.prepare(`INSERT INTO metric_records VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.name ?? ""), Number(doc.value ?? 0), String(doc.unit ?? ""), iso(doc.timestamp), json(doc.labels, {}), doc.retention == null ? null : String(doc.retention));
        return;
      case COLLECTIONS.ALERTS:
        database.prepare(`INSERT INTO alert_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.name ?? ""), String(doc.severity ?? "info"), String(doc.status ?? "firing"), String(doc.message ?? ""), String(doc.fingerprint ?? ""), iso(doc.timestamp), doc.resolvedAt == null ? null : iso(doc.resolvedAt), doc.duration == null ? null : Number(doc.duration), json(doc.labels, {}), json(doc.annotations, {}));
        return;
      case COLLECTIONS.KNOWLEDGE_BASE:
        database.prepare(`INSERT INTO knowledge_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.id ?? sourceId), String(doc.title ?? ""), doc.description == null ? null : String(doc.description), String(doc.category ?? "troubleshooting"), String(doc.severity ?? "low"), doc.rootCause == null ? null : String(doc.rootCause), String(doc.solution ?? ""), json(doc.prerequisites, []), json(doc.steps, []), doc.expectedOutcome == null ? null : String(doc.expectedOutcome), json(doc.tags, []), json(doc.relatedEntries, []), json(doc.relatedConcepts, []), doc.occurrences == null ? null : Number(doc.occurrences), doc.successRate == null ? null : Number(doc.successRate), doc.lastSeen == null ? null : iso(doc.lastSeen), doc.firstSeen == null ? null : iso(doc.firstSeen), iso(doc.createdAt), iso(doc.updatedAt));
        return;
      case COLLECTIONS.CONSOLIDATIONS:
        database.prepare(`INSERT INTO consolidation_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.date ?? ""), iso(doc.timestamp), json(doc.snapshots, {}), json(doc.alerts, {}), json(doc.metrics, {}), String(doc.summary ?? ""), json(doc.insights, []), json(doc.recommendations, []), doc.kbEntriesGenerated == null ? null : Number(doc.kbEntriesGenerated));
        return;
      case COLLECTIONS.SNAPSHOTS:
        database.prepare(`INSERT INTO snapshot_records VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.snapshotDate ?? ""), iso(doc.timestamp), json(doc.metrics, {}), json(doc.alerts, {}), json(doc.health, {}), doc.cost == null ? null : json(doc.cost, {}));
        return;
      case COLLECTIONS.SYSTEM_STATE: {
        const payload = binary(doc.payload);
        database.prepare(`INSERT INTO system_state_records VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.key ?? sourceId), String(doc.encoding ?? "gzip-json"), payload, Number(doc.payloadBytes ?? payload.byteLength), Number(doc.version ?? 1), iso(doc.updatedAt));
        return;
      }
      case COLLECTIONS.AUDIT_LOGS:
        database.prepare(`INSERT INTO audit_log_records VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.action ?? ""), String(doc.actor ?? ""), String(doc.resource ?? ""), json(doc.changes, {}), iso(doc.timestamp), String(doc.status ?? "failure"), doc.error == null ? null : String(doc.error));
        return;
      case COLLECTIONS.CONCEPTS:
        database.prepare(`INSERT INTO concept_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.id ?? sourceId), String(doc.name ?? ""), String(doc.type ?? "pattern"), doc.description == null ? null : String(doc.description), json(doc.relatedConcepts, []), Number(doc.frequency ?? 0), json(doc.evidence, []), iso(doc.createdAt), iso(doc.updatedAt));
        return;
      case COLLECTIONS.CONCEPT_LINKS:
        database.prepare(`INSERT INTO concept_link_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(sourceId, String(doc.fromId ?? ""), String(doc.toId ?? ""), String(doc.relationship ?? "related_to"), Number(doc.strength ?? 0), json(doc.evidence, []), Number(doc.frequency ?? 0), iso(doc.createdAt), iso(doc.updatedAt));
        return;
    }
  }

  static async saveMetric(metric: MetricDocument): Promise<string> {
    const sourceId = metric._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.METRICS, sourceId, metric as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async saveMetrics(metrics: MetricDocument[]): Promise<number> {
    for (const metric of metrics) await this.saveMetric(metric);
    return metrics.length;
  }

  static async getMetrics(name?: string, startTime?: Date, endTime?: Date, limit = 100): Promise<MetricDocument[]> {
    const filters: string[] = [];
    const args: Array<string | number> = [];
    if (name) { filters.push("name = ?"); args.push(name); }
    if (startTime) { filters.push("timestamp >= ?"); args.push(startTime.toISOString()); }
    if (endTime) { filters.push("timestamp <= ?"); args.push(endTime.toISOString()); }
    args.push(limit);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.getDatabase().prepare(`SELECT * FROM metric_records ${where} ORDER BY timestamp DESC LIMIT ?`).all(...args) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ _id: String(row.source_id), name: String(row.name), value: Number(row.value), unit: String(row.unit), timestamp: new Date(String(row.timestamp)), labels: parseJson(row.labels_json, {}), retention: row.retention == null ? undefined : String(row.retention) as MetricDocument["retention"] }));
  }

  static async deleteOldMetrics(olderThanDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return Number(this.getDatabase().prepare("DELETE FROM metric_records WHERE timestamp < ?").run(cutoff.toISOString()).changes);
  }

  static async saveAlert(alert: AlertDocument): Promise<string> {
    const sourceId = alert._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.ALERTS, sourceId, alert as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async saveAlerts(alerts: AlertDocument[]): Promise<number> {
    for (const alert of alerts) await this.saveAlert(alert);
    return alerts.length;
  }

  static async getAlerts(severity?: string, status?: string, limit = 100): Promise<AlertDocument[]> {
    const filters: string[] = [];
    const args: Array<string | number> = [];
    if (severity) { filters.push("severity = ?"); args.push(severity); }
    if (status) { filters.push("status = ?"); args.push(status); }
    args.push(limit);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = this.getDatabase().prepare(`SELECT * FROM alert_records ${where} ORDER BY timestamp DESC LIMIT ?`).all(...args) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ _id: String(row.source_id), name: String(row.name), severity: String(row.severity) as AlertDocument["severity"], status: String(row.status) as AlertDocument["status"], message: String(row.message), fingerprint: String(row.fingerprint), timestamp: new Date(String(row.timestamp)), resolvedAt: row.resolved_at == null ? undefined : new Date(String(row.resolved_at)), duration: row.duration_ms == null ? undefined : Number(row.duration_ms), labels: parseJson(row.labels_json, {}), annotations: parseJson(row.annotations_json, {}) }));
  }

  static async resolveAlert(fingerprint: string): Promise<boolean> {
    const result = this.getDatabase().prepare("UPDATE alert_records SET status = 'resolved', resolved_at = ? WHERE fingerprint = ? AND status = 'firing'").run(new Date().toISOString(), fingerprint);
    return Number(result.changes) > 0;
  }

  static async alertStats(days = 7): Promise<Record<string, number>> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const rows = this.getDatabase().prepare("SELECT severity, COUNT(*) AS count FROM alert_records WHERE timestamp >= ? GROUP BY severity").all(start.toISOString()) as Array<{ severity: string; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.severity, Number(row.count)]));
  }

  static async saveKBEntry(entry: KBDocument): Promise<string> {
    const database = this.getDatabase();
    const sourceId = entry._id ?? `kb:${entry.id}`;
    database.prepare("DELETE FROM knowledge_entries WHERE entry_id = ?").run(entry.id);
    this.insertTypedDocument(COLLECTIONS.KNOWLEDGE_BASE, sourceId, entry as unknown as Record<string, unknown>);
    return entry.id;
  }

  static async updateKBEntry(id: string, updates: Partial<KBDocument>): Promise<boolean> {
    const current = (await this.getAllKBEntries()).find((entry) => entry.id === id);
    if (!current) return false;
    await this.saveKBEntry({ ...current, ...updates, id, updatedAt: new Date() });
    return true;
  }

  static async searchKB(query: string, limit = 20): Promise<KBDocument[]> {
    const pattern = `%${query}%`;
    const rows = this.getDatabase().prepare("SELECT * FROM knowledge_entries WHERE title LIKE ? OR solution LIKE ? ORDER BY updated_at DESC LIMIT ?").all(pattern, pattern, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapKB(row));
  }

  static async getKBByCategory(category: string, limit = 50): Promise<KBDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM knowledge_entries WHERE category = ? ORDER BY occurrences DESC LIMIT ?").all(category, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapKB(row));
  }

  static async getKBStats(): Promise<Record<string, unknown>> {
    const database = this.getDatabase();
    const total = rowCount(database, "knowledge_entries");
    const group = (field: "category" | "severity") => (database.prepare(`SELECT ${field} AS id, COUNT(*) AS count FROM knowledge_entries GROUP BY ${field}`).all() as Array<{ id: string; count: number }>).map((row) => ({ _id: row.id, count: Number(row.count) }));
    return { total, byCategory: group("category"), bySeverity: group("severity") };
  }

  static async getAllKBEntries(limit = 5000): Promise<KBDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM knowledge_entries ORDER BY updated_at DESC LIMIT ?").all(limit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapKB(row));
  }

  private static mapKB(row: Record<string, unknown>): KBDocument {
    return { _id: String(row.source_id), id: String(row.entry_id), title: String(row.title), description: row.description == null ? undefined : String(row.description), category: String(row.category) as KBDocument["category"], severity: String(row.severity) as KBDocument["severity"], rootCause: row.root_cause == null ? undefined : String(row.root_cause), solution: String(row.solution), prerequisites: parseJson(row.prerequisites_json, []), steps: parseJson(row.steps_json, []), expectedOutcome: row.expected_outcome == null ? undefined : String(row.expected_outcome), tags: parseJson(row.tags_json, []), relatedEntries: parseJson(row.related_entries_json, []), relatedConcepts: parseJson(row.related_concepts_json, []), occurrences: row.occurrences == null ? undefined : Number(row.occurrences), successRate: row.success_rate == null ? undefined : Number(row.success_rate), lastSeen: row.last_seen == null ? undefined : new Date(String(row.last_seen)), firstSeen: row.first_seen == null ? undefined : new Date(String(row.first_seen)), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)) };
  }

  static async saveConsolidation(value: ConsolidationDocument): Promise<string> {
    const sourceId = value._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.CONSOLIDATIONS, sourceId, value as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async getConsolidation(date: string): Promise<ConsolidationDocument | null> {
    const row = this.getDatabase().prepare("SELECT * FROM consolidation_records WHERE consolidation_date = ? ORDER BY timestamp DESC LIMIT 1").get(date) as Record<string, unknown> | undefined;
    return row ? this.mapConsolidation(row) : null;
  }

  static async getConsolidations(limit = 30): Promise<ConsolidationDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM consolidation_records ORDER BY consolidation_date DESC LIMIT ?").all(limit) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapConsolidation(row));
  }

  private static mapConsolidation(row: Record<string, unknown>): ConsolidationDocument {
    return { _id: String(row.source_id), date: String(row.consolidation_date), timestamp: new Date(String(row.timestamp)), snapshots: parseJson(row.snapshots_json, { count: 0, timeRange: { start: new Date(0), end: new Date(0) } }), alerts: parseJson(row.alerts_json, { total: 0, bySeverity: {}, topIssues: [] }), metrics: parseJson(row.metrics_json, { total: 0, anomalies: [], trends: [] }), summary: String(row.summary), insights: parseJson(row.insights_json, []), recommendations: parseJson(row.recommendations_json, []), kbEntriesGenerated: row.kb_entries_generated == null ? undefined : Number(row.kb_entries_generated) };
  }

  static async saveSnapshot(value: SnapshotDocument): Promise<string> {
    const sourceId = value._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.SNAPSHOTS, sourceId, value as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async getSnapshotsForDate(date: string, limit = 100): Promise<SnapshotDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM snapshot_records WHERE snapshot_date = ? ORDER BY timestamp DESC LIMIT ?").all(date, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ _id: String(row.source_id), snapshotDate: String(row.snapshot_date), timestamp: new Date(String(row.timestamp)), metrics: parseJson(row.metrics_json, {} as SnapshotDocument["metrics"]), alerts: parseJson(row.alerts_json, {} as SnapshotDocument["alerts"]), health: parseJson(row.health_json, {} as SnapshotDocument["health"]), cost: row.cost_json == null ? undefined : parseJson(row.cost_json, {} as NonNullable<SnapshotDocument["cost"]>) }));
  }

  static async saveSystemState(key: string, value: SystemStateDocument): Promise<void> {
    const database = this.getDatabase();
    database.prepare("DELETE FROM system_state_records WHERE state_key = ?").run(key);
    this.insertTypedDocument(COLLECTIONS.SYSTEM_STATE, value._id ?? `state:${key}`, { ...value, key });
  }

  static async getSystemStateRecord(key: string): Promise<SystemStateDocument | null> {
    const row = this.getDatabase().prepare("SELECT * FROM system_state_records WHERE state_key = ?").get(key) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { _id: String(row.source_id), key: String(row.state_key), encoding: String(row.encoding) as "gzip-json", payload: Buffer.from(row.payload as Uint8Array), payloadBytes: Number(row.payload_bytes), version: Number(row.version), updatedAt: new Date(String(row.updated_at)) };
  }

  static async logAudit(value: AuditLogDocument): Promise<string> {
    const sourceId = value._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.AUDIT_LOGS, sourceId, value as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async getAuditLogs(action?: string, limit = 100): Promise<AuditLogDocument[]> {
    const rows = action
      ? this.getDatabase().prepare("SELECT * FROM audit_log_records WHERE action = ? ORDER BY timestamp DESC LIMIT ?").all(action, limit)
      : this.getDatabase().prepare("SELECT * FROM audit_log_records ORDER BY timestamp DESC LIMIT ?").all(limit);
    return (rows as Array<Record<string, unknown>>).map((row) => ({ _id: String(row.source_id), action: String(row.action), actor: String(row.actor), resource: String(row.resource), changes: parseJson(row.changes_json, {}), timestamp: new Date(String(row.timestamp)), status: String(row.status) as AuditLogDocument["status"], error: row.error == null ? undefined : String(row.error) }));
  }

  static async saveConcept(value: ConceptDocument): Promise<string> {
    const sourceId = value._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.CONCEPTS, sourceId, value as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async updateConcept(id: string, updates: Partial<ConceptDocument>): Promise<boolean> {
    const rows = await this.getConceptsById(id);
    if (rows.length === 0) return false;
    for (const current of rows) {
      this.getDatabase().prepare("DELETE FROM concept_records WHERE source_id = ?").run(current._id!);
      await this.saveConcept({ ...current, ...updates, id, updatedAt: new Date() });
    }
    return true;
  }

  private static async getConceptsById(id: string): Promise<ConceptDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM concept_records WHERE concept_id = ?").all(id) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapConcept(row));
  }

  static async getConceptsByType(type: string): Promise<ConceptDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM concept_records WHERE type = ? ORDER BY frequency DESC").all(type) as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapConcept(row));
  }

  private static mapConcept(row: Record<string, unknown>): ConceptDocument {
    return { _id: String(row.source_id), id: String(row.concept_id), name: String(row.name), type: String(row.type) as ConceptDocument["type"], description: row.description == null ? undefined : String(row.description), relatedConcepts: parseJson(row.related_concepts_json, []), frequency: Number(row.frequency), evidence: parseJson(row.evidence_json, []), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)) };
  }

  static async saveConceptLink(value: ConceptLinkDocument): Promise<string> {
    const sourceId = value._id ?? randomUUID();
    this.insertTypedDocument(COLLECTIONS.CONCEPT_LINKS, sourceId, value as unknown as Record<string, unknown>);
    return sourceId;
  }

  static async getConceptLinks(fromId: string): Promise<ConceptLinkDocument[]> {
    const rows = this.getDatabase().prepare("SELECT * FROM concept_link_records WHERE from_id = ? ORDER BY strength DESC").all(fromId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ _id: String(row.source_id), fromId: String(row.from_id), toId: String(row.to_id), relationship: String(row.relationship) as ConceptLinkDocument["relationship"], strength: Number(row.strength), evidence: parseJson(row.evidence_json, []), frequency: Number(row.frequency), createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)) }));
  }
}

export default SqliteDataPersistence;
