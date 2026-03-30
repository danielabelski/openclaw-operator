# Frontend Operator Console PRD

## Purpose

Build a non-technical operator frontend for OpenClaw that exposes what the backend can actually do today without forcing users into the CLI.

This is **not** a frontend for every declared backend capability.
This is a **curated operator console** built from runtime truth.

The frontend must:
- expose safe, real operator workflows
- reflect actual backend operational status
- preserve governance boundaries
- avoid overclaiming unverified or partial backend surfaces
- support community trust by making system state legible

## Product Summary

The backend supports a credible V1 operator console made of:
- protected orchestrator APIs for task execution, approvals, operator overview, governance summary, health, and persistence visibility

The retired `openclawdbot` proof layer should not be treated as the backend for
this console.

The frontend should therefore focus on one backend authority with two route
families:
- **Private Operator Console** for authenticated operators
- **Public Proof Surface** backed by orchestrator-owned public routes

Any leftover references that imply a separate proof backend are stale and
should be removed.

## Product Principles

1. **Runtime truth over architectural ambition**
   Only expose what runtime proves.

2. **Curated usability over raw backend completeness**
   A small trustworthy UI is better than a wide misleading UI.

3. **Governance must stay visible**
   Approval gates, degraded states, backlog pressure, and partial controls should be visible in plain language.

4. **Non-technical does not mean unsafe**
   The UI should guide users through approved paths, not bypass backend controls.

5. **Operational classification is mandatory**
   The frontend must separate:
   - internal-only
   - approval-gated
   - confirmed working
   - partially operational
   - externally dependent
   - not yet verified
   - service-operational
   - spawned-worker capable

## Users

### Primary User
**Operator / Admin**
A non-technical or semi-technical user who wants to run tasks, approve gated actions, monitor system health, and understand what the system can do right now.

### Secondary User
**Legacy Community Observer**
A historical proof-surface viewer persona kept only for reference while the
retired proof lane remains in the repo.

## V1 Goals

- let operators run a safe subset of real tasks
- let operators review and approve approval-gated work
- make governance and backlog state visible
- make task and agent status discoverable
- reduce CLI dependence for common operations
- support confidence and conversion by reflecting what works now

## Non-Goals

- full self-serve access to every allowlisted task
- governed skill CRUD UI
- service lifecycle management UI
- full audit explorer
- broad automation builder UI
- complete community multi-tenant platform
- exposing internal-only tasks as normal user actions

## Information Architecture

### 1. Overview
**Status:** Ready now

Purpose:
- top-level operator summary
- queue and processing visibility
- approvals count
- governance summary
- recent task activity
- persistence and health visibility

Primary backend sources:
- `GET /api/dashboard/overview`
- `GET /health`
- `GET /api/persistence/health`

Main UI elements:
- health summary cards
- approvals card
- retry backlog card
- delivery backlog cards
- governed skill summary card
- recent task activity table
- degraded mode banner if needed

### 2. Tasks
**Status:** Ready now as curated subset

Purpose:
- list operator-safe tasks
- guide the user through task forms
- explain approvals and dependency requirements

Primary backend sources:
- `POST /api/tasks/trigger`
- curated task metadata derived from backend truth

V1 tasks to expose:
- `heartbeat`
- `build-refactor`
- `market-research` (query-only default)
- all remaining non-internal public-triggerable task types through bounded
  task-specific forms

Tasks not to expose in normal V1:
- `startup`
- `doc-change`
- raw service-management controls
- arbitrary internal/debug routes

### 3. Approvals
**Status:** Ready now

Purpose:
- show pending approvals
- support approve/reject actions
- make review decision flow non-technical

Primary backend sources:
- `GET /api/approvals/pending`
- `POST /api/approvals/:id/decision`

Main UI elements:
- approvals inbox table
- task summary panel
- approve/reject modal
- actor/note input

### 4. Agents
**Status:** Ready now as informational directory

Purpose:
- show what agents exist
- distinguish declared agents from working ones
- separate spawned-worker truth from service-operational truth

Primary data source:
- curated runtime truth derived from manifests and validated operational sweep

Main UI elements:
- agents table
- operational labels and badges
- mapped task display
- dependency sensitivity indicator

### 5. Governance
**Status:** Ready now as summary

Purpose:
- expose governance posture and backlog pressure
- surface controlled-state visibility without creating fake control authority

Primary backend source:
- `GET /api/dashboard/overview` -> `governance`

