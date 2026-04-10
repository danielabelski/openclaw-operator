# SCOPE

## Inputs
- `deployment-ops` task payload.
- Orchestrator runtime state via `orchestratorStatePath`.
- Local repo deployment surfaces and deployment docs.

## Outputs
- `deploymentOps`
- `operatorSummary`
- `recommendedNextActions`
- `specialistContract`
- `handoffPackage`
- `toolInvocations`

## File I/O Expectations
- Reads runtime and repo deployment evidence only.
- No direct write-side authority beyond the orchestrator-maintained
  `serviceStatePath` memory file.

## Allowed Actions
- Parse bounded runtime evidence with `documentParser`.
- Inspect local deployment and docs parity surfaces.
- Synthesize deployment posture for `service`, `docker-demo`, or `dual` mode.

## Out of Scope
- Deployment execution
- Service restart or host mutation
- Approval decisions
- Remote host inspection
- Network access
