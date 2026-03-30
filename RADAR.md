# RADAR

## Purpose

RADAR is the governance heartbeat for OpenClaw runtime discipline:
- **R**isks (what can break governance or reliability)
- **A**ssumptions (what must remain true in runtime)
- **D**ecisions (why the architecture is shaped this way)
- **A**ctions (hardening work underway)
- **R**esults (evidence from tests and operations)

Date: 2026-03-02
Owner: Runtime Governance

## Risks

1. CI can pass while runtime regressions slip if test gates are shallow.
2. Agent/task drift can happen if dispatch authority is bypassed.
3. Permission boundaries can drift if ToolGate checks are not wired to live runtime paths.
4. Operational analytics can be misleading where synthetic metrics remain in scheduler paths.
5. Future implementation agents can create drift if they flatten partial governance layers or invent competing roadmap truth.

## Assumptions

1. Orchestrator remains the only authoritative task dispatch surface.
2. Agent configs remain the source of truth for task ownership and skill allowlists.
3. Security posture checks (required env + key-rotation policy) run before bootstrap.
4. Task history semantics remain binary and explicit: `ok` on success, `error` on failure.
5. The root `OPENCLAW_CONTEXT_ANCHOR.md` remains the primary forward implementation anchor.

## Decisions

1. Enforce fail-closed startup for missing critical credentials.
2. Enforce strict task-type allowlists at queue and handler resolution boundaries.
3. Require canonical webhook signatures with timing-safe verification.
4. Use hard-cutover error semantics instead of compatibility shims.
5. Run real test suites in CI (unit-fixture suite + runtime integration suite).
6. Preserve partially wired governance and self-extension surfaces as intentional architecture, not cleanup targets.

## Actions

1. Keep ToolGate and SkillAudit documented as partial governance layers unless runtime wiring materially expands.
2. Track and retire synthetic metrics paths in memory scheduler.
3. Continue tightening spawned-agent least-privilege boundaries beyond the current env allowlist.
4. Preserve explicit documentation of break-glass paths when direct execution exceptions remain.
5. Keep the next 10 sprint sequence anchored in `OPENCLAW_CONTEXT_ANCHOR.md`, not in temporary sprint files.

## Results (Current Evidence)

1. Runtime integration suite validates auth chain and result semantics.
2. Task history records explicit `ok/error` outcomes with real failure captures.
3. Webhook verification uses canonical payload HMAC and timing-safe compare.
4. Queue ingress rejects unknown task types by allowlist.
5. `openclawdbot` no longer auto-seeds a code-known signing secret and now fails closed for bootstrap signing when the secret is missing.
6. `openclawdbot` internal mutating routes are explicitly context-gated.
7. Direct task-run bypasses are narrower because agent task entrypoints now require an orchestrator-run marker by default.
8. Spawned child agents now run with an allowlisted environment instead of inheriting the full parent env.

## Forward Ladder

1. ToolGate boundary clarification
2. SkillAudit contract repair
3. Skill registry bootstrap verification
4. Manifest permission enforcement expansion
5. Generated-skill intake path
6. Skill approval and provenance flow
7. Stronger child isolation
8. Retry durability and replay
9. Operator visibility for governance state
10. Historical-doc cleanup and anchor consolidation

## Review Cadence

- Weekly governance review for Risks/Actions.
- Per-merge updates required when decisions or assumptions change.
- Immediate update required after any production incident touching governance boundaries.
