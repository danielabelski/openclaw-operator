# Assistant Workflow

This file defines the permanent collaboration workflow for AI coding assistants
working in the public `openclaw-operator` repo.

Use it to keep Codex, Copilot, and any future assistant aligned on:

- what to read first
- where current state lives
- what must be updated before commit/push

It is a workflow contract, not a runtime spec.

Last updated: `2026-04-06`

## First-Read Order

When starting work in this repo:

1. Read [WORKBOARD.md](./WORKBOARD.md).
2. Read [README.md](./README.md) for product/repo orientation.
3. If the task touches runtime behavior, operator surfaces, agent capability,
   task exposure, governance, proof delivery, or API contracts, then also read:
   - [docs/INDEX.md](./docs/INDEX.md)
   - [docs/reference/api.md](./docs/reference/api.md)
   - [docs/reference/task-types.md](./docs/reference/task-types.md)
   - [docs/architecture/AGENT_CAPABILITY_MODEL.md](./docs/architecture/AGENT_CAPABILITY_MODEL.md)
   - [docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md](./docs/architecture/AGENT_CAPABILITY_IMPLEMENTATION_MATRIX.md)
   - [docs/architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX.md](./docs/architecture/OPERATOR_SURFACE_CAPABILITY_MATRIX.md)

## Source-Of-Truth Split

Keep these roles separate:

- `WORKBOARD.md`
  - current direction
  - recently finished work
  - next recommended slice
  - intentionally parked work

- `ASSISTANT_WORKFLOW.md`
  - how assistants should operate in this repo
  - what must be updated when shipping material changes

- code, tests, and machine-readable config
  - final implementation truth

- canonical anchor outside the repo:
  - `/home/oneclickwebsitedesignfactory/.openclaw/OPENCLAW_CONTEXT_ANCHOR.md`

Do not turn `WORKBOARD.md` into a second architecture spec.

## Commit And Push Update Rule

Before committing or pushing a material change, update the assistant-facing
files if the change alters current direction, shipped truth, or the next slice.

Minimum check:

1. Does `WORKBOARD.md` still describe:
   - what was just finished
   - what is next
   - what is intentionally parked
2. Do assistant entry points still point to the right first-read files?
   - `AGENTS.md`
   - `.github/copilot-instructions.md`
   - `.github/code-instructions.md`
3. If workflow expectations changed, update this file too.

If the answer to any of those is "no", fix the docs in the same change set.

## Hard Rules

1. Do not leave Codex and Copilot on different starting assumptions.
2. Do not keep stale assistant instructions after a repo-direction change.
3. Do not document private-lab assumptions as public repo truth.
4. Do not claim progress in `WORKBOARD.md` that the code/tests do not support.

## Preferred Pattern

For material work:

1. implement the code
2. verify it
3. update `WORKBOARD.md`
4. update assistant entry points if needed
5. commit and push

That keeps assistant guidance synchronized with shipped repo state.

