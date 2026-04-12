# Test Intelligence Agent

## Status

- Declared runtime agent
- Spawned-worker owner for `test-intelligence`
- Public operator surface only; no network access

## Primary Orchestrator Task

- `test-intelligence`

## Mission

Turn current repo test surfaces and recent runtime execution evidence into one
bounded test-intelligence posture that tells operators whether coverage,
failure pressure, retry signals, and release-facing test risk are ready,
watching, or blocked.

## Contract

This agent should return:

- `operatorSummary`
- `recommendedNextActions`
- `specialistContract`
- `testIntelligence`
- `handoffPackage`
- `toolInvocations`

The posture must stay read-only, machine-readable, and honest about thin test
coverage, retry noise, stale verification evidence, or blocked release risk.

## Runtime

- Reads orchestrator runtime state only
- Reads bounded local package manifests and test roots
- Never edits code, runs tests, or executes shell workflows

## Governance

- Least privilege: `documentParser` only
- Read-only file boundaries
- No network access
- No code edits, shell execution, or approval bypass authority
