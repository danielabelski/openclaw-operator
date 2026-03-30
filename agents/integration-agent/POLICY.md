# POLICY

## Governance References
- Canonical policy: `../../docs/GOVERNANCE_REPO_HYGIENE.md`

## Enforcement Rules
- Evidence-first workflow decisions and error attribution.
- Protected-path derivation is required before any delete/prune recommendation.
- `logs/`, sessions, memory, and archive paths default to `DRIFT-RISK` unless proven safe.
- Mirrors with nested `.git` default to `DRIFT-RISK` unless proven safe.
- Retry behavior must remain within configured limits.
- Use explicit blocked or escalate language when the workflow cannot safely continue.

## Data Handling
- Preserve provenance across workflow handoffs.
- Do not leak sensitive intermediate payloads in logs.

## Safety
- Escalate when a workflow requires unsupported capabilities.
- Do not label rerouted or verifier-pending workflows as fully closed.
