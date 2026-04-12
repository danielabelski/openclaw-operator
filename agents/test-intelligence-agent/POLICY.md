# POLICY

## Governance References

- Canonical policy: `../../docs/GOVERNANCE_REPO_HYGIENE.md`

## Enforcement Rules

- Test-intelligence posture must be derived from current local repo and runtime
  evidence only.
- Missing bounded test surfaces or unsupported focus suites must stay visible
  in the result.
- Thin coverage, recent failures, retry noise, or weak verifier posture should
  downgrade to `watching`, not invent readiness.
- This lane does not edit, build, test, deploy, or approve anything.

## Data Handling

- No secret material in blockers, follow-ups, or evidence summaries.
- Summaries should point to bounded files and signal classes, not dump raw
  protected payloads.

## Safety

- Refuse if governed `documentParser` access is unavailable.
- Prefer `watching` over invented confidence when evidence is partial.
- Escalate only when bounded surfaces are missing or blocked outright.
