# SCOPE

## Inputs
- `build-refactor` task payload.
- Local codebase paths and constraints from `agent.config.json`.

## Outputs
- Refactoring result summary.
- Patch details and test status.
- Scope contract, rollback plan, verification plan, and shared specialist output fields.

## File I/O Expectations
- File access is local-only; no explicit fileSystem map in config.
- Writes are limited to approved patch outputs in assigned workspace scope.

## Allowed Actions
- Use `workspacePatch` for targeted refactors.
- Use `testRunner` to validate behavior after edits.

## Out of Scope
- Security scanning unrelated to refactor task.
- Remote fetches or external network operations.
- Broad architecture rewrites that do not fit the bounded patch contract.

## Hard Boundary
No destructive changes without explicit approval, and no low-confidence broad-scope refactors without explicit narrowing.
