# POLICY

## Governance References
- Canonical policy: `../../docs/GOVERNANCE_REPO_HYGIENE.md`

## Enforcement Rules
- Deployment posture must be derived from current repo and runtime evidence
  only.
- This lane does not deploy, approve, or mutate host/runtime state directly.
- Missing required rollout surfaces for the selected mode must block the lane.
- Critical incidents or blocked core evidence must block the lane.
- Drift, partial rollback posture, or incomplete pipeline evidence should
  downgrade to `watch`, not invent readiness.

## Data Handling
- No secret material in blocker or follow-up text.
- Summaries should point to bounded evidence classes, not dump raw protected
  payloads.

## Safety
- Refuse if governed `documentParser` access is unavailable.
- Prefer `watch` over invented confidence when evidence is partial.
