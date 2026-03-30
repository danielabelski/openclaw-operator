# Sprint To Completion

Status: Numbered sprint ladder complete; maintenance tracks remain
Last updated: 2026-03-20
Owner: Workspace maintainers

Forward implementation authority lives in the root `OPENCLAW_CONTEXT_ANCHOR.md`.
This file tracks execution sequencing and remaining work only; it is not the canonical runtime truth source or the primary roadmap authority.
Do not use this file to introduce a parallel sprint ladder or to override the
root anchor's implementation contract. If sequencing here conflicts with the
anchor, the anchor wins and this tracker must be updated.

## Objective

Finish the orchestrator as the control plane first, then return to broader
exposure work from a stronger runtime foundation.

## Current Snapshot

### Already Landed

1. The orchestrator-first sprint ladder is now complete through Sprint 9.
2. Operator contract truth, run and incident evidence, repair evidence,
   governed capability completion, service lifecycle proof, downstream proof,
   public-doc truth, and exposure-gating work are all now closed for the
   active local runtime slice.
3. Retired proof-surface docs were removed from `main`; Git history is now the
   historical record for that old delivery lane.

### Ongoing Maintenance

1. Documentation truth still needs normal upkeep in deeper secondary docs.
2. Public navigation still needs continued discipline so historical docs are
   not mistaken for active truth.
3. The new Redis / Valkey coordination slice needs normal maintenance and
   future scale-out beyond the first bounded claim/lock/budget path.
4. The forward implementation ladder now lives in
   `../OPENCLAW_CONTEXT_ANCHOR.md`; this file now tracks completion state plus
   ongoing maintenance, not an open numbered sprint ladder.

## Active Work Tracks

## Track 1: Documentation Truth

### Goal

Keep docs aligned to live code and remove ambiguity about what is canonical.

### Remaining Work

1. Keep the canonical anchor, root README, docs index, and KB truth docs aligned
   with runtime code
2. Keep subproject docs aligned without creating competing truth layers
3. Keep root navigation and docs navigation in sync after future code changes

## Track 2: Retired Proof-Surface Boundary Hygiene

### Goal

Keep the active docs tree free of revived retired proof-surface material.

### Remaining Work

1. Avoid reintroducing retired proof-surface work into active sprint language
2. Keep product-facing docs focused on the current orchestrator-owned proof path
3. Use Git history instead of restoring dead proof-surface runbooks into `main`

## Forward Governance Ladder

The root anchor now requires orchestrator-first execution sequencing.
This plan operationalizes that contract; it does not replace the anchor.

## Orchestrator-First Sprint Ladder

This is the current execution order for completing the control plane before
returning to broader exposure work. It is intentionally ordered by runtime
dependency, not by subsystem ownership.

### Sprint 1: Production Boot Without Fast-Start

Goal: prove the orchestrator can run on the canonical production path without
falling back to fast-start.

Status: completed on `2026-03-09`.

Outcome:

1. The real non-fast-start launch now runs on port `3312`.
2. Mongo-backed persistence and KnowledgeIntegration are proven on the
   canonical runtime path.
3. The temporary orchestrator-local MemoryScheduler/snapshot writer used during
   the early cutover was later removed on `2026-03-21`; canonical continuity
   now lives in the root workspace memory files instead.

### Sprint 2: Agent Service Truth

Goal: make service-mode claims fully evidence-backed instead of only
file-availability-backed.

Status: completed on `2026-03-09`.

Outcome:

1. `/api/agents/overview` and `/api/health/extended` now distinguish
   `serviceAvailable`, `serviceInstalled`, and `serviceRunning`.
2. `serviceRunning=false` is now host-proven truth when a matching unit is
   absent or inactive; `null` is reserved for probe-unavailable cases.
3. On the current host, agent service units are not installed, so the live
   aggregate truth is `serviceAvailableCount=13`, `serviceInstalledCount=0`,
   `serviceRunningCount=0`.

### Sprint 3: Operator API Contract Completion

