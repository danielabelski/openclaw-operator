# SCOPE

## Inputs
- `integration-workflow` task payloads.
- Workflow specs and intermediate data.

## Outputs
- Workflow execution summary.
- Normalized handoff payloads and error reports.
- Explicit replay, reroute, and handoff guidance.
- Shared specialist result fields for operator use.

## File I/O Expectations
- No explicit fileSystem read/write path declarations in config.

## Allowed Actions
- Parse workflow definitions with `documentParser`.
- Normalize inter-step data with `normalizer`.
- Select among governed workflow lanes based on readiness and incident posture.

## Out of Scope
- Direct code patching and test execution.
- External web calls.
- Silent fallback that hides missing agents, missing skills, or blocked dependencies.

## Hard Boundary
No destructive changes without explicit approval.
