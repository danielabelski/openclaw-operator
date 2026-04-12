# SCOPE

## Inputs

- `test-intelligence` task payload
- Orchestrator runtime state via `orchestratorStatePath`
- Bounded local package manifests and test roots
- Recent retry recovery records when present

## Outputs

- `testIntelligence`
- `operatorSummary`
- `recommendedNextActions`
- `specialistContract`
- `handoffPackage`
- `toolInvocations`

## File I/O Expectations

- Reads bounded repo and runtime evidence only
- No direct write-side authority beyond the orchestrator-maintained
  `serviceStatePath` memory file

## Allowed Actions

- Parse bounded package and test roots with `documentParser`
- Inspect recent runtime task and retry evidence
- Synthesize test readiness, failure pressure, and release-facing risk

## Out of Scope

- Code edits
- Test execution
- Shell or deploy workflows
- Remote CI inspection
- Network access