Goal: finish the orchestrator operator-facing API as a release-quality control
plane contract, not just a route inventory.

Status: completed on `2026-03-19`.

Outcome:

1. `docs/reference/api.md` is aligned to the current orchestrator-owned route
   contract and now explicitly treats `GET /api/openapi.json` as the
   machine-readable companion for real clients.
2. `orchestrator/src/openapi.ts` now covers the active public proof routes plus
   the protected operator route families with request/query/path schemas,
   success/error payload shapes, security schemes, cache/rate-limit headers,
   and explicit `x-openclaw-access` role/bucket metadata.
3. `/operator` cutover is code-true: orchestrator serves only the built
   `operator-s-console` bundle for `/operator` and `/operator/*`, and current
   supporting clients are wired to the authoritative orchestrator routes.
4. Auth, RBAC, CORS, and rate-limit behavior are documented as control-plane
   constraints in the canonical API reference rather than implied frontend
   behavior.
5. Focused OpenAPI contract proof now guards the route-family coverage and the
   role/rate-limit/request-body metadata that Sprint 3 required.

Supporting blueprint:

- `operations/OPERATOR_S_CONSOLE_CUTOVER_BLUEPRINT.md`

### Sprint 4: Task Run, Incident, And Repair Truth Closure

Goal: make the orchestrator execution ledger and bounded self-healing surfaces
credible enough to be treated as a control-plane source of truth.

Status: completed on `2026-03-20`.

Outcome:

1. `/api/tasks/runs`, `/api/tasks/runs/:runId`, `/api/incidents`,
   `/api/incidents/:id`, `/api/incidents/:id/history`,
   `/api/dashboard/overview`, and `/api/health/extended` now stay aligned
   under shared integration-suite load instead of only passing in isolated
   slices.
2. `taskHandlers` now preserves the promoted `resultSummary.highlights` fields
   needed for operator-visible run output, including nested readiness signals
   such as `queueBudgetFusion.predictionConfidence`.
3. Queue execution truth now only reuses a run id when a caller explicitly
   provides `payload.idempotencyKey`; normal task triggers fall back to their
   own task ids so later operator-visible runs do not disappear behind an older
   successful duplicate.
4. Full shared-load runtime proof now covers the Sprint 4 surface through
   `orchestrator/test/integration.test.ts`, and the queue/run-id regression is
   pinned in `orchestrator/test/task-queue.test.ts`.
5. The broader runtime safety net remains green after the Sprint 4 closure
   changes: `npx tsc --noEmit`, `bash scripts/check-doc-drift.sh`,
   `npx vitest run test/integration.test.ts --testTimeout=180000`, and
   `npx vitest run test/task-queue.test.ts test/toolgate.runtime.test.ts test/runtime-evidence-intelligence.test.ts --testTimeout=180000`.

### Sprint 5: Governed Capability Completion Across All Agents

Goal: bring every declared non-template agent toward full capability under
orchestrator governance, without flattening ToolGate or manifest boundaries.

Status: completed on `2026-03-20`.

Outcome:

1. The current governed capability working pack is now closed for the active
   control-plane slice: all declared non-template agents show `complete` in
   the promotion-state table of
   `docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md`.
2. Wave 1, Wave 2, and Wave 3 readiness/promotion gates are all closed for the
   current runtime slice, and the capability pack now consistently describes
   the remaining per-agent work as post-gate adoption or later-sprint
   lifecycle work rather than missing governed-capability implementation.
3. The capability working pack is aligned in the same repo truth set:
   `docs/architecture/AGENT_CAPABILITY_MODEL.md`,
   `docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md`,
   `docs/architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX.md`, and
   `docs/reference/task-types.md`.
4. Focused runtime proof remains green for the capability surface through the
   shared integration suite, toolgate/runtime-evidence proofs, and the Sprint 4
   run/incident/repair closure that now underpins those signals.
5. Remaining broader work is intentionally pushed into later sprints:
   service lifecycle and host runtime closure (Sprint 6), downstream delivery
   proof (Sprint 7), public docs/release truth (Sprint 8), and exposure
   expansion after those gates clear (Sprint 9).

