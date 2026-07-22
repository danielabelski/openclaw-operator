#!/usr/bin/env bash
set -euo pipefail

MODE="check"
case "${1:-}" in
  ""|--check) MODE="check" ;;
  --apply) MODE="apply" ;;
  -h|--help)
    echo "usage: $0 [--check|--apply]"
    exit 0
    ;;
  *)
    echo "unsupported argument: $1" >&2
    exit 2
    ;;
esac

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
OPENCLAW_WORKSPACE="${OPENCLAW_WORKSPACE:-$OPENCLAW_HOME/workspace}"
PROJECTS_ROOT="${OPENCLAW_PROJECTS_ROOT:-$OPENCLAW_WORKSPACE/projects}"

NODE_PIN="24.18.0"
OPENCLAW_VERSION="2026.7.1"
OPENCLAW_COMMIT="2d2ddc43"
OPERATOR_COMMIT="969bc2b84d94"
CODING_SKILLS_COMMIT="0d899bca"

failures=0
warnings=0

pass() { printf 'PASS  %s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL  %s\n' "$*"; failures=$((failures + 1)); }

have() { command -v "$1" >/dev/null 2>&1; }

check_command() {
  if have "$1"; then pass "$1 is available"; else fail "$1 is required"; fi
}

check_repo() {
  local path="$1" expected="$2" label="$3"
  if [[ ! -d "$path/.git" ]]; then
    fail "$label repository is missing at $path"
    return
  fi
  local head
  head="$(git -C "$path" rev-parse HEAD 2>/dev/null || true)"
  if git -C "$path" merge-base --is-ancestor "$expected" "$head" 2>/dev/null; then
    pass "$label contains audited base ${expected:0:12} at ${head:0:12}"
  else
    fail "$label HEAD ${head:-unknown} does not contain audited base $expected"
  fi
  if [[ -n "$(git -C "$path" status --porcelain)" ]]; then
    warn "$label working tree is dirty; bootstrap will not overwrite it"
  fi
  local upstream ahead
  upstream="$(git -C "$path" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    ahead="$(git -C "$path" rev-list --count "$upstream..HEAD")"
    if [[ "$ahead" == "0" ]]; then
      pass "$label has no commits ahead of $upstream"
    else
      fail "$label has $ahead commit(s) not present in $upstream"
    fi
  fi
}

check_patch() {
  local repo="$1" patch="$2" label="$3"
  if git -C "$repo" apply --check "$patch" >/dev/null 2>&1; then
    pass "$label applies cleanly to the current source"
  elif git -C "$repo" apply --reverse --check "$patch" >/dev/null 2>&1; then
    pass "$label is already represented exactly in the current source"
  else
    fail "$label neither applies nor reverses cleanly"
  fi
}

echo "OpenClaw machine bootstrap ($MODE mode)"
echo "workspace: $OPENCLAW_WORKSPACE"

[[ "$(uname -s)" == "Linux" ]] && pass "Linux host" || fail "Linux is required by the tracked service path"
for command_name in git curl jq sqlite3 node npm corepack systemctl; do
  check_command "$command_name"
done
if have docker; then pass "Docker is available for Redis parity"; else fail "Docker is required for the current Redis startup path"; fi

if have node; then
  actual_node="$(node --version | sed 's/^v//')"
  [[ "$actual_node" == "$NODE_PIN" ]] && pass "Node $NODE_PIN" || fail "Node $NODE_PIN required; found $actual_node"
fi

check_repo "$PROJECTS_ROOT/openclaw-operator" "$OPERATOR_COMMIT" "openclaw-operator"
check_repo "$PROJECTS_ROOT/openclaw" "$OPENCLAW_COMMIT" "openclaw"
check_repo "$PROJECTS_ROOT/coding-agent-skills" "$CODING_SKILLS_COMMIT" "coding-agent-skills"

manifest="$PROJECTS_ROOT/openclaw-operator/docs/operations/machine-migration-manifest.md"
export_plan="$PROJECTS_ROOT/openclaw-operator/docs/operations/protected-runtime-export-plan.md"
[[ -f "$manifest" ]] && pass "migration manifest present" || fail "migration manifest missing"
[[ -f "$export_plan" ]] && pass "protected export plan present" || fail "protected export plan missing"

for patch in \
  0001-native-hook-relay-stabilization.patch \
  0002-codex-exact-toolsallow.patch; do
  path="$PROJECTS_ROOT/openclaw-operator/patches/openclaw/$patch"
  [[ -f "$path" ]] && pass "$patch present" || fail "$patch missing"
done

if [[ -d "$PROJECTS_ROOT/openclaw/.git" ]]; then
  check_patch "$PROJECTS_ROOT/openclaw" \
    "$PROJECTS_ROOT/openclaw-operator/patches/openclaw/0001-native-hook-relay-stabilization.patch" \
    "runtime-stabilization patch"
  check_patch "$PROJECTS_ROOT/openclaw" \
    "$PROJECTS_ROOT/openclaw-operator/patches/openclaw/0002-codex-exact-toolsallow.patch" \
    "unactivated exact-toolsAllow patch"
fi

for protected in \
  "$OPENCLAW_HOME/credentials" \
  "$OPENCLAW_HOME/cron" \
  "$OPENCLAW_WORKSPACE/orchestrator/data/operator.sqlite"; do
  [[ -e "$protected" ]] && warn "protected restore source exists locally: $protected" || warn "protected restore input not present: $protected"
done

cat <<'BLOCKERS'

Unresolved source blockers checked by this audit:
  - root openclaw-ops custom plugins and skills
  - social-agent local source changes
  - public-decision-intelligence local-only active source
  - evidence-console local changes and currently inaccessible remote
  - active personal HyperFrames/media skills without a Git or pinned-installer source

Secret values and protected runtime data are intentionally not checked into Git.
BLOCKERS

fail "root openclaw-ops custom plugin and skill source is not yet reconciled to a reachable Git pin"
fail "social-agent active local changes are not yet reconciled to a Git pin"
fail "public-decision-intelligence active source has no proved Git repository"
fail "active evidence-console changes are not yet reconciled to a reachable Git pin"
fail "active personal HyperFrames/media skills have no proved Git or pinned-installer source"

if [[ "$MODE" == "apply" ]]; then
  echo "REFUSED: apply mode is disabled until the blockers in the migration manifest are resolved." >&2
  echo "This guard prevents a partial machine from being mistaken for a reproducible installation." >&2
  exit 3
fi

if (( failures > 0 )); then
  echo "check failed: $failures required item(s) missing; $warnings warning(s)" >&2
  exit 1
fi

echo "check passed with $warnings warning(s)"
echo "No files, services, credentials, schedulers, or external systems were changed."
