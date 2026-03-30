# 🔄 How to Continue Tomorrow (or After Any Break)

## When You Come Back: Reading Your Memory (5 Minutes to Full Context)

## Crash-Safe Memory Workflow

The bundled OpenClaw `session-memory` hook only fires on `/new`, and the
pre-compaction memory flush only runs near auto-compaction. Neither one is a
crash-safe session journal when WSL or Ubuntu drops unexpectedly.

Use the workspace guard instead:

```bash
cd /path/to/openclaw-operator

# At session start, after reading memory files
bash scripts/memory_guard.sh start "Current focus"

# After each material milestone
bash scripts/memory_guard.sh checkpoint milestone "What changed"

# Before risky operations that may outlive the session
bash scripts/memory_guard.sh checkpoint risky-op "About to run integration tests"

# Before the final response in the main session
bash scripts/memory_guard.sh closeout "What was completed" "Next step"
```

This keeps `memory/YYYY-MM-DD.md` current even when the session dies before a
graceful closeout.

## Repairing The SQLite Memory Index

When semantic memory search falls behind even though the Markdown notes are
current, inspect the SQLite index layer directly:

```bash
cd /path/to/openclaw-operator

bash scripts/repair_memory_index.sh doctor
bash scripts/repair_memory_index.sh index --force
```

If a forced rebuild leaves a newer `main.sqlite.tmp-*` file behind instead of
refreshing `main.sqlite`, the helper can now validate and promote the newest
temp index while keeping a backup of the stale live file:

```bash
bash scripts/repair_memory_index.sh promote-temp
```

That promotion path only accepts temp databases that pass SQLite integrity
checks and contain real indexed chunks.

### Step 1: Read AGENTS.md
**Location**: `AGENTS.md`

This file tells you what to do:
```markdown
## Every Session

Before doing anything else:

1. Read `SOUL.md` — this is who you are
2. Read `USER.md` — this is who you're helping
3. Read `memory/YYYY-MM-DD.md` (today + yesterday)
4. **If in MAIN SESSION**: Also read `MEMORY.md`
5. Run `bash scripts/memory_guard.sh start "<current focus>"`
```

**Time**: 2 minutes

---

### Step 2: Read MEMORY.md
**Location**: `MEMORY.md`

**Contains**: Strategic decisions, long-term context
```
## Core Mission
- What the system does
- How it works
- Why it matters

## Key Strategy Decisions
- Skills as bounded wrappers (Option B chosen, not prompt procedures)
- Model tiering by cost-to-impact
- Deny-by-default permission model

## 11-Agent Swarm Infrastructure
- All 11 agents defined
- Skill assignments documented
- Phased rollout plan

## Status: Core Skill Pack v1 COMPLETED ✅
- What was built
- What's in progress
- Next steps
```

**Time**: 3 minutes

---

### Step 3: Read Today's Memory File
**Location**: `memory/2026-02-22.md`

**Contains**: Tactical log of today's work
```
## What Was Accomplished
- 5 core skills implemented
- Skills registry created
- AGENT_TEMPLATE built
- System diagrams created

## Current System State
- Completed: Skills + template
- In progress: Agent wiring
- Not started: Task handlers, integration tests

## What's Next (Priority Order)
1. agentRegistry.ts
2. toolGate.ts
3. Create 3 initial agents
4. Update task handlers
...

## How to Continue
1. Start with agentRegistry.ts
2. Then toolGate.ts
3. Copy AGENT_TEMPLATE 3 times
...
```

**Time**: 2 minutes

---

### Step 4: Check Git Status
**Command**:
```bash
cd /path/to/openclaw-operator
git log --oneline -5
```

**Output** (shows exactly what was done):
```
83ee23c - chore: session log - core skill pack v1 complete
620130f - docs: add colorful system architecture diagram
9fb977a - docs: update MEMORY.md with core skill pack v1 completion
080bc59 - feat: complete core skill pack v1 and agent template framework
937ada1 - chore: add CI/CD, containerization, and deployment infrastructure
```

**What you learn**: 
- Last 3 commits completed this session
- Files changed in each commit
- Exact state of codebase

**Time**: 1 minute

---

## Total Time to Full Context: ~8 Minutes

You'll know:
- ✅ Who you are and what you're building
- ✅ Long-term strategy and decisions
- ✅ Exactly what was done today
- ✅ Pile-ordered next steps
- ✅ Exact code state (git commits)

