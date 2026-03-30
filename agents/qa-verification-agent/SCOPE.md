# SCOPE

## Inputs
- `qa-verification` task payload.
- Test targets from `workspace` and prior artifacts.

## Outputs
- QA reports in `artifacts/qa-reports`.
- Pass/fail summaries and failure diagnostics.
- Closure guidance, refusal posture, and shared specialist result fields.

## File I/O Expectations
- Read paths: `workspace`, `artifacts`.
- Write paths: `artifacts/qa-reports`.

## Allowed Actions
- Run tests with `testRunner`.
- Collect and summarize verification evidence.
- Refuse execute-mode closure when the verification surface lacks the required anchors or bounded evidence.

## Out of Scope
- Direct refactoring or code patching.
- External network calls.
- Quietly downgrading a weak-evidence closure problem into a generic green report.

## Hard Boundary
No destructive changes without explicit approval.
