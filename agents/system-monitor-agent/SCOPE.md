# SCOPE

## Inputs
- `system-monitor` task payload.
- Logs/metrics and health signals available to the agent.

## Outputs
- Monitoring summaries, anomaly alerts, and resource usage reports.
- Prioritized operator actions, escalation watch, and shared specialist result fields.

## File I/O Expectations
- No explicit fileSystem path map in config.

## Allowed Actions
- Parse logs/metrics using `documentParser`.
- Emit observability findings and escalation signals.
- Recommend the next bounded owner or lane when runtime pressure is clearly attributable.

## Out of Scope
- Runtime code patching.
- Unapproved network operations.
- Quietly treating critical runtime degradation as background telemetry.

## Hard Boundary
No destructive changes without explicit approval.