#### Sprint 5 Executed Capability Uplift Pack

This is the current execution slice for Sprint 5. It implements two immediate
planning requirements:

1. extract the concrete blockers from the latest `doc-specialist` knowledge
    pack that actually matter for capability uplift
2. turn the control-plane readiness logic into an agent-by-agent sprint table

Evidence base for this sprint:

- latest measured pack:
   `logs/perf-evidence/2026-03-16-doc-specialist-drift-repair/single-result.json`
- capability readiness contract:
   `orchestrator/src/index.ts` `buildAgentCapabilityReadiness(...)`
- capability target and implementation truth:
   `docs/architecture/AGENT_CAPABILITY_MODEL.md`
   `docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md`
   `docs/architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX.md`

#### Concrete Blockers Addressed In This Sprint

These are the blockers from the latest pack that materially affect governed
capability uplift right now.

1. Template-noise blocker is closed; keep it closed.
    - The active runtime scanners already exclude `agents/AGENT_TEMPLATE`, so
       template drift should no longer be treated as capability debt for the
       declared portfolio.
    - Sprint action: keep pack summaries, readiness views, and sprint reporting
       aligned with the non-template runtime fleet only.

2. Host service coverage is still incomplete for multiple real agents.
    - The latest pack explicitly flags `build-refactor-agent`, `content-agent`,
       `data-extraction-agent`, `market-research-agent`,
       `normalization-agent`, `reddit-helper`, `skill-audit-agent`, and
       `summarization-agent` as having a service entrypoint that is not fully
       installed or running on this host.
    - Sprint action: keep service-mode truth explicit by separating
       `serviceExpected` agents from raw service-entrypoint presence in control-
       plane summaries, and then decide host-by-host whether any additional
       service installs are actually required.

3. The repair loop is not yet trustworthy enough to support full-capability
    claims.
    - The pack shows active critical repair failures in the
       `incidentPriorityQueue`, with repeated `qa-verification` handoff pressure.
    - Sprint action: close the verifier/remediation loop so repair evidence can
       count as mature capability evidence rather than recurring backlog.

4. Workflow-stop pressure is still unresolved.
    - The pack reports `180 workflow stop signal(s) remain unresolved` and the
       runtime truth block shows `39` open incidents with `29` critical.
    - Sprint action: reduce unresolved workflow-stop signals and make stop
       causes causally attributable in runtime history.

5. Portfolio-level readiness is now closed for the current Wave 1, Wave 2,
   and Wave 3 runtime slices, but broader host/service lifecycle,
   workflow-backlog, and governance-adoption work remains.
    - The capability docs should treat the readiness logic in
       `orchestrator/src/index.ts` plus focused runtime proof as the operative
       closure test for current-wave promotion gates.
    - Sprint action: keep route presence or isolated task success distinct from
       broader end-state maturity, but stop describing already-proven Wave 1
       promotion gates as open blockers.

#### Control-Plane Readiness Inputs Closed In This Sprint Slice

The orchestrator currently treats these as the generic readiness inputs before
an agent can approach ultra-capable in-role status:

- tiered model declaration
- governed skill access
- runtime execution path
- live service coverage where service mode is expected
- successful runtime evidence
- tool execution evidence
- memory-backed operational evidence
- verification or repair evidence

Sprint 5 work should close these inputs deliberately, agent by agent, rather
than flattening permissions or over-claiming maturity.

#### Executed Sprint Scope

Work this sprint in the following order.

1. Remove false blockers from the capability signal.
    - Exclude `AGENT_TEMPLATE` drift from active-agent capability debt and pack
       summaries.
    - Make service-mode expectations explicit per agent so host truth is not
       ambiguous.

2. Close Wave 1 evidence gaps first.
    - `doc-specialist`
    - `integration-agent`
    - `system-monitor-agent`
    - `security-agent`
    - `qa-verification-agent`

Progress on `2026-03-16`:

- `doc-specialist` now emits ranked contradiction entities and handoff-ready
   repair drafts.
