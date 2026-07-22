---
title: "OpenClaw Machine Migration Manifest"
summary: "Pinned source, runtime, service, and verification contract for reproducing the retained host without committing secrets or private state."
---

# OpenClaw Machine Migration Manifest

Status: **partially ready** as of 2026-07-22. This document is a source-of-truth
inventory, not a statement that every active local component is already on GitHub.

## Target architecture

```text
Telegram and other channel clients
  -> OpenClaw Gateway :18789
       -> globally installed OpenClaw 2026.7.1
       -> installed @openclaw/codex 2026.7.1
       -> workspace plugins and skills
       -> local browser relay/tunnel :20241/:20242
       -> orchestrator bridge -> OpenClaw Operator :3312
                               -> metrics :9100
                               -> SQLite persistence
                               -> Redis coordination :6379
  -> specialist user services
       -> doc-specialist
       -> reddit-helper

system boot
  -> docker.service
  -> openclaw-redis.service
       -> docker run redis:7-alpine
       -> 127.0.0.1:6379

system service
  -> evidence-explorer :4174
  -> public-decision-intelligence :41051
```

The Gateway is the primary front door. `openclaw-operator` remains the
specialist orchestrator sidecar. The operator console is built and served by
the orchestrator; it is not a second control plane.

## Host assumptions and pinned toolchain

| Item | Retained host / migration pin |
|---|---|
| OS | Ubuntu 24.04 LTS or compatible Linux with systemd user services |
| Current host layer | WSL2; a native Linux host is also acceptable after service-path verification |
| Node.js | 24.18.0 |
| npm | 11.16.0 on the retained host |
| Corepack | 0.35.0 on the retained host |
| pnpm | 11.2.2, pinned by the OpenClaw package manifest |
| OpenClaw | 2026.7.1 |
| Git | 2.43 or newer |
| Docker | 29.x; required for current Redis parity |
| SQLite | 3.45 or newer, with `.backup` support |
| jq | 1.7 or newer |

System packages required by the documented path include Git, curl, jq,
SQLite, build essentials, Docker Engine, and systemd. Docker Compose is not
required by the retained host's Redis path, although the public demo remains
supported by the repository Compose files.

## Source repositories

| Component | Clone target | Remote | Pin | Active relationship | Portability |
|---|---|---|---|---|---|
| OpenClaw Operator | `${OPENCLAW_WORKSPACE}/projects/openclaw-operator` | `https://github.com/AyobamiH/openclaw-operator.git` | `main@969bc2b84d94` plus the migration commits that contain this manifest | active orchestrator, operator UI, bridge source, specialist source, service templates | source-controlled |
| OpenClaw | `${OPENCLAW_WORKSPACE}/projects/openclaw` | `https://github.com/openclaw/openclaw.git` | tag `v2026.7.1`, commit `2d2ddc43` | source base for the running 2026.7.1 package | upstream base plus two separately preserved patches |
| coding-agent-skills | `${OPENCLAW_WORKSPACE}/projects/coding-agent-skills` | `https://github.com/OneClickPostFactory/coding-agent-skills.git` | `main@0d899bca` | source for the active coding evidence plugin | source-controlled and pushed |
| social-agent | `${OPENCLAW_WORKSPACE}/projects/social-agent` | `https://github.com/OneClickPostFactory/social-agents.git` | remote base `6f687a077cfc`; local tree differs | social connector and platform implementation | **blocked by uncommitted local source** |
| social-pulse | `${OPENCLAW_WORKSPACE}/projects/social-pulse` | private `OneClickPostFactory/oneclickpostfactory` | `d97cd431` | optional/private social UI and credential surface | source-controlled; credentials remain separate |
| evidence explorer | `${OPENCLAW_WORKSPACE}/projects/evidence-explorer` | `AyobamiH/evidence-explorer` | local/remote base `44137a` | source base for active evidence UI | remote is not readable with the current GitHub identity; active console has local changes |
| root operations workspace | `${OPENCLAW_WORKSPACE}` | `AyobamiH/openclaw-ops` | local `master@511e361`, three commits ahead | active custom plugins, custom skills, doc/reddit services, memory guard and operations evidence | **remote inaccessible and heavily dirty** |
| public decision intelligence | currently `${OPENCLAW_WORKSPACE}/incubation/public-decision-intelligence` | no proved remote | local-only source | active system service | **blocked: active source is untracked and has no authoritative GitHub repo** |
| personal HyperFrames/media skills | `~/.agents/skills` (duplicated under `~/.claude/skills`) | no proved remote or pinned installer metadata | local-only skill trees | 9 active eligible media/video skills | **blocked: preserve in Git or document a pinned canonical installer** |

