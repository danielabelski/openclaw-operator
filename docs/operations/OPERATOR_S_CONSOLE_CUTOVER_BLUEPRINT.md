# Operator-s-console Cutover Blueprint

Status: completed implementation record
Last updated: 2026-03-20
Owner: Workspace maintainers

This document records the completed cutover that replaced the legacy
hand-written `/operator` shell with `operator-s-console`, while preserving a
public proof surface without relying on `openclawdbot`.

This is historical implementation evidence, not the current primary authority
for `/operator`. Runtime code and the canonical operator/API docs win when they
diverge.

## Objective

Complete one frontend consolidation:

1. `operator-s-console` becomes the built-in operator UI served by orchestrator
2. the legacy `orchestrator/src/operator-ui/*` shell is no longer part of the
   runtime serving path and is later removable as dead code
3. public proof remains visible without a bearer token
4. public proof is re-homed onto orchestrator-owned public routes rather than
   the retired `openclawdbot` proof lane

## Non-Negotiables

1. Do not lose any orchestrator-critical operator endpoints.
2. Do not keep `openclawdbot` dependencies alive just to preserve a public
   show-off surface.
3. Do not collapse protected operator data into public proof routes.
4. Do not create a second competing built-in operator shell.

## Route Ownership Model

### Protected operator surface to preserve

These remain orchestrator-owned, bearer-protected, and first-class in the new
built-in operator UI:

- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/health/extended`
- `GET /api/tasks/catalog`
- `POST /api/tasks/trigger`
- `GET /api/tasks/runs`
- `GET /api/tasks/runs/:runId`
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/decision`
- `GET /api/incidents`
- `GET /api/incidents/:id`
- `GET /api/incidents/:id/history`
- `POST /api/incidents/:id/acknowledge`
- `POST /api/incidents/:id/owner`
- `POST /api/incidents/:id/remediate`
- `GET /api/agents/overview`
- `GET /api/skills/registry`
- `GET /api/skills/policy`
- `GET /api/skills/telemetry`
- `GET /api/skills/audit`
- `GET /api/memory/recall`
- `POST /api/knowledge/query`
- `GET /api/persistence/summary`

### Public proof surface to keep

Public proof stays public, but it must become orchestrator-owned. It should be
backed by curated public routes that expose narrative/proof artifacts, not raw
private control-plane state.

Active public proof shape:

- `GET /operator/public-proof` or equivalent orchestrator-served public page
- orchestrator-owned public JSON routes for proof cards, milestone timeline,
  demand/proof summary, and other curated proof displays

Active orchestrator-owned public proof routes:

- `GET /api/command-center/overview`
- `GET /api/command-center/control`
- `GET /api/command-center/demand`
- `GET /api/command-center/demand-live`
- `GET /api/milestones/latest`
- `GET /api/milestones/dead-letter`

### Retired proof-lane dependencies to remove

These should be removed from `operator-s-console` as orchestrator-owned public
proof routes land:

- `proofFetch`
- `use-proof-api`
- any assumption that `openclawdbot` is the backend for public proof

## Frontend Consolidation Plan

### Phase 1: Built-in operator shell replacement

Goal: orchestrator serves the `operator-s-console` bundle at `/operator`.

Tasks:

1. Build `operator-s-console` for `/operator`
2. Make orchestrator prefer serving `operator-s-console/dist`
3. Require the built `operator-s-console/dist` bundle at orchestrator startup

Initial implementation slice landed in this phase:

- `operator-s-console` build base is now `/operator/`
- the app router is now mounted with basename `/operator`
- orchestrator now requires `../operator-s-console/dist/index.html` and serves
   only that bundle for `/operator`
- production builds for both orchestrator and `operator-s-console` are passing
   after the cutover wiring

### Phase 2: Public proof re-home

Goal: keep a public show-off surface without `openclawdbot`.

Tasks:

1. Define orchestrator-owned public proof endpoints
2. Rebind `PublicProofPage` to those orchestrator-owned routes
3. Remove `proof-client` and proof hooks once no longer referenced

Implementation status:

- orchestrator now serves the public proof JSON contract directly
- `operator-s-console` public proof fetches now resolve through the
   orchestrator API client
- the retired standalone proof client has been removed from
   `operator-s-console`

### Phase 3: Legacy shell removal

Goal: remove the old built-in shell once the React bundle is the canonical
on-host `/operator` runtime.

Tasks:

1. remove legacy `operator-ui` route-specific assets
2. keep only the operator-s-console delivery path

Implementation status:

- fallback serving logic has been removed from orchestrator runtime
- orchestrator now fails fast if `operator-s-console/dist` is absent
- the legacy `operator-ui` route assets have been removed from the tracked
  runtime tree
- integration tests now use an isolated fixture bundle path instead of
  mutating the live `operator-s-console/dist` output

## Verification Checklist

The cutover is only complete when all of the following are true:

1. visiting `/operator` renders `operator-s-console`
2. authenticated operator flows still work end-to-end
3. task trigger, approvals, incidents, runs, agents, governance, health, and
   knowledge routes continue to function unchanged
4. public proof is reachable without a bearer token
5. public proof no longer depends on `openclawdbot` transport routes
6. legacy shell files are no longer required at runtime

## Outcome

The cutover goals above are complete in the active repo:

1. `operator-s-console` is the canonical tracked `/operator` UI
2. orchestrator serves the built bundle directly at `/operator` and
   `/operator/*`
3. public proof is orchestrator-owned through `/api/command-center/*` and
   `/api/milestones/*`
4. the legacy runtime shell is no longer part of the tracked runtime path

For current `/operator` and API truth, use:

- `../reference/api.md`
- `../architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX.md`
- `../../README.md`
