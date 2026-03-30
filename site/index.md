---
layout: home

hero:
  name: OpenClaw Operator
  text: Bounded, Observable, Auditable AI Operations
  tagline: Self-hosted operator control plane for real client work, with a built-in console, governed task execution, approvals, run history, incidents, and public proof separation.
  actions:
    - theme: brand
      text: Get Started
      link: /docs/start/getting-started
    - theme: alt
      text: Run Client Work
      link: /README
    - theme: alt
      text: Running Agents
      link: /docs/guides/running-agents

features:
  - title: GUI-first operator workflow
    details: Run day-to-day work from the built-in `/operator` console instead of wiring raw runtimes together by hand.
  - title: Repo-scoped execution
    details: Put target repos inside the workspace tree, point tasks at a bounded scope, and keep edits and evidence reviewable.
  - title: Governed execution
    details: Tasks are allowlisted, approval-aware, auditable, and visible through runs, incidents, and health surfaces.
  - title: Clear product boundary
    details: Private operator control plane and public proof surfaces stay separate so the runtime can be honest about what is internal and what is public.
  - title: Self-hosted deployment paths
    details: Start locally from the root workspace or deploy the full orchestrator stack with Docker Compose.
  - title: Knowledge-backed runtime
    details: Local mirrors, knowledge packs, memory recall, and runtime summaries feed downstream operator tasks and agents.
  - title: Repo-driven docs
    details: This site is generated from the canonical repo docs so GitHub docs and published docs stay aligned.
---

## Start Here

- New to the repo: [Getting Started](/docs/start/getting-started)
- Need the fastest checklist: [Quick Start](/docs/start/quickstart)
- Want to use this for client delivery: [workspace/README.md](/README)
- Need to know where outputs land: [Running Agents](/docs/guides/running-agents)
- Need concrete playbooks: [Service Recipes](/docs/guides/running-agents#service-recipes)
- Need the visual operator path: [Operator Walkthrough](/docs/guides/running-agents#operator-walkthrough)
- Running locally from the root: [workspace/QUICKSTART.md](/QUICKSTART)
- Deploying to a host or cloud VM: [workspace/DEPLOYMENT.md](/DEPLOYMENT)

## Day-One Usage Model

1. Put the target repo under `workspace/projects/<repo-name>`
2. Open `/operator/agents` to choose the lane
3. Launch work from `/operator/tasks`
4. Read the result in `/operator/runs`
5. Use `logs/` only for artifact-writing lanes such as knowledge packs or
   Reddit drafts

## Core Paths

- Product overview: [workspace/README.md](/README)
- Operator guide: [docs/OPERATOR_GUIDE.md](/docs/OPERATOR_GUIDE)
- API reference: [docs/reference/api.md](/docs/reference/api)
- Task reference: [docs/reference/task-types.md](/docs/reference/task-types)
- Configuration: [docs/guides/configuration.md](/docs/guides/configuration)
- Operator console spec: [docs/architecture/OPERATOR_CONSOLE_AUDIT_AND_SPEC.md](/docs/architecture/OPERATOR_CONSOLE_AUDIT_AND_SPEC)

## Docs Site Workflow

These published docs are derived from the repository, not maintained as a
separate source of truth.

```bash
npm run docs:site:dev
npm run docs:site:build
npm run docs:site:preview
```