- `integration-agent` now emits explicit stop-cause and resume guidance in the
   normal workflow result.
- `integration-agent` now also emits delegation decisions, execution lanes, and
   replay checkpoints so blocked or rerouted workflows stay replayable.
- `integration-agent` now also classifies workflow surface, critical path, and
   coordination risks, and emits explicit downstream handoff packages.
- `qa-verification-agent` now closes or reopens linked incidents and repairs
   through orchestrator task handling instead of remaining advisory-only.
- `qa-verification-agent` now also emits explicit verification authority for
   incident, repair, workflow, agent, and workspace targets.
- `qa-verification-agent` now also applies surface-aware acceptance/refusal
   rules so doc/public-proof verification cannot silently close without anchors.
- `system-monitor-agent` now emits incident-causality records and routes
   monitoring influence toward owning or affected agents.
- `system-monitor-agent` now also exposes trust-boundary pressure and rolling
   degradation windows so recurring auth/proof pressure is visible in the
   monitor result itself.
- `system-monitor-agent` now also emits predictive early warnings when proof,
   retry, workflow-stop, and trust-boundary signals converge.
- `security-agent` now scores exploitability and blast radius numerically and
   carries historical trust-boundary evidence into findings.
- `security-agent` now also audits the live auth-boundary contract for
   constant-time comparison protection and returns bounded fixes with
   containment context.
- `security-agent` now also reviews route declarations for missing auth
   middleware so route/auth regressions surface as explicit findings.
- Wave 2 workers now emit first real evidence-bearing slices:
   `content-agent` evidence anchors and speculative refusal,
   `summarization-agent` handoff modes and anchor preservation,
   `data-extraction-agent` provenance/confidence handoff,
   `normalization-agent` canonical ids and uncertainty flags,
   and `market-research-agent` change-intelligence handoffs.
- Those Wave 2 workers now also pass explicit downstream handoff packages
   between communication and ingestion surfaces instead of returning isolated
   artifacts only.
- Wave 2 completion closed on `2026-03-16` for the current runtime slice:
   `reddit-helper` now routes community signals systematically,
   `content-agent` now emits evidence-attached operator/release/proof content,
   `summarization-agent` now emits replay-safe downstream artifacts,
   `data-extraction-agent` now handles multiple artifact classes under one
   evidence model, `normalization-agent` now explains schema/dedupe decisions,
   and `market-research-agent` now emits durable internal signal packs.
- Wave 2 readiness uplift completed on `2026-03-16` for the current
   control-plane readiness surface: `/api/agents/overview` now exposes compact
   runtime evidence signals for `reddit-helper`, `content-agent`,
   `summarization-agent`, `data-extraction-agent`, `normalization-agent`, and
   `market-research-agent` via `providerPosture`, `publicationPolicy`,
   `operationalCompression`, `artifactCoverage`, `comparisonReadiness`, and
   `deltaCapture`.
- Wave 3 workers now emit first real governed output slices:
   `build-refactor-agent` bounded scope, surgery profile, rollback/verification
   plans, verifier handoff, and low-confidence refusal, and
   `skill-audit-agent` intake checklist plus restart-safety explanation.
- Wave 3 readiness uplift completed on `2026-03-19` for the current
   control-plane readiness surface: `/api/agents/overview` now exposes compact
   runtime evidence signals for `build-refactor-agent` via `scopeContract`,
   `surgeryProfile`, and `verificationLoop`, and for `skill-audit-agent` via
   `trustPosture`, `policyHandoff`, and `telemetryHandoff`.
- Wave 3 completion closed on `2026-03-19` for the current runtime slice:
   `build-refactor-agent` now routes approval-bounded code remediation into the
   incident/remediation/verifier loop, and `skill-audit-agent` remains proven
   end to end through operator readiness output.

3. Convert repair and workflow backlog into capability evidence.
    - Reduce unresolved workflow-stop signals.
    - Turn repair verification from repeated backlog into closure evidence.

