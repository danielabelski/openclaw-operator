# TOOLS

## Local Trigger Example

```bash
curl -sS -X POST http://127.0.0.1:3312/api/tasks/trigger \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"deployment-ops","payload":{"target":"public-runtime","rolloutMode":"service"}}'
```

## Expected Evidence Classes

- local deployment surfaces
- deployment and quickstart docs parity
- latest bounded runtime evidence for monitor, security, verifier, and release
  lanes
