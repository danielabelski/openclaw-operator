---
title: "Quick Start"
summary: "Minimal root-first checklist to boot OpenClaw Operator."
---

# Quick Start Checklist

Use this page when you want the shortest repo-truth path from clone to a
working `/operator` console.

## Local Root Path

```bash
# 1. Clone
git clone https://github.com/AyobamiH/openclaw-operator.git
cd openclaw-operator

# 2. Install workspace dependencies
npm install

# 3. Create backend env file
cp orchestrator/.env.example orchestrator/.env

# 4. Fill in orchestrator/.env
# - API_KEY_ROTATION or API_KEY
# - WEBHOOK_SECRET
# - DATABASE_URL
# - REDIS_URL
# - OPENAI_API_KEY (usually)

# 5. Start the product
npm run dev
```

Open:

- `http://127.0.0.1:3000/operator`

## Fast Verification

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/knowledge/summary
```

Then authenticate in `/operator` with your bearer token.

## Docker Shortcut

If you want the self-contained container stack instead:

```bash
cd orchestrator
cp .env.example .env
docker compose up -d --build
```

That path uses `orchestrator/orchestrator_config.json` and serves the same
operator console at `/operator`.

## Important Notes

- `orchestrator_config.json` at the repo root is the local runtime source of
  truth and now resolves relative path fields from the config file location.
- `orchestrator/orchestrator_config.json` is the container-shaped config for
  Docker-based deployment.
- Root commands are the default command hub for this repo.

## Next

- [Getting Started](./getting-started.md)
- [Architecture Overview](./architecture-overview.md)
- [Configuration](../guides/configuration.md)
