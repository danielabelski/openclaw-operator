import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { COLLECTIONS } from "../src/persistence/schemas.js";
import {
  NORMALIZED_SQLITE_SCHEMA_NAME,
  NORMALIZED_SQLITE_SCHEMA_VERSION,
  SqliteDataPersistence,
  canonicalDocumentJson,
  collectionDocumentChecksum,
} from "../src/persistence/sqlite-data-persistence.js";
import { createStateStore } from "../src/state-store.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
  throw new Error("Mongo system_state payload is not a supported binary value");
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const targetArg = argument("--target") ?? process.argv[2];
if (!targetArg) {
  console.error(
    "usage: tsx scripts/rehearse-sqlite-state-migration.ts --target <fresh-target.sqlite> [--evidence <report.json>] [--mode rehearsal|cutover] [--state-key <key>]",
  );
  process.exit(2);
}

const targetPath = resolve(targetArg);
const evidencePath = argument("--evidence") ? resolve(argument("--evidence")!) : undefined;
const mode = argument("--mode") ?? "rehearsal";
const stateKey = argument("--state-key") ?? "orchestrator-runtime-state";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for Mongo-to-SQLite migration");
if (existsSync(targetPath)) throw new Error(`SQLite migration target already exists: ${targetPath}`);

await mkdir(dirname(targetPath), { recursive: true });
const runId = `mongo-sqlite-${mode}-${randomUUID()}`;
const startedAt = new Date().toISOString();
const client = new MongoClient(databaseUrl, {
  appName: "openclaw-operator-sqlite-migration",
  maxPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
});

let report: Record<string, unknown> | undefined;
try {
  await client.connect();
  const mongo = process.env.DB_NAME?.trim() ? client.db(process.env.DB_NAME.trim()) : client.db();
  await SqliteDataPersistence.initialize(targetPath);
  SqliteDataPersistence.startMigration(runId, mode, stateKey);

  const sourceDocuments = new Map<string, unknown[]>();
  for (const collection of Object.values(COLLECTIONS)) {
    sourceDocuments.set(
      collection,
      await mongo.collection(collection).find({}).sort({ _id: 1 }).toArray(),
    );
  }

  const systemStateDocuments = sourceDocuments.get(COLLECTIONS.SYSTEM_STATE) ?? [];
  const coreDocument = systemStateDocuments.find(
    (value) => Boolean(value && typeof value === "object" && (value as { key?: unknown }).key === stateKey),
  ) as { encoding?: unknown; payload?: unknown } | undefined;
  if (!coreDocument || coreDocument.encoding !== "gzip-json") {
    throw new Error(`Mongo system_state does not contain gzip-json core state for key=${stateKey}`);
  }
  const coreState = JSON.parse(gunzipSync(binary(coreDocument.payload)).toString("utf8")) as Record<string, unknown>;
  const coreStateSha256 = checksum(coreState);

  const collectionEvidence = Object.values(COLLECTIONS).map((collection) =>
    SqliteDataPersistence.importMongoCollection(
      runId,
      collection,
      sourceDocuments.get(collection) ?? [],
    ),
  );

  const store = createStateStore<Record<string, unknown>>(`sqlite:${targetPath}`);
  await store.save(coreState);
  const loadedCoreState = await store.load();
  if (!loadedCoreState || checksum(loadedCoreState) !== coreStateSha256) {
    throw new Error("Normalized SQLite core-state checksum does not match Mongo source state");
  }

  const sourceStable: Record<string, boolean> = {};
  for (const collection of Object.values(COLLECTIONS)) {
    const secondRead = await mongo.collection(collection).find({}).sort({ _id: 1 }).toArray();
    const firstRead = sourceDocuments.get(collection) ?? [];
    sourceStable[collection] =
      secondRead.length === firstRead.length &&
      collectionDocumentChecksum(secondRead) === collectionDocumentChecksum(firstRead);
  }
  if (Object.values(sourceStable).some((stable) => !stable)) {
    throw new Error("Mongo source changed during snapshot; discard target and rerun from a quiescent source");
  }

  for (const evidence of collectionEvidence) {
    if (
      evidence.sourceCount !== evidence.typedCount ||
      evidence.sourceCount !== evidence.archiveCount ||
      evidence.sourceChecksum !== evidence.archiveChecksum
    ) {
      throw new Error(`Collection verification failed for ${evidence.collection}`);
    }
  }

  const database = new DatabaseSync(targetPath, { readOnly: true });
  let integrityCheck = "unknown";
  let journalMode = "unknown";
  let foreignKeyViolations: unknown[] = [];
  let stateMeta: unknown = null;
  let sectionCount = 0;
  let arrayItemCount = 0;
  try {
    integrityCheck = String((database.prepare("PRAGMA integrity_check").get() as { integrity_check?: unknown }).integrity_check ?? "unknown");
    journalMode = String((database.prepare("PRAGMA journal_mode").get() as { journal_mode?: unknown }).journal_mode ?? "unknown");
    foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all();
    stateMeta = database.prepare("SELECT * FROM orchestrator_state_meta WHERE id = 1").get() ?? null;
    sectionCount = Number((database.prepare("SELECT COUNT(*) AS count FROM orchestrator_state_sections").get() as { count: number }).count);
    arrayItemCount = Number((database.prepare("SELECT COUNT(*) AS count FROM orchestrator_state_array_items").get() as { count: number }).count);
  } finally {
    database.close();
  }
  if (integrityCheck !== "ok" || foreignKeyViolations.length > 0) {
    throw new Error(`SQLite validation failed integrity=${integrityCheck} foreignKeys=${foreignKeyViolations.length}`);
  }

  report = {
    operation: "mongo-to-normalized-sqlite",
    runId,
    mode,
    startedAt,
    completedAt: new Date().toISOString(),
    changedSourceState: false,
    source: {
      store: "mongo",
      databaseName: mongo.databaseName,
      stateKey,
      collections: Object.fromEntries(collectionEvidence.map((entry) => [entry.collection, entry.sourceCount])),
      stableAcrossTwoReads: sourceStable,
      coreStateSha256,
    },
    target: {
      store: "sqlite",
      path: targetPath,
      schemaName: NORMALIZED_SQLITE_SCHEMA_NAME,
      schemaVersion: NORMALIZED_SQLITE_SCHEMA_VERSION,
      journalMode,
      integrityCheck,
      foreignKeyViolations: foreignKeyViolations.length,
      stateMeta,
      sectionCount,
      arrayItemCount,
      collections: collectionEvidence,
      losslessSourceArchive: true,
    },
    rollback: {
      mongoChanged: false,
      mongoRetained: true,
      targetCanBeRemovedBeforeActivation: true,
    },
  };
  SqliteDataPersistence.completeMigration(runId, coreStateSha256, report);
  SqliteDataPersistence.getDatabase().prepare("PRAGMA wal_checkpoint(TRUNCATE)").all();
  if (evidencePath) {
    await mkdir(dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (report === undefined) {
    try {
      SqliteDataPersistence.failMigration(runId, {
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // The target may have failed before the migration ledger was initialized.
    }
  }
  throw error;
} finally {
  await SqliteDataPersistence.close();
  await client.close();
}