4. Only then extend the same closure pattern across backlog, host-lifecycle,
   and governance-adoption work without reopening already-closed Wave 1,
   Wave 2, or Wave 3 promotion gates.

#### Agent-By-Agent Capability Sprint Table

| Agent | Immediate blocker now | Current evidence basis | Sprint slice now | Done signal |
|---|---|---|---|---|
| `doc-specialist` | Wave 1 promotion gate closed for the current runtime slice | capability matrix now shows deterministic contradiction ranking, repair-draft handoff, target-specific knowledge bundles, route/service/config topology, doc-level freshness evidence, plus `entityFreshnessLedger` and `contradictionGraph` runtime signals | broaden downstream consumption of the richer truth pack without reopening the gate | contradiction graph is ranked, evidence rails are separated cleanly, and downstream agents can consume task-shaped packs without reinterpretation |
| `integration-agent` | Wave 1 promotion gate closed for the current runtime slice | implementation matrix now shows delegation, replay checkpoints, workflow profiling, handoff packages, explicit partial-completion state, plus `dependencyPlan` and `workflowMemory` runtime signals | extend the same dependency-aware orchestration across broader workflow classes without reopening the gate | workflow plans are replayable, blocked states are explicit, and coordination relationships are visible in runtime history |
| `system-monitor-agent` | Wave 1 promotion gate closed for the current runtime slice | implementation matrix now shows incident causality, trust-boundary pressure, degradation windows, early warnings, dependency-health posture, sharper queue/budget fusion, plus `operatorClosureEvidence` and `trendSummary` | extend runtime-to-operator closure evidence beyond the focused fixture path without reopening the current gate | monitoring output consistently drives incidents or prioritization and relationship history shows real monitoring influence |
| `security-agent` | Wave 1 promotion gate closed for the current runtime slice | implementation matrix now shows exploitability scoring, auth-boundary review, route-protection review, bounded containment guidance, route-boundary watch posture, regression review over permission-drift history, plus `exploitabilityRanking` and `remediationClosure` | extend verifier-backed closure on remediation after the stronger regression review path without treating current-gate evidence as partial | findings distinguish severity from exploitability and route/auth regressions are evidenced historically |
| `qa-verification-agent` | Wave 1 promotion gate closed for the current runtime slice | implementation matrix now shows richer traces, explicit target authority, surface-aware acceptance contracts, plus `closureContract` and `reproducibilityProfile` | extend acceptance coverage across more surfaces without reopening the current gate | verification outcomes reliably close or reopen incidents and false-green results become visibly rare |
| `reddit-helper` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows confusion clustering, FAQ/doc-gap handoff, reply verification traces, public-boundary marking, provider fallback posture, and systematic community routing | keep host service-mode proof aligned with runtime evidence, but no further Wave 2 gate work remains | provider issues no longer collapse the communication lane and community signals feed docs/proof systematically |
| `content-agent` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows evidence-attached publishing schema, operator/release/proof specialization, speculative refusal, and downstream handoff packages | preserve this contract as new content modes land, but no further Wave 2 gate work remains | generated content carries evidence anchors and speculative publication is rejected or clearly labeled |
| `summarization-agent` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows handoff modes, evidence-preserving compression checks, action-critical replay details, and downstream replay artifacts | preserve this contract as additional summary modes land, but no further Wave 2 gate work remains | summaries become normal downstream workflow artifacts instead of isolated outputs |
| `data-extraction-agent` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows provenance-rich extraction, confidence markings, normalization handoff, multi-artifact records, and downstream extraction packages | preserve adapter coverage depth as more formats land, but no further Wave 2 gate work remains | multiple artifact classes are handled under one evidence-preserving model |
| `normalization-agent` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows uncertainty flags, canonical ids, explainable schema mismatch and dedupe decisions, and canonical dataset handoffs | preserve this contract as broader schemas land, but no further Wave 2 gate work remains | downstream agents can rely on normalized output as stable comparable input |
| `market-research-agent` | Wave 2 promotion gate closed for the current runtime slice | implementation matrix now shows change-intelligence, handoff signals, durable internal signal packs, and structured market change packs | preserve durable signal shaping as broader external domains land, but no further Wave 2 gate work remains | research results become durable internal signals rather than one-off findings |
| `build-refactor-agent` | Wave 3 promotion gate closed for the current runtime slice | implementation matrix now shows bounded scope contracts, surgery profiles, verifier handoff relationships, repair-linked verification loops, incident-remediation integration, plus `impactEnvelope` and `refusalProfile` readiness signals | extend real applied-edit proof beyond the current bounded contract without reopening the current gate | code remediation carries bounded scope, rollback/verification context, and verifier-linked incident handoff |
| `skill-audit-agent` | Wave 3 promotion gate closed for the current runtime slice | implementation matrix now shows promoted trust posture plus explicit policy and telemetry handoff over restart-safe versus metadata-only outcomes, with end-to-end readiness proof plus `intakeCoverage` and `restartSafetySummary` | extend operator-facing adoption of the richer handoff signals without reopening the current gate | operators can see why a skill is trusted, restricted, or non-executable |

