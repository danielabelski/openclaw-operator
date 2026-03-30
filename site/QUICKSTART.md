# OpenClaw Operator — Quick Start

This is the fastest way to get the repo running as a self-hosted operator
workspace. The recommended first run is the root local-dev path, which starts
the orchestrator and serves the canonical operator console at `/operator`.

## Two Deployment Paths

### Path A: Recommended First Run (Root Local Dev)

```bash
cd workspace
npm install
cp orchestrator/.env.example orchestrator/.env
# fill in the required vars in orchestrator/.env
npm run dev
```

Open `http://127.0.0.1:3000/operator`.

Config: `workspace/orchestrator_config.json` (repo-relative paths for local dev)

**Systemd service**: `workspace/systemd/orchestrator.service`

---

### Path B: Docker Compose (full stack)

Brings up orchestrator + MongoDB + Redis + Prometheus.

```bash
cd workspace/orchestrator
cp .env.example .env   # if not already done
# fill in all required vars (see below)
docker-compose up -d
```

Config: `workspace/orchestrator/orchestrator_config.json` (container resolves
workspace paths under `/workspace/*`)

### Path C: Docker Compose (minimal container only)

Use this when you already have dependency targets provisioned outside the
container stack and want the orchestrator container plus `/operator` only.

```bash
cd workspace
cp orchestrator/.env.example orchestrator/.env
docker-compose -f docker-compose.yml up -d --build
```

This path is proven in the current workspace, but it does not launch MongoDB,
Redis, Prometheus, or Grafana for you.

---

## Environment Variables

All vars live in `workspace/orchestrator/.env`.

| Variable | Required | Notes |
|---|---|---|
| `API_KEY_ROTATION` or `API_KEY` | ✅ | Bearer auth for protected operator APIs |
| `WEBHOOK_SECRET` | ✅ | Security posture check — orchestrator refuses to start without it |
| `MONGO_USERNAME` | ✅ (Docker) | MongoDB auth |
| `MONGO_PASSWORD` | ✅ (Docker) | MongoDB auth |
| `REDIS_PASSWORD` | ✅ (Docker) | Redis auth |
| `DATABASE_URL` | ✅ | Full MongoDB connection URL |
| `REDIS_URL` | ✅ | Full Redis connection URL |
| `OPENAI_API_KEY` | Usually | Needed for the common agent mix |
| `ANTHROPIC_API_KEY` | Optional | Needed only for Anthropic-backed paths you enable |
| `SLACK_ERROR_WEBHOOK` | Optional | Alert delivery to Slack |

---

## Verify OpenClaw Operator Is Running

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/knowledge/summary
```

Then open `http://127.0.0.1:3000/operator` and confirm the console loads.

---

## Scheduled Tasks (in-process)

| Schedule | Task | What |
|---|---|---|
| `0 23 * * *` (11pm UTC) | `nightly-batch` | Collect leads, mark high-confidence, create digest |
| `0 6 * * *` (6am UTC) | `send-digest` | Send digest notification |
| Every 5 min | `heartbeat` | Health check |

---

## Public Proof Surface

The public proof routes are now served directly by the orchestrator. No
separate proof app or ingest pipeline is required for the active local runtime.

Public read-only surfaces:

- `GET /api/command-center/overview`
- `GET /api/command-center/control`
- `GET /api/command-center/demand`
- `GET /api/command-center/demand-live`
- `GET /api/milestones/latest`
- `GET /api/milestones/dead-letter`

---

## Troubleshooting

**Operator won't start** — missing `API_KEY_ROTATION` or `API_KEY`, or `WEBHOOK_SECRET` in `.env`.

**Public proof looks stale** — check `/api/milestones/latest`, `/api/milestones/dead-letter`, and `/api/command-center/overview` before assuming a queue or UI problem.

**Slack alerts not arriving** — verify `SLACK_ERROR_WEBHOOK` is set and test with:
```bash
curl -X POST "$SLACK_ERROR_WEBHOOK" -d '{"text":"test"}'
```

---

## Deployment Checklist

- [ ] `.env` created with all required vars
- [ ] `npm install` run in `workspace/` (root `postinstall` installs orchestrator and operator console deps)
- [ ] `npm run dev` rebuilds the operator console bundle and starts the orchestrator from `workspace/`
- [ ] `http://127.0.0.1:3000/operator` loads the canonical operator console
- [ ] `/operator` loads the built operator console instead of a fixture bundle
- [ ] Public proof routes respond from the orchestrator: `/api/milestones/latest` and `/api/command-center/overview`

## Root Command Hub

The root `workspace/package.json` is now the default command hub for the active
control plane:

```bash
cd workspace
npm run build
npm run typecheck
npm run test
npm run test:unit
npm run test:integration
npm run docs:drift
npm run docs:links
npm run clean:dry-run
```

`npm run clean` is intentionally conservative: it removes cache, coverage, and
TypeScript build-info artifacts only. Frontend `dist/` cleanup is opt-in via
`npm run clean:builds`.
