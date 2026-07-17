---
title: "Startup Reconciliation Audit — 2026-07-16"
summary: "Read-only integrity audit of the 732 task executions reconciled during the 15 July 08:10 BST startup."
---

# Startup Reconciliation Audit — 2026-07-16

## Result

The 732-record batch was isolated by its single reconciliation timestamp,
`2026-07-15T07:10:22.434Z`, and audited without reading task payloads or
emitting task identifiers.

- 731 executions were `doc-change`; one was `drift-repair`.
- 730 had never started and lacked both an approval hold and a terminal result.
- Two `doc-change` executions were running when the orchestrator restarted.
- All 732 remain `failed`, with 732 distinct task ids and 732 distinct
  idempotency keys.
- No batch record has a pending approval, terminal workflow result, later
  execution under the same task id, or duplicate idempotency-key row.
- Workflow evidence matches the lifecycle: every run has ingress and queue
  evidence, and only the two started runs have `agent/executing` evidence.

## Residual Inconsistency

The single failed `drift-repair` run received two later system queue
ingress/queued event pairs without a later execution transition or terminal
result. The run remained failed and has no repair-ledger link. This is preserved
as a queue-telemetry inconsistency, not treated as successful replay evidence.

Later runtime evidence removes the basis for replaying the stale batch:

- 1,147 later `doc-change` executions succeeded and the current pending
  doc-change backlog is zero.
- Six later `drift-repair` executions succeeded.

## Decision

Do not replay, retry, clear, or rewrite the 732 historical executions. They are
internally consistent restart evidence, while the underlying doc-change and
drift-repair lanes later resumed successfully.

Any hardening of failed-idempotency-key re-enqueue telemetry should be a
separate tested code slice. It does not justify changing the retained evidence,
restarting the service, or altering concurrency during the SQLite rollback
window.

## Evidence

- `artifacts/runtime/startup-reconciliation-audit-20260716T045807Z.json`
- `artifacts/business-value/startup-recovery-compatibility-2026-07-15.md`

The audit used `sqlite3 -readonly` with `PRAGMA query_only=ON` and aggregate
queries only. The database, runtime, service, configuration, and concurrency
were not changed.