#### This Sprint's Deliverables

1. Capability debt signal cleanup
    - `AGENT_TEMPLATE` no longer pollutes active-agent capability reporting.
    - service-mode expectations are explicit and host-proven.

2. Wave 1 readiness uplift
    - stronger readiness evidence for `doc-specialist`, `integration-agent`,
       `system-monitor-agent`, `security-agent`, and
       `qa-verification-agent`
      - completed on `2026-03-16` for the current control-plane readiness
         surface: `/api/agents/overview` now exposes compact runtime evidence
         signals for the full Wave 1 portfolio

3. Wave 2 readiness uplift
    - stronger readiness evidence for `reddit-helper`, `content-agent`,
       `summarization-agent`, `data-extraction-agent`,
       `normalization-agent`, and `market-research-agent`
      - completed on `2026-03-16` for the current control-plane readiness
         surface: `/api/agents/overview` now exposes compact runtime evidence
         signals for the full Wave 2 portfolio

4. Wave 2 promotion-gate closure on `2026-03-16`
    - `reddit-helper`, `content-agent`, `summarization-agent`,
       `data-extraction-agent`, `normalization-agent`, and
       `market-research-agent` now satisfy their current matrix promotion gates
       with durable downstream artifacts plus focused runtime proof

5. Wave 3 readiness uplift on `2026-03-19`
   - stronger readiness evidence for `build-refactor-agent` and
      `skill-audit-agent`
     - `/api/agents/overview` now exposes compact runtime evidence signals for
        `build-refactor-agent` via `scopeContract`, `surgeryProfile`, and
        `verificationLoop`, and for `skill-audit-agent` via `trustPosture`,
        `policyHandoff`, and `telemetryHandoff`

6. Wave 3 promotion-gate closure on `2026-03-19`
   - `build-refactor-agent` and `skill-audit-agent` now satisfy their current
      matrix promotion gates with focused runtime proof plus governed
      incident/remediation linkage

7. Focused capability contract uplift on `2026-03-19`
   - `doc-specialist` now emits richer route/service/config topology, doc-level freshness signals, an entity freshness ledger, and a contradiction graph summary
   - `integration-agent` now emits dependency plans and workflow-memory snapshots while using relationship-window and workflow-pressure evidence in candidate selection
   - `system-monitor-agent` now emits sharper queue/budget fusion with dependency risk scoring and prediction confidence, plus operator-closure evidence and trend summaries
   - `security-agent` now emits regression review over permission-drift history, rollback-ready remediation counts, exploitability ranking, and remediation-closure posture
   - `qa-verification-agent` now emits explicit closure contracts and reproducibility profiles alongside surface-aware acceptance coverage
   - `reddit-helper` now makes degraded-provider posture explicit without dropping local doctrine signals
   - `build-refactor-agent` now carries bounded scope, surgery profile, repair-linked verification loop, verifier handoff metadata, impact envelopes, and refusal profiles
   - `skill-audit-agent` now carries trust posture plus policy and telemetry handoff signals, intake coverage, and restart-safety summaries