Short hashes above identify the audited state; the bootstrap script must use
full hashes once each blocked repository is reconciled.

## Audited repository state

The following is the exact local state observed before this migration work was
committed. `Remote` means the local tracking reference was equal to local HEAD;
it does not override an explicit GitHub-access failure noted below.

| Repository | Branch / HEAD | Tracked changes | Untracked | Ahead / behind | Runtime use | Audit decision |
|---|---|---:|---:|---:|---|---|
| root operations workspace | `master@511e361cf945` | 780 | 307 | 3 / 0 | active plugins, skills, specialist services, workspace policy | split and reconcile; remote unavailable to current identity |
| openclaw-operator | `main@969bc2b84d94` before this task; two local audit commits now follow it | 0 before this task | 0 before this task | 2 / 0 after local commits | active orchestrator and operator UI | authoritative public repo; push blocked because the active GitHub identity lacks write permission |
| coding-agent-skills | `main@0d899bcaaf3b` | 0 | 0 | 0 / 0 after this task's push | active coding evidence plugin | authoritative reachable repo |
| OpenClaw | detached `2d2ddc43d0dc` | 4 | 0 | no tracking branch | base source for Gateway/Codex changes | preserve two separate patches against `v2026.7.1` |
| social-agent | `main@6f687a077cfc` | 11 | 7 | 0 / 0 | active social implementation source | split, validate, commit, and push separately |
| social-pulse | `main@d97cd4315e94` | 0 | 0 | 0 / 0 | optional/private social UI | source clean; protected data remains separate |
| evidence-explorer clone | `main@44137a705ef4` | 0 | 0 | 0 / 0 | clean base only | remote unavailable to current identity |
| active evidence console | `main@44137a705ef4` | 10 | 12 | 0 / 0 | active system-service source | reconcile with authoritative repo; exclude timestamp caches |
| local OpenAI Codex clone | detached `78ad6e6bfd1d` / `rust-v0.144.3` | 0 | 0 | no tracking branch | reference checkout; no proved direct runtime load | regenerate/clone only if future diagnostics require it |

Other bounded project repositories are not part of the current live OpenClaw
service graph: `coding-workflow-library` has two tracked changes,
`hardware-ledger` has thirteen, and `design.md`, founders, tax-lien,
truth-structuring, and wagging-web-wins were clean at their tracked heads. They
must be preserved but not swept into this migration commit.

## Local-only classification

### A. Commit to GitHub

- migration manifest, export plan, bootstrap check, service templates, tests,
  and the two separate OpenClaw patch artifacts;
- exact doc-specialist retention source and test used by the active service;
- root custom plugin and skill source after it is split from generated/private
  workspace material;
- social-agent connector/platform source and lockfile after focused review;
- public-decision source, migrations, tests, and safe unit template in a proved
  authoritative repository;
- active evidence-console source after excluding timestamp caches;
- safe configuration examples and secret-reference names, never resolved
  values.

### B. Generate during bootstrap

- `node_modules`, compiled `dist`, package caches, build caches, generated docs
  mirrors/indexes, UI assets, downloaded dependencies, runtime sockets, PID
  files, and Vite timestamp files;
- the generated Gateway unit produced by the pinned OpenClaw installer;
- packages built from the pinned source and approved patch set.

### C. Export separately as protected runtime data

- selected OpenClaw agent/session SQLite databases, scheduler definitions,
  approved memory, operator SQLite state, Redis persistence, social queue and
  history databases, selected activity/evidence ledgers, and required public-
  decision object/ledger state;
- encrypted credential records only when their encryption key is handed over
  separately.

### D. Recreate manually or through a secret manager

