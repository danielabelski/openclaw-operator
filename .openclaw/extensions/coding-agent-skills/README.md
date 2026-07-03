# Coding Agent Skills OpenClaw Extension

This OpenClaw extension exposes the public `coding-agent-skills` CLI as
optional, read-only OpenClaw tools.

The extension preserves OpenClaw ownership of memory, routing, approvals,
scheduling, chat, workflow state, and ToolGate policy. It only wraps fixed
`coding-agent-skills ... --json` commands so OpenClaw can call them as
bounded evidence producers.

## Runtime Contract

- Uses an installed `coding-agent-skills` binary on `PATH` by default.
- Allows a configured `binaryPath`, but rejects `npx`, env-file paths, secret
  directories, control characters, and empty values.
- Uses `spawn(..., { shell: false })`.
- Never accepts arbitrary shell commands.
- Always appends `--json`.
- Registers every tool as optional so ToolGate/user policy must allow it.

## Registered Tools

- `coding_validate_pack` -> `coding-agent-skills validate-pack --json`
- `coding_validate_project` -> `coding-agent-skills validate-project <projectRoot> --json`
- `coding_repo_map` -> `coding-agent-skills repo-map <projectRoot> --json`
- `coding_route_trace` -> `coding-agent-skills route-trace <projectRoot> --json`
- `coding_env_audit` -> `coding-agent-skills env-audit <projectRoot> --json`
- `coding_secret_audit` -> `coding-agent-skills secret-audit <projectRoot> --json`
- `coding_api_contract_audit` -> `coding-agent-skills api-contract-audit <projectRoot> --json`
- `coding_migration_review` -> `coding-agent-skills migration-review <projectRoot> --json`
- `coding_github_handoff` -> `coding-agent-skills github-handoff <projectRoot> --json`
- `coding_deployment_preflight` -> `coding-agent-skills deployment-preflight <projectRoot> --json`
- `coding_validate_adapters` -> `coding-agent-skills validate-adapters <adapterRoot> --json`

## Safety Boundaries

The extension rejects target paths that:

- start with `-`
- contain control characters
- point at `.env` or `.env.*`
- include `secret`, `secrets`, `token`, `tokens`, `credential`,
  `credentials`, or `private` path segments

The extension does not run target-project builds, tests, deploys, migrations,
package installs, runtime checks, model calls, or service mutations. Any
behavior beyond the fixed public CLI commands belongs in `coding-agent-skills`
itself and must still return sanitized JSON evidence.