8. Delivery-flow proof closure
   - incidents, remediation runs, and run-level `workflowGraph.proofLinks`
     now share canonical proof-delivery linkage instead of leaving proof
     transport detail as an empty stub

9. Repair-loop credibility uplift
    - fewer unresolved workflow-stop signals
    - fewer critical verifier-blocked repair records
    - clearer causal stop and remediation evidence in runtime history

10. Capability-pack alignment
    - capability docs, operator-surface docs, and runtime readiness fields stay
       aligned in the same change sets

#### Exit Criteria For This Sprint Slice

Do not call Sprint 5 materially advanced unless all of the following are true:

1. active-agent capability reporting excludes template-only noise
2. Wave 1 agents show materially stronger runtime evidence in readiness outputs
   - this is now true across the current Wave 1 portfolio: `doc-specialist`,
      `integration-agent`, `system-monitor-agent`, `security-agent`, and
      `qa-verification-agent` all expose promoted runtime readiness signals in
      `/api/agents/overview`
3. Wave 2 agents show materially stronger runtime evidence in readiness outputs
   - this is now true across the current Wave 2 portfolio: `reddit-helper`,
      `content-agent`, `summarization-agent`, `data-extraction-agent`,
      `normalization-agent`, and `market-research-agent` all expose promoted
      runtime readiness signals in `/api/agents/overview`
4. Wave 3 agents show materially stronger runtime evidence in readiness outputs
   - this is now true across the current Wave 3 portfolio:
      `build-refactor-agent` and `skill-audit-agent` both expose promoted
      runtime readiness signals in `/api/agents/overview`
5. repair verification is producing closure evidence rather than mainly
    recurring backlog
6. service-mode claims match host-proven reality
7. the capability working pack stays aligned with the runtime changes that
    landed

### Sprint 6: Service Lifecycle And Host Runtime Closure

Goal: make host-installed service reality, worker and service distinctions, and
operational lifecycle management durable parts of orchestrator truth.

Status: completed on `2026-03-20`.

Concrete blockers addressed in this sprint:

1. `GET /api/agents/overview` now exposes explicit lifecycle contract truth
   with `serviceExpected`, `lifecycleMode`, `hostServiceStatus`, and
   `serviceUnitName` instead of forcing operator clients to infer persistent
   service expectations from raw booleans.
2. The operator surface and public OpenAPI contract now describe that lifecycle
   split directly, keeping worker-first lanes distinct from service-expected
   lanes.
3. Host/runtime runbooks were aligned so operators can verify lifecycle truth
   through `/api/agents/overview`, `/api/health/extended`, and direct
   `systemctl show ...` checks without relying on implied knowledge.

### Sprint 7: Downstream Delivery Proof Under Orchestrator Governance

Goal: prove milestone, demand, and Reddit delivery flows as downstream
consumers of a mature orchestrator, not as the primary driver of sequencing.

Status: completed on `2026-03-20`.

Concrete blockers addressed in this sprint:

1. Public milestone and demand proof are now treated as orchestrator-owned
   downstream surfaces, not as placeholder external ingest lanes. The
   integration suite now hits `/api/command-center/overview`,
   `/api/command-center/demand`, `/api/command-center/demand-live`,
   `/api/milestones/latest`, and `/api/milestones/dead-letter` directly
   against seeded runtime state.
2. The seeded proof harness now carries live demand queue and draft state, so
   milestone/dead-letter visibility and demand segment summaries are proven
   end to end through the public routes instead of inferred from internal
   helpers alone.
3. `reddit-response` routing and approval branches remain evidenced through the
   governed queue and approval proofs, and the provider-success
   `hybrid-polished` branch is now exercised through a bounded fixture with a
   stubbed OpenAI provider while live fallback behavior remains documented as
   an operational caveat.
4. Downstream delivery docs now reflect orchestrator-first public proof truth
   instead of describing retired external ingest endpoints as the active path.

