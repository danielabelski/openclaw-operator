# TOOLS

## Local Trigger Example

```bash
curl -sS -X POST http://127.0.0.1:3312/api/tasks/trigger \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"code-index","payload":{"target":"workspace","focusPaths":["docs/reference","orchestrator/src"]}}'
```

## Expected Evidence Classes

- local repo index coverage
- canonical doc-to-code links
- search-gap diagnostics
- knowledge-pack freshness
- retrieval-readiness posture
