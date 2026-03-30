# V1 API Contract

Purpose: Narrow API slice for the first private operator console. Only include routes the frontend needs in V1.

### Contract status legend

- Unless otherwise marked, every endpoint entry below is **wired in the current frontend** (consumed by `src/lib/api.ts` or `src/contexts/AuthContext.tsx`).
- Entries explicitly marked **"documented but not wired in frontend"** exist in the backend but are not currently consumed by the UI.
- Routes labelled **"public/community surface only"** are legacy proof-surface routes, not current operator-console scope.

---

## GET /api/dashboard/overview

Auth: Bearer token

Frontend use: Overview home screen, governance cards, queue and recent activity.

Request or response shape: generatedAt, health, persistence, memory, queue, approvals, governance, recentTasks

Notes: Core operator route. Use as the main page data source.

---

## POST /api/tasks/trigger

Auth: Bearer token

Frontend use: Run curated tasks from guided forms.

Request or response shape: type, payload

Notes: Expose only a curated task catalog. Do not provide raw JSON by default.

---

## GET /api/approvals/pending

Auth: Bearer token

Frontend use: Approvals inbox and badges.

Request or response shape: count, pending

Notes: Use for review queue and notification counts.

---

## POST /api/approvals/:id/decision

Auth: Bearer token

Frontend use: Approve or reject gated work.

Request or response shape: decision, actor, note

Notes: Use in modal or review side panel.

---

## GET /health

Auth: Public

Frontend use: System health banner.

Request or response shape: status fields and related URLs

Notes: Small health card only.

---

## GET /api/persistence/health

Auth: Public

Frontend use: Persistence and DB health.

Request or response shape: persistence health object

Notes: Show prominently when degraded.

---

## GET /api/knowledge/summary

Auth: Public

Frontend use: Knowledge summary card.

Request or response shape: knowledge summary object

Notes: Secondary informational panel only.

---

## GET /api/memory/recall

Auth: Bearer token

Frontend use: Advanced admin inspection only.

Request or response shape: agentId, limit, offset, includeErrors, includeSensitive

Notes: Not core V1 for non-technical users.

---

## POST /api/knowledge/query

Auth: Bearer token

Frontend use: Advanced admin search.

Request or response shape: query, limit, filter

Notes: Admin-only if exposed later.

---

## GET /api/command-center/overview

Auth: Public

Frontend use: Public proof overview — system proof metrics, risk counts, proof nodes, latest milestone.

Request or response shape: CommandCenterOverviewResponse (ok, latest, stale, visibleFeedCount, evidenceCount, activeLaneCount, activeLanes, riskCounts, deadLetterCount, lastPollAt, realtimeChannel, proofNodes)

Notes: Public/community surface only. Wired via `src/hooks/use-public-surface-api.ts`.

---

## GET /api/command-center/control

Auth: Public

Frontend use: Public proof control summary — cluster and engine metadata.

Request or response shape: CommandCenterControlResponse (ok, clusters with engines)

Notes: Public/community surface only. Static metadata, not live runtime truth. Wired via `src/hooks/use-public-surface-api.ts`.

---

## GET /api/auth/me

Auth: Bearer token

Frontend use: Session validation, login flow, test connection.

Request or response shape: actor, role, roles, apiKeyVersion

Notes: Used by AuthContext for login and session restoration. Returns X-API-Key-Expires header.

---

## GET /api/tasks/catalog

Auth: Bearer token

Frontend use: Task catalog on Tasks page.

Request or response shape: generatedAt, tasks (array of CatalogTask with type, label, purpose, operationalStatus, approvalGated, telemetryOverlay, caveats, exposeInV1)

Notes: Machine-readable task metadata. Frontend filters by exposeInV1 and internalOnly.

---

## GET /api/tasks/runs

Auth: Bearer token

Frontend use: Task run history, diagnostics.

Request or response shape: query params (type, status, limit, offset), response (generatedAt, total, page, runs)

Notes: Paginated task run list.

---

## GET /api/tasks/runs/:id

Auth: Bearer token

