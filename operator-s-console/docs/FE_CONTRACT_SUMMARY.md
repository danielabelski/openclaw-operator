# Frontend Contract Summary

Purpose: Give the frontend builder a tight operating contract for what the private operator console should expose now, what must stay hidden, and what should be labeled as partial or admin-only.

## Product truth

The product should be a private operator console backed by orchestrator APIs.
The old `openclawdbot` proof lane is retired from active local scope.
Public proof now belongs to orchestrator-owned public routes and should be
modeled as part of the current frontend contract.

V1 must expose a curated set of safe, real workflows instead of mirroring every declared backend capability.

Operational truth must stay visible: allowlisted does not mean user-ready, and manifest-present does not mean service-operational.

---

## V1 app sections

Overview

Tasks

Task Runs

Approvals

Agents

Knowledge

Governance

System Health

Diagnostics (operator-only runtime verification surface, not in original PRD but implemented)

Public Proof (orchestrator-owned public route family served from the same app)

Auth persistence across Lovable preview/auth-bridge redirects

---

## V1 runnable tasks

All non-internal public-triggerable task types are now rendered through
task-specific forms in `TasksPage.tsx`.

Examples:

- `heartbeat` - ready
- `build-refactor` - needs approval, confirmed working after approval
- `market-research` - ready in query-only mode, external dependency risk in URL mode
- `drift-repair` - exposed with repair caveats
- `reddit-response` - exposed with queue/provider caveats
- `security-audit`, `system-monitor`, `summarize-content`, `content-generate`,
  `integration-workflow`, `normalize-data`, `data-extraction`,
  `qa-verification`, and `skill-audit` - exposed with bounded payload forms
- `rss-sweep`, `nightly-batch`, `send-digest`, and `agent-deploy` - exposed
  with caveat-heavy operator forms

---

## Do not expose in normal V1

Internal-only tasks such as startup and doc-change

Full governed skill management

Service start or deployment controls

Raw JSON payload editing by default

Internal ingest and debug routes

---

## Required frontend labels

Ready

Needs Approval

Partially Available

Needs External Setup

Internal Only

Not Yet Verified

Service Available

Service Not Available

Restart-Safe

Metadata Only

## Additional runtime status labels (implemented in StatusBadge)

healthy / degraded / down

full / partial / metadata-only

pending / queued / running / retrying / success / completed / failed

pending-approval

Confirmed Worker / Spawned-Worker Capable

error / warning / approval (semantic color keys)

---

## Diagnostics surface

The Diagnostics page (`/diagnostics`) probes 20 contract endpoints sequentially with 350ms inter-request delay for production safety. Results include HTTP status, latency, X-Request-Id, and rate-limit headers. 429 responses show countdown timers and retry buttons. Summary (pass/fail/rate-limited/avg latency) is shared to the Overview page via DiagnosticsContext. Operator role required.

Probed endpoints: /health, /api/persistence/health, /api/knowledge/summary, /api/command-center/overview, /api/command-center/control, /api/command-center/demand, /api/command-center/demand-live, /api/milestones/latest, /api/milestones/dead-letter, /api/auth/me, /api/dashboard/overview, /api/tasks/catalog, /api/tasks/runs, /api/agents/overview, /api/skills/policy, /api/skills/registry, /api/skills/telemetry, /api/skills/audit, /api/health/extended, /api/persistence/summary

---

## API endpoint status

The current contract routes are wired in frontend code across `src/lib/api.ts`,
`src/contexts/AuthContext.tsx`, and the proof hooks. Routes that remain
backend-only are intentionally not surfaced in the operator console. The
canonical per-route status lives in `docs/V1_API_CONTRACT.md`.

---

## Agent display model

Show separate truths for Declared, Spawned-worker capable, Service-available, Service-installed, and Service-running.

Confirmed worker now: build-refactor-agent and market-research-agent.

Confirmed service-operational now: doc-specialist and reddit-helper.

Do not use a single online/offline label.

---

## Governance truth

The operator dashboard can already show approvals backlog, retry recovery backlog, milestone backlog, demand backlog, governed skill trust split, queue counts, persistence health, and recent tasks.

This is a real private operator surface, but still a partial control model, not full workflow governance.

---

## Non-negotiable constraints

Internal allowlist is broader than public triggerability.

Public proof routes are not the private operator control plane.

Public control summary is static metadata, not live agent certainty.

Any task or agent not validated in runtime must be labeled honestly.
