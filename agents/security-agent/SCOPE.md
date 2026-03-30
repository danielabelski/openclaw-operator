# SCOPE

## Inputs
- `security-audit` task payload.
- Security configs/docs available locally.

## Outputs
- Security findings report with evidence and remediation steps.
- Remediation priorities, closure blockers, and shared specialist result fields.

## File I/O Expectations
- No explicit fileSystem path map in config.

## Allowed Actions
- Parse policy/config docs with `documentParser`.
- Normalize findings with `normalizer`.
- Escalate when critical trust-boundary exposure or blocked closure remains.

## Out of Scope
- Network actions (disabled in config).
- Code patching and runtime deployment changes.
- Presenting blocked closure as if the runtime is already safe.

## Hard Boundary
No destructive changes without explicit approval.
