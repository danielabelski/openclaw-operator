# Tool Invocation Ledger

## 2026-07-17 — Queue-admission live activation

- Requested task: perform the already-approved post-window activation of the tested queue-admission and telemetry hardening.
- Workflow lane: approval-bounded OpenClaw service activation.
- Approval: “I approve all that’s next”; operation `queue-admission-live-activation-20260717`; target `orchestrator.service`; at most one restart submission.
- Tools and source:
  - coding-agent-skills plugin: `coding_migration_review`, `coding_deployment_preflight`, and `coding_api_contract_audit` (read-only; no project adapter declaration, so generic bounded scans only).
  - local project commands: `sqlite3 -readonly` with `PRAGMA query_only=ON`, `sha256sum`, focused `vitest`, TypeScript typechecks, OpenAPI generation, docs sync, operator-console tests, Vite operator UI build, `systemctl --user show`, `ss`, `curl`, and bounded `journalctl` queries.
  - approved lifecycle command: exactly one `systemctl --user restart orchestrator.service` submission.
- Dispatch classification: `dispatched`.
- Changed-state: `true` — one service lifecycle action occurred, the operator UI `dist` was rebuilt, and durable activation evidence was written. No config, concurrency, database, package, gateway, provider, or source mutation was performed by the activation workflow.
- Evidence: `artifacts/runtime/queue-admission-live-activation-20260717T014549Z.json`; governing plan: `artifacts/runtime/queue-admission-activation-plan-20260716.json`.
- Fallback reason: coding-agent-skills reported that the project adapter is absent; narrow plan-named core checks were used without Mongo, secrets, migrations, deployment, or package changes.
- Result: all required service-activation stages passed. The service has a newer activation timestamp, is active/running on loopback `3312`, both HTTP checks are 200, SQLite and Redis coordination are healthy, the live OpenAPI exposes `duplicate-suppressed` and `queueAttempts`, `/operator` serves the rebuilt assets, adjacent configuration hashes are unchanged, and no known startup failure was found.
- Remaining unverified: an authenticated live duplicate trigger was not performed because it requires credential access and would create live task state. The self-contained authenticated integration test passed.
- Next safe step: observe normal runtime behavior. Any authenticated live trigger, second restart, rollback, config/concurrency change, Mongo retirement, migration, cleanup, commit/push/release, or external action requires separate explicit authorization.

## 2026-07-17 05:27 BST — activated change set reviewed and reconciled

- Requested task: complete the recommended next move by reviewing and
  reconciling the current `openclaw-operator` changes, validating them, and
  refreshing the stale post-activation workboard.
- Workflow lane: approved local code/docs review, defect correction, generated
  contract refresh, and validation; no live activation or publication.
- Tools and source:
  - skills: `bounded-project-workspace`, `coding-audit-routing-policy`, and
    `tool-invocation-ledger-policy`;
  - coding-agent-skills plugin: `coding_repo_map`,
    `coding_validate_project`, `coding_api_contract_audit`, and
    `coding_deployment_preflight`;
  - local project commands: `git diff/status/check`, targeted file and diff
    reads, a bounded `tsx` ordering probe, OpenAPI generation, focused `vitest`,
    and the repository-managed `npm run verify` gate.
- Changed-state declaration: `true` for local source/docs/test evidence only.
  `WORKBOARD.md` now records the completed activation and current next move;
  `orchestrator/src/taskQueue.ts` now guarantees admitted enqueue telemetry is
  emitted before processing can begin; `orchestrator/test/task-queue.test.ts`
  contains the regression proof; `orchestrator/openapi.json` was regenerated
  from source; this ledger entry was added. No service, database, scheduler,
  config value, dependency, external system, or Git history was changed.
- Defect evidence: the pre-fix direct probe reproduced
  `["process","telemetry"]`, proving that `p-queue` could begin the processing
  listener before the accepted/queued telemetry listener. The queue now runs
  admitted enqueue listeners before submitting work to `p-queue`; the focused
  regression expects `["telemetry","process"]`.
- Validation evidence:
  - `git diff --check`: pass;
  - focused changed-surface suite: 8 files, 122 tests passed, including task
    admission/queue ordering, SQLite persistence, state fallback,
    coordination, business-value discovery/scheduling, and ToolGate;
  - `npm run verify`: pass — operator UI build, orchestrator TypeScript build,
    docs drift check, 83-file Markdown link check, 86 integration fixtures,
    32 live middleware integration tests, 33 operator UI tests, and both
    orchestrator/operator-console typechecks;
  - generated OpenAPI refresh completed successfully.
- Plugin limitation/fallback reason: the project has no coding-agent project
  declaration, so `coding_validate_project` failed closed and the other plugin
  audits used generic bounded discovery. Narrow local inspection and the
  repository-owned validation commands supplied the missing project-specific
  evidence without reading secrets or invoking deployment/runtime mutation.
- Review result: the local change set is internally consistent under the
  available source, contract, build, docs, integration, UI, and typecheck
  gates. The former pre-activation freeze is closed. The historical 732-run
  evidence remains preserved and the workboard no longer claims activation is
  pending.
- Next safe step: prepare/approve a Git commit packet for the complete local
  change set, or continue normal observation. A commit is not created by this
  task.
- Approval boundary: commit, push, release, deploy, service restart, live
  authenticated duplicate trigger, Mongo retirement/query, migration,
  config/concurrency change, dependency install/update, external action, and
  destructive cleanup remain separately approval-gated.
