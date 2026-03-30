# Market & Web Research Agent

Status: Active task runbook
Primary orchestrator task: `market-research`
Canonical contract: `agent.config.json` and `src/index.ts`

## Mission
Collect allowlisted market signals and turn them into change-classified research briefs with explicit degraded-actionable guidance.

## Contract

### Inputs
- `market-research` tasks.
- Allowlisted target URLs and prompts.

### Outputs
- Research summaries, source plans, and extracted evidence in `artifacts/research`.
- Shared specialist output fields:
  - `operatorSummary`
  - `recommendedNextActions`
  - `specialistContract`

### File Path Scope
- Reads: `workspace/research`
- Writes: `artifacts/research`

## Runtime

- Local entrypoint: `npm start`
- Alternate development loop: `npm run dev`
- Current test surface: `npm test` (placeholder until richer tests are added)

## Governance
- `ROLE.md`
- `SCOPE.md`
- `POLICY.md`
- `TOOLS.md`
- `../../docs/GOVERNANCE_REPO_HYGIENE.md`
