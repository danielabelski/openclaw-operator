# Integration & Workflow Agent

Status: Active task runbook
Primary orchestrator task: `integration-workflow`
Canonical contract: `agent.config.json` and `src/index.ts`

## Mission
Own bounded workflow conduction: stage the plan, pick the healthiest allowed
lane, preserve handoff truth, and explain exactly how to recover when execution
stalls or degrades.

## Contract

### Inputs
- `integration-workflow` tasks and workflow definitions
- orchestrator runtime state for incidents, workflow events, and relationship observations

### Outputs
- Workflow completion status, normalized intermediates, and failure context
- recovery plan with:
  - priority incidents
  - workflow watch summary
  - verifier handoff recommendation
  - relationship windows for participating agents
- shared specialist result contract:
  - `operatorSummary`
  - `recommendedNextActions`
  - `specialistContract`

### File Path Scope
- Reads: orchestrator runtime state via `orchestratorStatePath`
- Writes: task-scoped JSON result only

## Runtime

Runtime invocation is handled by orchestrator dispatch and optional managed
service wiring. The executable contract lives in `src/index.ts`.

## Operation Flow
1. Translate the request into a bounded staged workflow instead of freeform orchestration.
2. Score allowed agent candidates against task-path proof, service posture, and incident pressure.
3. Execute each step with explicit stop-cause, reroute, replay, and handoff capture.
4. Produce operator-ready recovery guidance and verifier handoff context when the workflow cannot close cleanly.

## Governance
- `ROLE.md`
- `SCOPE.md`
- `POLICY.md`
- `TOOLS.md`
- `../../docs/GOVERNANCE_REPO_HYGIENE.md`
