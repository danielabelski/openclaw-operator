---
title: "Operator SQLite Cutover — 2026-07-16"
summary: "Durable evidence, recovery result, and rollback window for the normalized SQLite v2 host cutover."
---

# Operator SQLite Cutover — 2026-07-16

Operation `operator-sqlite-cutover-20260716T0052Z` completed the retained host
orchestrator's hard persistence cutover from Mongo to normalized SQLite v2.
The work was tracked by OpenClaw goal
`019f6862-f677-7851-8d6f-289bc0269561`, the operation JSON under
`artifacts/persistence/`, and crash-safe workspace/project memory checkpoints.

## Result

- The service was quiesced before the final snapshot, preventing source drift.
- All nine Mongo collections were read twice with stable counts/checksums.
- The only historical record was the core `system_state` document; its source,
  typed target, and lossless archive counts/checksums matched.
- Core state checksum at cutover was
  `51b6e43e8de5cecaeeb4b4ab87840a28607e713f54edda3a18bdfe1ae6dec1d6`.
- SQLite retained 28 top-level state sections and 47,097 item-normalized array
  records. `PRAGMA integrity_check` returned `ok`; foreign-key violations were
  zero; journal mode is WAL.
- Runtime config now selects
  `sqlite:/home/oneclickwebsitedesignfactory/.openclaw/workspace/orchestrator/data/operator.sqlite`.
- One controlled service start recovered successfully. `/health` and
  `/api/persistence/health` were healthy, persistence reported `store: sqlite`,
  and Redis coordination remained healthy.
- A post-start SQLite write changed the runtime checksum while retaining all
  47,097 migrated array items, proving the recovered runtime is writing to the
  active target.

## Verification

- TypeScript typecheck: passed.
- Persistence/state/coordination tests: 12/12 passed.
- Full suite: persistence and non-live groups passed. Two environment-coupled
  live groups remained red because the load endpoint was unavailable and the
  integration credential was not supplied; failures were connection errors and
  HTTP 401s, not persistence assertions.
- Final Mongo read after activation retained the exact cutover checksum and
  collection counts, proving no post-cutover Mongo writes.
- OpenClaw running tasks: 0. Managed TaskFlows: 0. Concurrency remains
  main/subagent/cron `1/1/1`; no increase is evidence-supported.

## Rollback Window

Mongo remains unchanged and is the rollback source for at least 24 hours and
until explicit retirement approval. Do not delete Mongo or the SQLite target
during this window. A rollback requires stopping the named service, changing
the workspace-root `stateFile` back to `mongo:orchestrator-runtime-state`,
starting once, and verifying both health endpoints and the retained checksum.

## Post-Cutover Soak

A read-only sample at 05:29 BST on 16 July confirmed that the service remained
healthy on SQLite with healthy Redis coordination. `PRAGMA integrity_check`
returned `ok`, foreign-key violations remained zero, WAL remained active, and
the live target retained 28 state sections, 47,097 normalized array items, one
lossless source document, and nine collection-evidence rows. The active SQLite
files had also been written at 05:25 BST, proving continued post-cutover use.

The sample is recorded in
`artifacts/persistence/operator-sqlite-soak-20260716T042929Z.json`. A one-shot
isolated read-only verification is scheduled for 02:30 BST on 17 July under
cron job `ceb7d4e7-e7f2-4cab-b67b-b07befc2df39`, after the minimum rollback
window. That check does not authorize Mongo retirement, a service restart,
configuration or concurrency changes, or any release action.

## Evidence

- Durable operation: `artifacts/persistence/operator-sqlite-cutover-20260716T0052Z.json`
- Final migration: `artifacts/persistence/operator-cutover-20260716.json`
- Normalized rehearsal: `artifacts/persistence/operator-rehearsal-normalized-20260716.json`
- Post-cutover soak: `artifacts/persistence/operator-sqlite-soak-20260716T042929Z.json`
- Runtime code: `orchestrator/src/state-store.ts` and
  `orchestrator/src/persistence/sqlite-data-persistence.ts`
