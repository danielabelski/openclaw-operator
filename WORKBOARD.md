# WORKBOARD

This is the first-read operational tracker for the public `openclaw-operator`
repo.

It is not the canonical runtime spec and it must not compete with code truth,
the canonical anchor, or the architecture/reference docs.

Use it for one thing:

- land quickly on what is done
- what is in flight
- what is next
- what is intentionally parked

Last updated: `2026-04-09`

## Current Headline

The public repo is in a shippable state.

- current public `main` includes the capability-closure and legacy-failure fix
  through commit `c857273`
- protected-branch shipping now has a repo-managed verification contract:
  local pre-push gate plus CI-aligned publish gating
- the Wave 4 readiness integration test is now hardened against cached stale
  snapshots, not just early reads
- current portfolio productization is mostly done for the shipped operator
  product
- the first broader external-catalog growth slice is now built in repo code as
  the bounded `deployment-ops` lane
- an uncommitted governance spike was reviewed against current code truth and
  intentionally dropped instead of being carried forward as local drift

## Recently Finished

1. Public onboarding path was hardened.
   - local-first dev now boots without requiring Mongo/Redis first
   - docs and docs site were aligned to that path

2. Docs-site publication was curated.
   - only allowlisted public docs now publish to GitHub Pages
   - stale/internal docs stopped leaking into the public docs site

3. Current agent portfolio capability closure landed.
   - all declared non-template public agents now have bounded runtime evidence,
     truthful operator exposure, and closed capability gaps for the current
     runtime slice

4. Legacy spawned-agent failure handling was fixed.
   - structured worker results are now preserved even when the child exits
     non-zero after writing a result file
   - this closed the last Wave 4 integration regression and kept run-detail
     summaries truthful

5. Protected-branch verification was tightened.
   - pushes to `main` / `master` now run a repo-managed pre-push `verify:main`
     gate locally
   - GitHub validation now runs the same protected-branch contract
   - deploy and docs workflows now wait for validation success instead of
     racing it

6. An uncommitted governance spike was intentionally dropped.
   - retained ideas only: dynamic task validation, auth-grace config, route
     inventory, and manifest-boundary concepts
   - dropped implementation because it duplicated the shipped
     `/api/companion/*` surface, targeted stale runtime types/helpers, and
     shipped a self-invalidating route-governance registry
   - future governance work should restart from current `main`, not from the
     discarded local spike

7. The Wave 4 runtime-readiness test was hardened again.
   - the first fix closed early-read races but still left the suite vulnerable
     to cached reads, stale local agent service-state memory, and critical
     incident bleed from earlier failure tests
   - the current test now isolates Wave 4 behind a seeded runtime reset,
     disables retry noise for intentional failure cases, and requires current
     run/task ids when checking promoted runtime evidence
   - assistant workflow guidance now explicitly requires cache-aware real
     completion conditions and isolation from ambient host artifacts for
     integration tests

8. The first new-agent adoption contract is now implemented in repo code.
   - `deployment-ops-agent` now exists as a worker-first, read-only
     deployment posture lane rather than a deploy executor
   - the public runtime, operator UI, task catalog, run-detail deck, and
     integration proof now all include `deployment-ops`
   - the lane sits between `release-readiness` and the approval-gated
     `agent-deploy` mutator without absorbing deploy authority

## Current Recommended Next Move

Close the first bounded external-catalog adoption slice with live runtime proof:

- `DevOps Automator -> deployment-ops-agent`

The build slice is now landed in repo code. The next closure step should prove
the lane on the live runtime and refresh capability evidence from the running
operator surface rather than only from tests.

Current implementation target:

1. run a focused `deployment-ops` canary on the live runtime
2. confirm `/api/agents/overview` and `/operator/agents` promote
   `deploymentOps` runtime evidence for the new worker
3. refresh docs/workboard wording only if the live capability posture differs
   from the current contract
4. only then decide whether to move to the next external-catalog candidate

Do not start by bulk-researching many candidates or importing external repo
structure wholesale.

## Intentionally Parked

These are real work items, but they are not the immediate next build slice.

1. Broader external-catalog agent growth beyond the first candidate.
   - one candidate at a time only

2. Further usage-refinement polish.
   - better queue-style triage surfaces
   - more ledger-level next-action and freshness guidance

3. Coordination scale-out beyond the current bounded Redis / Valkey slice.

4. Ongoing docs-truth maintenance and navigation hygiene.

5. Host-specific lifecycle expansion for additional resident services.
   - only if a host genuinely needs them

6. Optional maintenance-visibility follow-up from retired branch archaeology.
   - the old `feat/heartbeat-maintenance-cutover` branch was not kept as a
     merge target
   - if revisited, re-implement only from current `main`
   - preserve these ideas, not the branch shape:
     - maintenance cadence records behind the internal heartbeat scheduler
     - operator overview maintenance card
     - optional diagnostic toggle for internal maintenance runs
   - do not merge the old branch wholesale because later runtime, onboarding,
     capability, and docs-site work already superseded most of it

## Hard Rules

1. Do not treat prose from external role catalogs as shipped capability.
2. Do not bulk-import external agents.
3. Do not widen tool or network boundaries just to make a new agent possible.
4. Productize one bounded agent at a time with:
   - lane
   - governed access
   - operator evidence
   - tests
   - docs

## Source Files To Trust Next

If deeper context is needed, read in this order:

1. Canonical anchor: [`../../../OPENCLAW_CONTEXT_ANCHOR.md`](../../../OPENCLAW_CONTEXT_ANCHOR.md)
2. [docs/architecture/AGENT_ADAPTATION_PLAN.md](./docs/architecture/AGENT_ADAPTATION_PLAN.md)
3. [docs/operations/SPRINT_TO_COMPLETION.md](./docs/operations/SPRINT_TO_COMPLETION.md)
4. [docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md](./docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md)
