---
title: "Public Release"
summary: "Create a sanitized public mirror without rewriting private history."
---

# Public Release Without Rewriting Private History

Use this path when you want to publish OpenClaw Operator publicly but preserve
the private repo's existing history exactly as-is.

## When To Use This

Choose a sanitized public mirror when:

- the private repo history already contains tracked local-only files
- you do not want to force-push rewritten history over the current private repo
- you want a clean public starting point with fresh commits

Do **not** use this path when your goal is "make this exact repo public with the
same visible commit history." That goal requires a history rewrite instead.

## What The Mirror Excludes

The export workflow intentionally removes tracked local/session material and
other private-only state from the public tree.

Current hard exclusions:

- `MEMORY.md`
- `.openclaw/workspace-state.json`
- `.codex`

Ignored runtime directories such as `logs/`, `memory/`, `.env*`, and
`node_modules/` are also excluded because the mirror is built from
`git ls-files --cached --others --exclude-standard`.

## Export Command

From the repo root:

```bash
npm run public:mirror -- /tmp/openclaw-operator-public-mirror --force
```

What it does:

1. reads the current working tree, not just `HEAD`
2. copies tracked and non-ignored files into the destination
3. skips the excluded private paths
4. writes `PUBLIC_MIRROR_MANIFEST.json` into the exported tree

That manifest records:

- source commit
- whether uncommitted changes were included
- exported file count
- excluded path list
- export timestamp

## Recommended Release Flow

1. finish the public-safe cleanup in the private repo working tree
2. export the sanitized mirror
3. scan the exported tree for private paths, hostnames, ids, and local state
4. initialize a fresh git repo inside the mirror
5. push that fresh repo to the public remote

Example:

```bash
npm run public:mirror -- /tmp/openclaw-operator-public-mirror --force
cd /tmp/openclaw-operator-public-mirror
git init -b main
git add .
git commit -m "Initial public release"
git remote add origin <public-remote-url>
git push -u origin main
```

## Final Check Before Publishing

Before making the public mirror live:

- confirm no local machine paths remain
- confirm no private hostnames or ids remain
- confirm the docs site still builds
- confirm the operator boots from a clean clone
- confirm `MEMORY.md` and `.openclaw/workspace-state.json` are absent

## Why This Is Safer

This path preserves the private repo exactly.

You avoid:

- force-pushing rewritten history
- breaking existing private clones
- invalidating old commit references in the private repo

The public repo becomes a clean product artifact, while the private repo keeps
its operational history intact.