### Sprint 8: Public Docs And Release Truth Closure

Goal: leave no stale or competing truth layers around the orchestrator and its
release-critical surfaces.

Status: completed on `2026-03-20`.

Concrete blockers addressed in this sprint:

1. `MEMORY.md`, the canonical root anchor, the main public entry docs, and the
   subproject READMEs are now aligned around `OpenClaw Operator`, the tracked
   `/operator` console, and the orchestrator-owned public proof surface.
2. Historical and completed implementation docs are more explicitly demoted:
   the completed `operator-s-console` cutover blueprint now reads as
   historical implementation evidence instead of a competing active runtime
   authority, and the docs hub/index/audit surfaces classify it that way.
3. Public onboarding and runtime examples were corrected to match the live API
   contract, including `POST /api/tasks/trigger` examples that now use the
   real `type` field rather than stale `taskType` payloads.
4. First-party Markdown link verification is now a repeatable root command
   (`npm run docs:links`) covering the main public docs and subproject
   READMEs so public-doc drift is easier to catch before release.

### Sprint 9: Exposure Expansion After Orchestrator Gates Clear

Goal: return to broader operator and public exposure only after
orchestrator-first gates are complete enough that promotion does not outrun
runtime truth.

Status: completed on `2026-03-20`.

Outcome:

1. The private operator surface is now documented as one canonical
   `/operator` / `/operator/*` console route family served from the tracked
   `operator-s-console` bundle, rather than as a lingering shell-versus-console
   split.
2. Public proof remains explicitly separated from protected operator state:
   `/operator/public-proof` is a public page path in the same bundle, backed
   only by orchestrator-owned public proof APIs.
3. Exposure policy is now aligned across the route matrix, API reference,
   public repo docs, and console docs so `Expose now`, `Observe-only`,
   `Admin-only`, and `Internal-only` claims reflect the current runtime.
4. Remaining work after Sprint 9 is maintenance and deferred coordination,
   not numbered-sprint exposure ambiguity.

## Track 3: Public GitHub Experience

### Goal

Make the repo readable to new operators without stale detours.

### Ongoing Maintenance

1. Keep `README.md`, `docs/INDEX.md`, and `docs/NAVIGATION.md` as the obvious
   public path
2. Continue demoting or clearly labeling historical snapshot docs
3. Verify first-party Markdown links regularly

## Track 4: Operational Closure

### Goal

Finish the remaining validation and release tasks around the live runtime.

### Ongoing Maintenance

1. Re-verify monitoring and security docs against the current runtime
2. Maintain zero-conflict docs for both Docker modes
3. Keep retired proof-surface history in Git, not in the active docs tree

## Track 5: Redis / Valkey Coordination Activation

### Goal

Make Redis or Valkey a real runtime dependency only when the first production
coordination slice is implemented, rather than leaving it as posture-only
configuration.

Status: completed on `2026-03-20`.

### Outcome

1. Queue execution now uses shared coordination leases so explicit-idempotency
   runs do not execute concurrently across multi-process workers.
2. Auto doc-drift repair now uses shared repair locks, deterministic repair
   ids, and shared cooldowns so the same path-set does not churn duplicate
   repairs across processes.
3. `reddit-helper` now uses shared coordination for processed-draft dedupe and
   daily LLM/token budget state instead of keeping those truths local to a
   single service-state file.
4. `/api/persistence/health` and `/api/health/extended` now expose
   coordination health so operators can see when Redis-backed coordination is
   active versus when runtime has fallen back to memory.

### Remaining Work

1. Broaden shared coordination only when a new bounded production slice
   actually needs it.
2. Keep coordination health visible and honest in docs and operator surfaces.

## Definition Of Done

1. Canonical docs and code agree on runtime behavior
2. Historical docs are clearly labeled and no longer masquerade as active truth
3. Retired proof-surface material stays out of the active docs tree and lives in Git history instead
4. Public navigation is stable and link-safe
5. Remaining open work is maintenance or future scale-out, not numbered-sprint documentation or exposure drift
