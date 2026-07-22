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

## 2026-07-22 — retained-host portability and machine-migration audit

- Requested task: inventory the complete live OpenClaw setup, reconcile source
  control and installed/source divergence, design protected runtime/credential
  handoff, add a reproducible bootstrap check, and push only proven safe source.
- Workflow lane: source-control portability, runtime architecture audit,
  secret-safe documentation, and bounded GitHub handoff.
- Tools and source:
  - skills: `coding-audit-routing-policy`, `bounded-project-workspace`,
    `tool-invocation-ledger-policy`, and the GitHub CLI workflow;
  - coding-agent-skills: repository mapping, environment audit, secret audit,
    validation-pack checks, and GitHub handoff evidence;
  - core read-only inspection: Git status/remotes/reachability, GitHub metadata,
    `/proc` ownership, systemd unit metadata, socket/process/cgroup facts,
    package manifests, file names, ignore rules, SQLite file inventory, Docker
    inspect metadata, hashes, and narrow source comparisons;
  - local source changes: this manifest/export plan/bootstrap check, two exact
    OpenClaw patch artifacts, documentation navigation, deployment pin, and
    workboard/ledger updates.
- Changed-state declaration: `true` for source-controlled documentation,
  bootstrap, patch preservation, doc-specialist source reconciliation, and the
  approved coherent Git operations. The existing `coding-agent-skills` commit
  `0d899bca` was pushed to its verified public `main` remote. This audit's two
  isolated operator commits remain local: the push to the verified public
  `AyobamiH/openclaw-operator` `main` remote was rejected with HTTP 403 because
  the active `OneClickPostFactory` identity lacks write permission. No remote
  operator state changed. No service restart, package install/update,
  scheduler/config/plugin mutation, runtime export, database write, Docker
  change, social write, or Cloudinary write occurred.
- Evidence/result:
  - the active Gateway, orchestrator, Redis, specialist, evidence, tunnel, and
    local-model paths were mapped to their executable, working tree, startup
    owner, ports, state source, and protected input category;
  - exact active source is not fully on GitHub: the dirty root operations
    workspace, dirty social-agent tree, active local-only public-decision
    service, locally changed evidence console, and unpinned personal media skill
    trees remain blockers;
  - the running native-hook stabilization change and the unactivated Codex
    direct-tool change were separated into patches and reverse-apply checks
    prove they exactly represent the audited OpenClaw working tree;
  - the exact doc-specialist retention source used by the active specialist
    service was reconciled into the operator repo; its two focused tests and a
    focused TypeScript check pass;
  - protected SQLite/Redis/social/browser/credential state has an explicit
    consistency and secret-separation plan; no sensitive archive was created.
- Validation evidence:
  - focused doc-specialist retention tests: 2 passed; focused TypeScript check:
    passed;
  - `git diff --check`, shell syntax, both OpenClaw patch reverse-apply checks,
    docs drift, and the 85-file Markdown link check: passed;
  - the bootstrap check behaved fail-closed with the five documented source
    blockers and returned the expected non-zero status;
  - repository `verify:main`: passed — operator UI and orchestrator builds,
    docs checks, 86 unit fixtures, 32 live middleware integration tests, 33 UI
    tests, both typechecks, docs-site curation, and VitePress build;
  - coding secret audit completed with no reported risks in this change set;
    the GitHub handoff audit correctly reports remote divergence.
- Secret posture: file names, schemas, ignore rules, loaders, and references
  were inspected without printing values. Coding secret audits found no risk in
  the new custom plugin/skill source and no repository-native leak scanner was
  installed. Generic audit adapters were incomplete or failed closed on some
  large trees, so narrow name-only and Git-index checks were used as fallback.
- Fallback reason: coding-agent-skills has no project adapter for the root or
  operator repository, the root environment audit hit permission boundaries,
  and two generic secret-audit responses were not parseable. Core inspection
  was limited to non-secret paths, key names, Git metadata, and repository-owned
  validation; no `.env` or credential value was opened.
- Next safe step: resolve each named source blocker as its own coherent commit
  and rerun the bootstrap check. The operator commits require either an
  explicitly approved GitHub identity switch to the configured `AyobamiH`
  account or a separately chosen fork/PR handoff. Creating the sensitive
  export, changing GitHub identity/remotes, rewriting history, stopping
  services, or provisioning secrets remains separately approval-gated.
