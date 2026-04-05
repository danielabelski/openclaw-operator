# Memory, Context, and Persistence Boundaries

Last updated: 2026-03-28

## Verified State Stores

- Runtime state target defaults to `./orchestrator/data/orchestrator-state.json`
  for repo-native local dev, managed by `state.ts`.
- Mongo persistence integration is optional and bootstrapped through
  `PersistenceIntegration.initialize()` when `DATABASE_URL` is configured.
- Logs/artifacts under `logs/` (knowledge packs, digests, draft records).

## Verified Controls

- State write truncation limits exist for key arrays (`taskHistory`, `driftRepairs`, `rssDrafts`, etc.).
- Corrupt state JSON falls back to default state with warning.
- Persistence startup failure does not crash orchestrator (degraded mode).

## Integrity Risks

- Degraded mode fallback can hide persistence outages if not externally alerted.
- Mixed authority for state-like outputs (orchestrator state vs JSONL logs vs Mongo) can diverge.
- No explicit schema migration/versioning strategy beyond loose defaults.

## Governance Invariants

1. State of record for queue and lifecycle is whatever `stateFile` is configured
   to target; the repo-native default is `./orchestrator/data/orchestrator-state.json`.
2. Every asynchronous write artifact should include task id + timestamp correlation.
3. Persistence degraded mode must emit high-severity alert after startup and periodically until recovered.