Main UI elements:
- approvals pending
- retry recovery backlog
- milestone backlog summary
- demand backlog summary
- governed skill trust/durability summary

### 6. System Health
**Status:** Ready now

Purpose:
- make degraded mode, persistence health, and system status understandable

Primary backend sources:
- `GET /health`
- `GET /api/persistence/health`
- `GET /api/knowledge/summary`

Main UI elements:
- health cards
- persistence status
- knowledge summary card
- warnings for fast-start/degraded conditions

### 7. Public Proof
**Status:** Optional V1, ready now

Purpose:
- community confidence layer
- public proof that the system is active

Primary backend sources:
- `GET /api/command-center/overview`
- `GET /api/command-center/control`
- `GET /api/command-center/demand`
- `GET /api/milestones/latest`

Main UI elements:
- proof timeline
- demand cards
- control summary cards

Important note:
This is **not** the full operator control plane.

## Backend Capability Matrix

### Tasks

| Task | Public Triggerable | Approval-Gated | Runtime Truth | V1 Exposure |
|---|---:|---:|---|---|
| `heartbeat` | Yes | No | Confirmed working | Expose |
| `build-refactor` | Yes | Yes | Confirmed working after approval | Expose |
| `market-research` | Yes | No | Confirmed working in query-only mode | Expose |
| `doc-sync` | Yes | No | Confirmed control-plane path | Expose |
| `nightly-batch` | Yes | No | Historical success, scheduler/feed dependent | Expose with caveat |
| `send-digest` | Yes | No | Partial, notifier dependent | Expose with caveat |
| `rss-sweep` | Yes | No | Config/network dependent | Expose with caveat |
| `startup` | No | No | Internal-only | Hide |
| `doc-change` | No | No | Internal-only | Hide |
| `agent-deploy` | Yes | Yes | Approval-gated, not confirmed in sweep | Expose with strong caveat |
| `drift-repair` | Yes | No | Partial/degraded | Expose with caveat |
| `reddit-response` | Yes | No | Partial/degraded | Expose with caveat |
| `security-audit`, `system-monitor`, `summarize-content`, `content-generate`, `integration-workflow`, `normalize-data`, `data-extraction`, `qa-verification`, `skill-audit` | Yes | Some via payload | Validated with mixed runtime caveats | Expose with bounded forms |

### Agents

| Agent | Declared | Spawned Worker Path | Confirmed Working | Service Operational | V1 Treatment |
|---|---:|---:|---:|---:|---|
| `build-refactor-agent` | Yes | Yes | Yes | No | Show as confirmed worker |
| `market-research-agent` | Yes | Yes | Yes | No | Show as confirmed worker |
| `doc-specialist` | Yes | Yes | Not confirmed in sweep | Yes | Show service available |
| `reddit-helper` | Yes | Yes | Not confirmed in sweep | Yes | Show service available |
| Most other manifest-backed agents | Yes | Yes | Not confirmed | No | Show as declared / worker not yet confirmed |

## API Contracts For Frontend

> **Live contract:** See `docs/V1_API_CONTRACT.md` for the full endpoint-by-endpoint contract (27 entries).
> The inline endpoint list that was originally here has been removed to prevent drift.
> Only product-level intent is preserved below.

Frontend API usage notes:
- `GET /api/dashboard/overview` is the core operator console data route — do not expose publicly
- `POST /api/tasks/trigger` must only expose the curated task catalog — no raw freeform JSON by default
- Public proof routes (`/api/command-center/*`, `/api/milestones/*`) are for the optional community surface only — do not treat as operator routes

## Task Form Contract

### Heartbeat
Display label: **Run System Heartbeat**

Purpose:
- lightweight system status check

Fields:
- none

Status:
- Ready

### Build Refactor
Display label: **Run Build Refactor**

Purpose:
- run the guarded build-refactor workflow

Fields:
- structured input object
- optional operator note

Approval:
- required by default

Status:
- Needs Approval
- Confirmed working after approval

### Market Research
Display label: **Run Market Research**

Purpose:
- run a market research query or source analysis

Fields:
- `query` required in V1
- `url` advanced only, optional

Status:
- Ready for query-only mode
- Needs External Setup / Partially Available for URL mode

### Doc Sync
Display label: **Sync Documentation**

Purpose:
- run documentation synchronization logic

Status:
- Not Yet Verified
- admin-only if exposed

