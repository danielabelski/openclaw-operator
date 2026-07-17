# Business-Value Startup Recovery Compatibility — 2026-07-15

## Outcome

The highest-value safe task was operational-integrity repair for the active
business-value loop.

The 08:10 BST orchestrator startup loaded persisted pre-expansion business
registry state. Startup reconciliation then marked 732 unfinished task
executions failed and the subsequent business-value recovery check threw:

`TypeError: Cannot read properties of undefined (reading 'map')`

The failure originated in
`orchestrator/src/business/operations.ts` while fingerprinting the new
`initiatives`, `riskRegister`, and `coverageGaps` collections. Older persisted
registry snapshots can legitimately omit those schema-v2 collections.

## Bounded Fix

`computeBusinessValueChangeFingerprint` now treats missing expanded registry
collections as empty arrays. This preserves pre-v2 restart compatibility while
retaining the schema-v2 fingerprint when the collections are present.

A focused regression test constructs a pre-expansion persisted registry shape
and verifies that fingerprinting completes with a SHA-256 result.

## Verification

- `npm --prefix orchestrator exec -- vitest run test/business-value-operations.test.ts test/business-pipeline-discovery.test.ts`
  - 2 test files passed.
  - 16 tests passed.
- `npm --prefix orchestrator run typecheck`
  - passed.
- `git diff --check`
  - passed.

## Runtime Activation

John explicitly approved one orchestrator service restart. The user service
restarted once and entered `active/running` at 09:21:46 BST on 2026-07-15.
After the restart:

- `127.0.0.1:3312` was listening on loopback only.
- `GET /health` returned HTTP 200 with `status: healthy`.
- `GET /api/persistence/health` returned HTTP 200 with healthy MongoDB and
  Redis-backed coordination.
- Startup registered the business-value schedule and processed the overdue
  `business-value-cycle` recovery trigger.
- The recovered cycle selected `commercial-readiness:openclaw-operator` for
  `qa-verification`; the downstream dry-run completed.
- No `[startup] business-value cycle recovery failed` event or legacy
  registry-array `TypeError` appeared in the new startup journal.

The restart did not retry, replay, rewrite, or delete the 732 historical task
executions reconciled by the earlier startup. No deployment, commit, push,
migration, secret access, external message, or business commitment occurred.

## Next Safe Step

Treat the compatibility activation as complete. Audit the 732 reconciled
unfinished executions as a separate read-only integrity task before proposing
any replay or cleanup. Protected task-run inspection still requires the
approved companion/operator read path; do not read credentials to bypass it.
