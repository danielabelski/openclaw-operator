# SCOPE

## Inputs

- `code-index` task payload
- Orchestrator runtime state via `orchestratorStatePath`
- Bounded local repo roots
- Latest local knowledge-pack artifact when present

## Outputs

- `codeIndex`
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

- Parse bounded repo roots with `documentParser`
- Inspect the latest local knowledge-pack artifact
- Synthesize index readiness for retrieval and linkage review

## Out of Scope

- Code edits
- Build or test execution
- Shell or deploy workflows
- Remote repo inspection
- Network access