- Telegram, GitHub, Cloudflare, Cloudinary, provider, Supabase, and social API
  credentials; OAuth refresh/access tokens; app/webhook secrets; Redis secret;
  private keys; recovery codes; and service-role keys;
- authenticated browser profiles/cookies by interactive login where practical;
- the social control-plane encryption key, separate from encrypted data.

### E. Exclude permanently

- unselected transcripts, obsolete logs, crash dumps, stale temporary
  artifacts, old redundant backups, orphaned session files, caches, swap files,
  and generated package/download stores.

Nothing in Category E is deleted by this audit.

## Preserved OpenClaw patches

The OpenClaw source checkout contains two unrelated local changes and they must
remain separate:

1. `patches/openclaw/0001-native-hook-relay-stabilization.patch`
   - current running behavior
   - prevents native Codex hook callbacks from resolving the source development
     runner and launching source builds inside the Gateway cgroup
   - SHA-256 `6c3aa48aa008564d55d22db952e146ec6c02f83dedcb322f0f58b77dac6d3e19`
2. `patches/openclaw/0002-codex-exact-toolsallow.patch`
   - validated source only; **not active in the installed Codex plugin**
   - promotes only exact, non-wildcard, already-authorized `toolsAllow` names
   - SHA-256 `3e5d89c7d478a4931a2e2306ec549b6dd5906dddd7f377a06bf483cae8fe837e`

A parity build may apply patch 0001. Patch 0002 must remain unapplied to the
installed plugin until a separate activation approval is granted.

## Plugins and skills

Active custom plugin source requirements:

- `coding-agent-skills` — authoritative source is the operator repo extension
  wrapper plus the standalone coding-agent-skills repository.
- `orchestrator-bridge` — authoritative source is the operator repository.
- `project-deployment-connector` — currently only in the dirty root operations
  workspace.
- `provider-rate-limit-guard` — currently only in the dirty root operations
  workspace.
- `relay-live-business-engagement-connector` — currently only in the dirty
  root operations workspace.
- `social-agent-connector` — currently only in the dirty root operations
  workspace, with related source also present in the dirty social-agent repo.

Active custom skill source currently exists in the dirty root operations
workspace: approval-bounded change, bounded workspace, business registry/value
loop, clawpatch integration, coding audit policy, memory fallback, live
engagement relay, worker routing, and invocation-ledger policy. These must be
committed to an authoritative reachable remote before migration.

Nine eligible personal media/video skills (`general-video`, HyperFrames core,
CLI, creative, animation, keyframes, registry, and `media-use`) exist as equal
4.6 MiB trees under both `~/.agents/skills` and `~/.claude/skills`. Neither tree
is in Git and no installed-version metadata proved which pinned package can
recreate it. Preserve that exact source in a safe repository or document and
verify a pinned canonical installer before calling the skill layer portable.

Bundled plugins are installed with OpenClaw 2026.7.1. The retained host also
has installed packages for Codex 2026.7.1, llama-cpp 2026.6.11, and Slack
2026.7.1. Version drift is intentional only where documented; do not silently
upgrade during migration.

## Services, ports, and startup order

| Service | Startup | Port(s) | Source/config |
|---|---|---|---|
| Docker | system service, enabled | daemon | host package |
| OpenClaw Redis | system service, enabled after Docker | `127.0.0.1:6379` | tracked template plus protected environment input; bind data is protected runtime state |
| OpenClaw Gateway | user service, enabled | `18789` plus local auxiliary sockets | generated by pinned OpenClaw installation; local OpenClaw config and secrets are protected inputs |
| Orchestrator | user service, enabled | `127.0.0.1:3312`, `127.0.0.1:9100` | operator repository; protected env file and SQLite state |
| doc-specialist | user service, enabled | none | specialist source plus local config |
| reddit-helper | user service, enabled | none | specialist source plus local config |
| Cloudflare social tunnel | user service, enabled | local tunnel endpoint `20242` | token must be reprovisioned; do not copy a token into Git |
| Evidence Explorer | system service | `4174` | evidence-explorer repo / active console source |
| Public Decision Intelligence | system service | `41051` | local-only incubation source; migration blocker |
| Ollama | system service | `11434` | optional local-model dependency |

Startup order for parity:

