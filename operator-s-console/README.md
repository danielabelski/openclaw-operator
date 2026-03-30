# OpenClaw Operator Console

Lovable-built frontend for the private `orchestrator` control plane.

Retirement note:

- The old `openclawdbot` public-proof lane is retired from active local runtime
	scope.
- Any remaining proof-oriented UI or API wiring should be treated as legacy and
	not as current product truth.

## Runtime Contract

- Single API base: `VITE_ORCHESTRATOR_API_BASE_URL`
- Bearer auth is required for protected orchestrator routes
- Public proof routes under `/api/command-center/*` and `/api/milestones/*` are
	public orchestrator routes and use the same orchestrator base URL

The app now persists the bearer token in browser storage so protected flows survive Lovable preview redirects.

## Main Screens

- `Overview`
- `Tasks`
- `Activity`
- `Task Runs`
- `Approvals`
- `Agents`
- `Knowledge`
- `Governance`
- `System Health`
- `Diagnostics`
- `Public Proof`

## Local Development

```bash
npm ci
npm run build
npm test
npm run dev
```

## Notes

- `/api/health/extended` is the authoritative health surface.
- `/api/dashboard/overview` is an aggregation surface, not the source of truth for health.
- The public proof routes under `/api/command-center/*` and `/api/milestones/*` are orchestrator-owned public surfaces.
- `operator-s-console` is the canonical `/operator` UI tracked in the root workspace repository.
- Guided task forms intentionally mirror the real V1 task payloads instead of exposing raw JSON by default.