Frontend use: Task run detail inspection.

Request or response shape: generatedAt, run (TaskRun)

Notes: Single run detail.

---

## GET /api/agents/overview

Auth: Bearer token

Frontend use: Agents page directory.

Request or response shape: generatedAt, count, agents (array with id, name, declared, spawnedWorkerCapable, workerValidationStatus, serviceOperational, etc.)

Notes: Core agent truth surface. Shows separate declared/worker/service status.

---

## GET /api/skills/policy

Auth: Bearer token

Frontend use: Governance page — governed skills policy summary.

Request or response shape: generatedAt, policy (totalCount, pendingReviewCount, approvedCount, restartSafeCount, etc.)

Notes: Aggregate skill governance posture.

---

## GET /api/skills/registry

Auth: Bearer token

Frontend use: Governance detail — individual skill records.

Request or response shape: generatedAt, total, skills (array)

Notes: Full skill registry listing.

---

## GET /api/skills/telemetry

Auth: Bearer token

Frontend use: Governance page — invocation telemetry.

Request or response shape: generatedAt, telemetry (totalInvocations, allowedCount, deniedCount)

Notes: Skill execution telemetry summary.

---

## GET /api/skills/audit

Auth: Bearer token

Frontend use: Admin-level audit trail.

Request or response shape: query params (limit, offset, deniedOnly), response (generatedAt, total, page, records)

Notes: Paginated audit records. Stale time 60s, no auto-refetch.

---

## GET /api/health/extended

Auth: Bearer token

Frontend use: System Health page — extended health details.

Request or response shape: generatedAt, status, controlPlane, workers, dependencies

Notes: Deeper health surface showing routing, queue, worker counts, dependency health.

---

## GET /api/persistence/summary

Auth: Bearer token

Frontend use: System Health page — persistence detail.

Request or response shape: generatedAt, status, persistenceAvailable, storage, collections, indicators, retention

Notes: Detailed persistence posture beyond basic health.

---

## GET /api/command-center/demand

Auth: Public

Frontend use: Public proof demand view — segments and summary.

Request or response shape: CommandCenterDemandResponse (ok, segments, summary)

Notes: Public/community surface only. Wired via `src/hooks/use-public-surface-api.ts`.

---

## GET /api/milestones/latest

Auth: Public

Frontend use: Public proof milestone timeline — recent milestone events.

Request or response shape: MilestoneFeedResponse (ok, items). Supports ?limit=1..50 (default 20).

Notes: Public/community surface only. Wired via `src/hooks/use-public-surface-api.ts`.

---

## GET /api/command-center/demand-live

Auth: Public

Frontend use: Public proof live demand data — real-time demand variant.

Request or response shape: CommandCenterDemandResponse (ok, segments, summary)

Notes: Public/community surface only. Live variant of /api/command-center/demand. Wired via `src/hooks/use-public-surface-api.ts`.

---

## GET /api/milestones/dead-letter

Auth: Public

Frontend use: Public proof dead-letter milestones — failed delivery events.

Request or response shape: MilestoneDeadLetterResponse (ok, items)

Notes: Public/community surface only. Wired via `src/hooks/use-public-surface-api.ts`.

---

# V1 task-to-form mapping

heartbeat -> no fields -> run now

build-refactor -> structured admin form -> approval required

market-research -> required query field, optional advanced URL field

doc-sync / nightly-batch / send-digest -> no extra fields -> run default backend action

drift-repair -> requestedBy + optional paths/targets/notes

reddit-response -> responder + optional manual queue payload fields

security-audit / system-monitor -> bounded select + scope/agents forms

summarize-content / content-generate / integration-workflow / normalize-data / data-extraction -> structured payload forms

qa-verification / skill-audit -> verification and governance-specific structured forms

rss-sweep -> optional config path overrides

agent-deploy -> approval-gated structured form

---

# API constraints to preserve in UI

Do not expose startup or doc-change in the task launcher.

Do not imply all allowlisted tasks are public-triggerable.

Do not expose internal ingest routes or debug routes to normal users.
