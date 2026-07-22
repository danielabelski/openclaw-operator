---
title: "Protected Runtime Export Plan"
summary: "Service-consistent, secret-safe export and restore plan for non-source OpenClaw state."
---

# Protected Runtime Export Plan

This plan does not authorize an export. It identifies the minimum protected
handoff and the service-consistency boundary required before a future export.

## Archive design

Produce two separately protected deliverables:

1. **Encrypted runtime-data archive** — databases, selected state, scheduler
   definitions, and non-secret manifests.
2. **Independent key/credential handoff** — encryption keys, API tokens, OAuth
   refresh tokens, bot tokens, private keys, browser authentication, and
   recovery material.

Never store the archive decryption key or the social control-plane encryption
key in the runtime-data archive. Never commit either deliverable to Git.

Each archive needs a plaintext, non-sensitive manifest containing relative
path, owner, size, export method, schema/version where known, and SHA-256. The
manifest must not contain secret values or private transcript content.

## Data-source matrix

| Data source | Owner | Audited size | Sensitivity | Live-copy rule | Export / restore method | Verification |
|---|---|---:|---|---|---|---|
| `~/.openclaw/agents` | OpenClaw agents/Codex | ~1.7 GiB | high; sessions, state, logs | do not raw-copy while Gateway is active | separately approved Gateway pause; SQLite `.backup` per required DB; copy approved non-DB state only | `PRAGMA quick_check`, row/schema counts, owner permissions, OpenClaw session diagnostics |
| `~/.openclaw/state/openclaw.sqlite` | OpenClaw core | ~21 MiB | high | SQLite backup API only | `sqlite3 source '.backup destination'`; restore with owner service stopped | `PRAGMA quick_check`; OpenClaw status |
| `~/.openclaw/cron` | OpenClaw scheduler | ~36 KiB | medium/high | export after scheduler/Gateway quiescence | archive selected definitions and metadata; exclude execution caches unless required | `openclaw cron list` and exact job-ID/schedule comparison |
| workspace `memory/` and approved `MEMORY.md` | agent continuity | ~1.3 MiB | high/private | file copy is safe when not being written; select explicitly | encrypted archive, preserving permissions | file hashes and selected memory lookup |
| workspace `orchestrator/data/operator.sqlite` plus WAL/SHM | active orchestrator | ~65 MiB database | high operational state | do not copy files live | separately approved orchestrator stop or online SQLite `.backup`; copy only the backup, not WAL/SHM | `PRAGMA quick_check`, schema version, persistence health, documented counts |
| workspace `orchestrator/data/redis` | Redis coordination | small but active | high operational locks/cache | require Redis stop or a verified Redis persistence snapshot | separately approved service pause; copy consistent AOF/RDB set; restore before Redis start | Redis ping/auth via protected input; orchestrator coordination health |
| `projects/social-agent/data/*.sqlite` | social control plane | ~6 MiB | high; queue/history/account state | SQLite backup API; stop owner if writes cannot be excluded | `.backup` each approved DB | `PRAGMA quick_check`, queue/history counts, read-only connector status |
| `projects/social-agent/data/control-plane.key` | social credential encryption | 44 bytes | critical secret | never place in runtime-data archive | separate secret-manager/operator handoff | decrypt a non-destructive test record without displaying it |
| `projects/social-agent/backups` | social control plane | ~20 MiB | high | export only backups selected as required | encrypted archive or exclude stale duplicates | checksums and restore rehearsal |
| `incubation/public-decision-intelligence/var` | public-decision service | ~14 MiB | mixed; ledgers and object data | pause if mutating | archive selected ledger/object data after owner-specific consistency check | service health and ledger/object counts |
| browser profile under `~/.openclaw` | Browser Relay | ~8 MiB | critical; cookies/session auth | prefer interactive recreation | do not migrate by default; if explicitly required, separate encrypted handoff | successful manual reauthentication |
| `~/.openclaw/credentials` and OAuth stores | OpenClaw/channels/providers | small | critical secrets | never include in source archive | secret manager or local operator provisioning | secret-reference validation without value output |
| service unit overrides and local env files | systemd/services | small | high | inspect names only until approved | recreate from tracked templates plus protected local inputs | `systemd-analyze verify`, environment-file presence/permissions |

Large audited OpenClaw databases include a Codex logs database of roughly
631 MiB, a Codex state database of roughly 79 MiB, and the main agent database
of roughly 101 MiB. Export only the records needed for continuity; private raw
transcripts and obsolete logs are excluded unless John explicitly selects them.

## Future export procedure

The following is a procedure for a separately approved maintenance window. Do
not execute it while owning services are writing.

1. Record service PIDs, start times, health, schema versions, row counts, and
   source file hashes.
2. Stop or quiesce only the service that owns each mutable data set.
3. Use SQLite's backup API for every required SQLite database:

   ```bash
   sqlite3 /path/to/source.sqlite ".backup '/protected/staging/name.sqlite'"
   sqlite3 /protected/staging/name.sqlite 'PRAGMA quick_check;'
   ```

4. For Redis, use the currently configured persistence mechanism and copy a
   consistent AOF/RDB set only after the Redis owner is stopped or confirms a
   completed snapshot.
5. Copy approved non-database files with owner, mode, and relative path
   preserved. Exclude sockets, PID files, WAL/SHM files, caches, crash dumps,
   package stores, and unselected transcripts.
6. Generate SHA-256 and size manifests without opening secret-bearing files.
7. Encrypt the runtime-data archive with a new migration key.
8. Transfer the archive and its key by separate protected channels.
9. Restart the old-host services only if the approved window permits it and
   verify their original health.

## Restore procedure

1. Complete source/bootstrap checks before restoring state.
2. Keep destination owner services stopped.
3. Validate archive signature/checksum and decrypt into a permission-restricted
   staging directory.
4. Restore SQLite backups to documented destination paths; never restore WAL or
   SHM files from the old host.
5. Restore Redis persistence before Redis starts.
6. Reprovision the social encryption key and other secrets separately.
7. Set restrictive owner/group/modes.
8. Start dependencies in manifest order and run read-only health checks.
9. Compare schema versions, selected counts, scheduler IDs, plugin/skill
   inventory, and service start/restart counters.
10. Retain the old host and export until a defined rollback window closes.

## Permanent exclusions

Do not migrate package caches, `node_modules`, compiled `dist` that can be
rebuilt, temporary Vite timestamp files, runtime sockets, PID files, crash
dumps, swap files, unreferenced transcripts not selected for continuity, stale
logs, or downloaded dependency caches.

## Approval boundary

Executing this plan requires separate approval because it pauses services,
reads or packages sensitive runtime state, and creates an encrypted archive.
The approval must name the services allowed to pause, the selected databases,
the archive destination, the encryption method, and the independent key
handoff.
