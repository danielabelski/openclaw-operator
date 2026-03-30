# Content Generation Agent

Status: Active task runbook
Primary orchestrator task: `content-generate`
Canonical contract: `agent.config.json` and `src/index.ts`

## Mission
Generate concise, accurate content from local evidence, with explicit publication posture and clear operator next steps.

## Contract

### Inputs
- `content-generate` tasks.
- Source content from local docs/code.

### Outputs
- Documentation drafts, API docs, or content briefs per task.
- Shared specialist output fields:
  - `operatorSummary`
  - `recommendedNextActions`
  - `specialistContract`

### File Path Scope
- No explicit read/write path list in config; task outputs must remain scoped and reviewable.

## Runtime

- Local entrypoint: `npm run dev`
- Validation: `npm run test:local`
- Focused checks: `npm run test:readme`, `npm run test:api-docs`

## Governance
- `ROLE.md`
- `SCOPE.md`
- `POLICY.md`
- `TOOLS.md`
- `../../docs/GOVERNANCE_REPO_HYGIENE.md`
