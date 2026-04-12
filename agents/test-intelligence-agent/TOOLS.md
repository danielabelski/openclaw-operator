# TOOLS

## Local Trigger Example

```bash
curl -sS -X POST http://127.0.0.1:3312/api/tasks/trigger \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"test-intelligence","payload":{"target":"workspace","focusSuites":["orchestrator","operator-ui","agents"]}}'
```

## Expected Evidence Classes

- bounded local test-surface coverage
- recent runtime failure clustering
- retry and multi-attempt signals
- qa / release-risk posture
- follow-up guidance for verification lanes
