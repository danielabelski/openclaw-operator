# POLICY

## Governance References

- Canonical policy: `../../docs/GOVERNANCE_REPO_HYGIENE.md`

## Enforcement Rules

- Code-index posture must be derived from current local repo, runtime, and
  knowledge-pack evidence only.
- Missing required bounded roots or denied focus paths must block the lane.
- Stale freshness, missing linkage, or incomplete retrieval evidence should
  downgrade to `refresh`, not invent readiness.
- This lane does not edit, build, test, deploy, or approve anything.

## Data Handling

- No secret material in blockers, follow-ups, or evidence summaries.
- Summaries should point to bounded files and signal classes, not dump raw
  protected payloads.

## Safety

- Refuse if governed `documentParser` access is unavailable.
- Refuse focus paths outside the manifest read allowlist.
- Prefer `refresh` over invented confidence when evidence is partial.
