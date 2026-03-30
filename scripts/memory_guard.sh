#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/memory_guard.sh start "<current focus>"
  bash scripts/memory_guard.sh checkpoint <label> "<note>"
  bash scripts/memory_guard.sh closeout "<summary>" "<next step>"

Environment overrides:
  MEMORY_GUARD_WORKSPACE_ROOT   Override detected workspace root for testing
  MEMORY_GUARD_TIMEZONE         Default: Europe/London
  MEMORY_GUARD_STATE_DIR        Default: ${TMPDIR:-/tmp}/openclaw-memory-guard
  OPENCLAW_MEMORY_SESSION_KEY   Default: main
EOF
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workspace_root="${MEMORY_GUARD_WORKSPACE_ROOT:-$(cd "$script_dir/.." && pwd)}"
timezone="${MEMORY_GUARD_TIMEZONE:-Europe/London}"
state_dir="${MEMORY_GUARD_STATE_DIR:-${TMPDIR:-/tmp}/openclaw-memory-guard}"
session_key="${OPENCLAW_MEMORY_SESSION_KEY:-main}"
safe_session_key="$(printf '%s' "$session_key" | tr -cs 'A-Za-z0-9._-' '_')"
state_file="$state_dir/${safe_session_key}.env"
memory_dir="$workspace_root/memory"
today="$(TZ="$timezone" date +%F)"
memory_file="$memory_dir/$today.md"
now_iso() {
  TZ="$timezone" date -Iseconds
}

ensure_memory_file() {
  mkdir -p "$memory_dir"
  if [[ ! -f "$memory_file" ]]; then
    printf '# %s\n\n' "$today" >"$memory_file"
  fi
}

get_mtime() {
  local target="$1"
  if [[ -f "$target" ]]; then
    stat -c %Y "$target"
  else
    printf '0\n'
  fi
}

append_entry() {
  local entry="$1"
  ensure_memory_file
  printf '%s\n' "$entry" >>"$memory_file"
}

read_note() {
  if [[ $# -gt 0 ]]; then
    printf '%s' "$*"
    return
  fi

  if [[ ! -t 0 ]]; then
    cat
    return
  fi

  printf ''
}

load_state() {
  STARTED_AT=""
  START_MTIME="0"
  CHECKPOINT_COUNT="0"
  CLOSEOUT_WRITTEN="0"
  SESSION_ID=""
  SESSION_MEMORY_FILE="$memory_file"

  if [[ -f "$state_file" ]]; then
    # shellcheck disable=SC1090
    source "$state_file"
  fi
}

save_state() {
  mkdir -p "$state_dir"
  cat >"$state_file" <<EOF
SESSION_ID='${SESSION_ID}'
STARTED_AT='${STARTED_AT}'
START_MTIME='${START_MTIME}'
CHECKPOINT_COUNT='${CHECKPOINT_COUNT}'
CLOSEOUT_WRITTEN='${CLOSEOUT_WRITTEN}'
SESSION_MEMORY_FILE='${SESSION_MEMORY_FILE}'
EOF
}

command="${1:-}"
if [[ -z "$command" ]]; then
  usage
  exit 1
fi
shift || true

case "$command" in
  start)
    ensure_memory_file
    load_state
    local_focus="$(read_note "$@")"
    if [[ -z "$local_focus" ]]; then
      local_focus="Session opened without a recorded focus yet."
    fi

    STARTED_AT="$(now_iso)"
    START_MTIME="$(get_mtime "$memory_file")"
    CHECKPOINT_COUNT="0"
    CLOSEOUT_WRITTEN="0"
    SESSION_ID="${STARTED_AT//[^A-Za-z0-9]/-}"
    SESSION_MEMORY_FILE="$memory_file"

    append_entry "- [session-open ${STARTED_AT}] Focus: ${local_focus}"
    save_state
    printf 'memory-guard start -> %s\n' "$SESSION_MEMORY_FILE"
    ;;

  checkpoint)
    ensure_memory_file
    load_state
    label="${1:-checkpoint}"
    if [[ $# -gt 0 ]]; then
      shift
    fi
    local_note="$(read_note "$@")"
    if [[ -z "$local_note" ]]; then
      local_note="Checkpoint recorded without additional detail."
    fi

    checkpoint_at="$(now_iso)"
    append_entry "- [checkpoint ${checkpoint_at}] ${label}: ${local_note}"
    CHECKPOINT_COUNT="$((CHECKPOINT_COUNT + 1))"
    SESSION_MEMORY_FILE="$memory_file"
    save_state
    printf 'memory-guard checkpoint -> %s (%s)\n' "$SESSION_MEMORY_FILE" "$label"
    ;;

  closeout)
    ensure_memory_file
    load_state
    summary="${1:-}"
    next_step="${2:-}"

    if [[ -z "$summary" ]]; then
      summary="$(read_note)"
    fi
    if [[ -z "$summary" ]]; then
      summary="Session closed without an explicit summary."
    fi

    closeout_at="$(now_iso)"
    checkpoint_text="${CHECKPOINT_COUNT} checkpoint(s) recorded this session."
    if [[ "$CHECKPOINT_COUNT" -eq 0 ]]; then
      checkpoint_text="No intermediate checkpoints were recorded before closeout; this guard is writing the fallback summary."
    fi

    if [[ -n "$next_step" ]]; then
      append_entry "- [closeout ${closeout_at}] Summary: ${summary} Next: ${next_step} ${checkpoint_text}"
    else
      append_entry "- [closeout ${closeout_at}] Summary: ${summary} ${checkpoint_text}"
    fi

    CLOSEOUT_WRITTEN="1"
    SESSION_MEMORY_FILE="$memory_file"
    save_state
    printf 'memory-guard closeout -> %s\n' "$SESSION_MEMORY_FILE"
    ;;

  *)
    usage
    exit 1
    ;;
esac