### Nightly Batch
Display label: **Run Nightly Batch**

Purpose:
- run internal batch preparation flow

Status:
- Not Yet Verified
- admin-only if exposed

## Agent Status Contract

Agents must be shown with separate truths:

- **Declared**
- **Spawned-worker capable**
- **Confirmed worker**
- **Service available**
- **Service not implemented**
- **Not yet verified**

Do not use a single online/offline flag.

Recommended agent table columns:
- Agent
- Task Mapping
- Worker Mode
- Worker Validation Status
- Service Mode
- Dependency Notes

## Governance And System State Contract

The frontend can expose today:
- pending approvals
- retry recovery backlog
- milestone delivery backlog
- demand delivery backlog
- governed skills summary:
  - total
  - pending review
  - approved
  - restart-safe
  - metadata-only
- health and persistence state
- queue counts
- recent task activity

The frontend must **not** imply:
- full governed skill management over HTTP
- full audit control plane
- universal agent operational certainty
- that all allowlisted tasks are safe for non-technical operators

## UX/UI Guidance

### Navigation
Operator console primary nav (original PRD scope):
- Overview
- Tasks
- Approvals
- Agents
- Governance
- System Health

> **Implementation note:** Two additional sections were added during build: Diagnostics (operator-only endpoint verification) and Public Proof (community surface stub). Desktop shows 7 tabs + Public Proof as a header button. Mobile shows all 8 as bottom nav tabs.

### Status Labels
Use plain language:
- Ready
- Needs Approval
- Partially Available
- Needs External Setup
- Internal Only
- Not Yet Verified
- Service Available
- Service Not Available
- Restart-Safe
- Metadata Only

### UI Patterns
- cards for top-level health and governance state
- tables for tasks, approvals, agents, and recent activity
- guided forms for task execution
- no raw JSON editor by default
- advanced mode can exist later

### Empty States
- No approvals waiting
- No retry items waiting
- No governed skills registered
- No recent activity yet

### Degraded States
Use wording like:
- “This action is available, but depends on external services or configuration.”
- “The system is running in a reduced mode.”
- “This task is supported by the backend, but has not yet been fully validated in live operation.”

### Hidden/Admin-Only Items
Keep hidden or admin-only:
- internal-only tasks
- raw internal ingest routes
- debug/dead-letter surfaces by default
- broad knowledge export/query tooling
- raw payload editing by default

## V1 Frontend Scope

Build now:
- Overview
- Tasks
- Approvals
- Agents
- Governance
- System Health

Expose now:
- `heartbeat`
- `build-refactor`
- `market-research` query-only
- the remaining public-triggerable task lanes through bounded forms and caveat-driven labels

Do not build in V1:
- full governed skills management UI
- full audit explorer
- service controls
- all-task launcher
- internal task execution UI

## Backend Gaps Blocking Frontend Quality

> **Implementation status note (V1 build):**
> This section was written before frontend implementation. Several gaps have since been resolved.
> See `docs/V1_API_CONTRACT.md` for the current contract (27 entries, 23 wired in code) and `src/lib/api.ts` for the implementation truth.

1. No frontend-ready detailed governed skill route — **partially resolved:** `/api/skills/policy`, `/api/skills/registry`, `/api/skills/telemetry`, `/api/skills/audit` are now wired
2. No machine-readable task metadata/catalog endpoint — **resolved:** `/api/tasks/catalog` is implemented and wired
3. Many tasks are routable but not operationally confirmed — still true
4. Agent truth is split between manifests, service files, and validation sweep — **partially resolved:** `/api/agents/overview` now wired
5. Public control route is static metadata, not live runtime state — still true
6. No full operator audit stream — **partially resolved:** `/api/skills/audit` provides paginated audit records
7. Fast-start mode can make routing healthy while persistence is degraded — still true

## Handoff Summary For Frontend Build

Build a **private authenticated operator console** first.
Use the orchestrator protected APIs as the main backend.
Treat the existing public proof layer as optional public/community UI.

Do not mirror all backend capabilities.
Build a curated V1 with only proven-safe operator flows.

Non-negotiable truths:
- internal allowlist is broader than public triggerability
- some tasks are internal-only
- some tasks require approval
- some tasks are externally dependent
- manifest present is not the same as service-operational
- governed skill visibility is summary-only for frontend right now
- governance visibility is real but partial
- public proof routes are not the same as internal operator control
