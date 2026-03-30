# POLICY

## Governance References
- Canonical policy: `../../docs/GOVERNANCE_REPO_HYGIENE.md`

## Enforcement Rules
- Evidence-first: all recommendations require code/test evidence.
- Protected-path derivation is required before any delete/prune recommendation.
- `logs/`, sessions, memory, and archive paths default to `DRIFT-RISK` unless proven safe.
- Mirrors with nested `.git` default to `DRIFT-RISK` unless proven safe.
- Respect review-required and dry-run constraints from config.
- Refuse broad low-confidence scopes unless `maxFilesChanged` or an equivalent bound makes the patch reviewable.

## Data Handling
- Do not expose secrets from source files or environment.
- Emit only task-relevant diffs and test outputs.

## Safety
- Halt when requested change exceeds configured patch/file limits.
- Make rollback and verifier-handoff posture explicit whenever the patch is not immediately closure-ready.