1. Docker, then Redis.
2. Restore protected SQLite/Redis state while owning services are stopped.
3. Orchestrator.
4. OpenClaw Gateway.
5. specialist services and optional evidence services.
6. read-only health verification.

Do not copy the current absolute NVM paths from installed units. Install the
pinned runtime on the destination and materialize service files from tracked
templates or the pinned OpenClaw installer.

## Configuration and secret references

Safe tracked configuration contains schemas and templates only. The migration
operator must supply secret values locally or through OpenClaw SecretRefs.
Required categories include:

- Gateway authentication token/password and Telegram bot token;
- provider/API credentials used by enabled models and channels;
- Redis password and Redis URL;
- orchestrator API rotation material and webhook secret;
- Cloudflare account/token references and tunnel token;
- GitHub token reference;
- social platform OAuth access/refresh tokens and app secrets;
- Cloudinary delivery credentials;
- Supabase URL/service-role references where the connector is enabled;
- social control-plane encryption key, kept separate from its encrypted data;
- browser authentication and cookies, preferably recreated by interactive login.

Known plugin configuration keys are documented by their manifests. Secret
fields use `SecretRef` wiring where supported; non-secret keys include local
base URLs, timeouts, allowed views/tasks, state directories, socket paths, and
workspace project roots. Never commit the resolved values.

Path-name history inspection found historical `.env`, `.env.development`, and
`.env.production` entries in the private `social-pulse` repository. Their
contents were not opened. Treat this as a potential historical-secret risk:
verify rotation and repository history under a separate credential-remediation
approval before using that repository as evidence that secrets are safe. Do
not rewrite history under this migration task.

## Runtime restore points

GitHub intentionally excludes:

- OpenClaw agent/session databases and selected durable memory;
- Gateway scheduler definitions;
- operator SQLite databases and coordination state;
- social control-plane/history databases;
- public-decision ledgers and object storage;
- authenticated browser profiles;
- encrypted credential records and their separately held encryption keys;
- private transcripts and local evidence containing user data.

Use [protected-runtime-export-plan.md](./protected-runtime-export-plan.md) for
consistent export and restore instructions.

## Bootstrap and verification

Run:

```bash
./scripts/bootstrap-machine.sh --check
```

The check is read-only and currently fails closed while active source remains
unpublished. `--apply` is intentionally blocked until every required source
entry above has a reachable Git pin and the protected export is approved.

Destination verification must include:

```bash
openclaw --version
openclaw config validate
openclaw doctor --non-interactive
systemctl --user is-active openclaw-gateway.service orchestrator.service
curl -fsS http://127.0.0.1:18789/health
curl -fsS http://127.0.0.1:3312/health
curl -fsS http://127.0.0.1:3312/api/persistence/health
ss -ltn
```

Also verify Telegram connectivity, plugin load with zero errors, expected skill
inventory, Redis coordination health, SQLite schema/version checks, and the
absence of source development builders inside the Gateway cgroup.

## Rollback

- Keep the old host stopped but intact until the destination passes health and
  data reconciliation.
- Keep protected export checksums and manifests outside Git.
- Retain the destination's pre-restore empty databases so restore can be
  reversed without touching the old host.
- If the patched Gateway fails, stop the destination Gateway and reinstall the
  pinned unpatched 2026.7.1 package. Do not reuse the unactivated patch.
- Never roll back by copying live SQLite/WAL files between running services.

## Current migration blockers

1. Root operations source, custom plugins, and custom skills are not safely
   reachable from the intended GitHub remote. The active doc-specialist
   retention source is preserved in the operator repository by this task.
2. Social-agent local source is not committed or pushed.
3. Active public-decision-intelligence source has no proved repository.
4. Active evidence-console changes are local and its remote is inaccessible to
   the current GitHub identity.
5. Protected runtime export has been planned but not executed.
6. Secret reprovisioning has not been performed and must remain outside Git.
7. The two safe operator commits created by this audit are local only. The push
   to `AyobamiH/openclaw-operator` was rejected with HTTP 403 because the active
   `OneClickPostFactory` GitHub identity does not have write permission.
8. The active personal HyperFrames/media skill trees have no proved Git remote
   or pinned installer version.

Until these are resolved, do not claim the machine is reproducible.