---

## Example: Coming Back Feb 23, 2026

**Tomorrow morning, you:**

1. Open the workspace
2. Read files (8 minutes):
   - AGENTS.md (what to do)
   - MEMORY.md (strategic context)
   - memory/2026-02-23.md (today's log, as it's created)
   - `git log -5` (recent commits)

3. **You immediately know:**
   - "Oh right, I was building a 12-agent swarm"
   - "Core skills are done, I need to build the agent registry next"
   - "Start with agentRegistry.ts"
   - "Here are 4 commits I made yesterday"

4. **Start working** with zero context loss

---

## Why This Works Better Than Traditional Notes

| Problem | Traditional | Your System |
|---------|-------------|------------|
| Notes get lost | Hard to find files | Everything in git |
| Decisions unclear | Scattered comments | MEMORY.md has all decisions |
| What changed? | Have to diff manually | `git log` shows everything |
| Forgot next step | Have to re-read code | memory/ files say exactly what's next |
| Code state? | Unclear which version | Git commits pinned to exact files |
| Multiple sessions? | Context fragments | Daily memory files keep each day separate |

---

## System Design Philosophy

**Your system is built on a fundamental principle:**

> If it's not written down in a file, it doesn't exist.

**What gets written:**
1. SOUL.md — Identity (yourself)
2. USER.md — Purpose (who you serve)
3. MEMORY.md — Strategy (long-term decisions)
4. memory/YYYY-MM-DD.md — Tactics (daily work)
5. Git commits — Exact code state
6. Documentation files — Architecture, guides, reference

**What doesn't get written (and fails fast):**
- Mental notes (gone when session ends)
- Slack messages (buried, context lost)
- Uncommitted code changes (lost on restart)
- Ambiguous decisions (lead to re-work)

---

## Your Memory Files Are Now in Git

After today's session:
```
Commit: 83ee23c

    chore: session log - core skill pack v1 complete, ready for agent wiring
    
    memory/2026-02-22.md added
    - What was accomplished
    - Current system state
    - What's next (priority order)
    - How to continue
    - Technical decisions
    - Files created
```

This means:
- ✅ Your memory is version-controlled
- ✅ You can revert if needed (git checkout)
- ✅ Full history preserved
- ✅ Never lost, even if files deleted
- ✅ Can compare sessions (Feb 21 vs Feb 22)

---

## Quick Reference: Memory Files to Read

**On session start**, read in this order:

1. **AGENTS.md** (1 min)
   - How to use the memory system
   - What to read each session

2. **MEMORY.md** (2 min)
   - Strategic context
   - Long-term decisions
   - Architecture overview

3. **memory/TODAY.md** (2 min)
   - Tactical today's work
   - Next priority steps
   - Recent commits

4. **Git log** (1 min)
   - Exact files changed
   - Commit messages
   - Code state

5. **Run `npm run dev` from `workspace/`** and start from next step in TODO list

Root `workspace/package.json` is now the default orchestrator-first command
hub. `npm run clean` is intentionally conservative and removes only cache,
coverage, and build-info artifacts; use `npm run clean:builds` only when you
explicitly want to drop untracked frontend `dist/` outputs.

**Total**: ~8 minutes → Full context → Continue seamlessly

---

## Future: Add Checkpoints

After completing major milestones, consider adding `CHECKPOINT.md`:

```markdown
# CHECKPOINT - Feb 25, 2026

## What's Deployed
- ✅ 12-agent swarm fully operational
- ✅ All skills registered and tested
- ✅ Permission enforcement active

## What's Running
- Orchestrator: localhost:3000
- Agents: 11 workers + 1 mission control
- Skills: 5 core pack loaded

## Known Issues
- None critical

## What's Next
- Extended skills pack v2
- Advanced scheduling features
- Analytics dashboard
```

This becomes your "checkpoint" to quickly understand where the system stands at a glance.

---

## TL;DR - Your System Never Forgets Because...

```
Session starts
  ↓
Read 5 files (8 min)
  ↓
Full context restored
  ↓
Continue exactly where you left off
  ↓
Commit new work
  ↓
Memory files updated via `scripts/memory_guard.sh`
  ↓
Ready for next restart
```

Every time you turn off: ✅ Nothing is lost
Every time you turn on: ✅ Everything is recovered

**The system feels continuous because it IS continuous—in git and in documentation.**
