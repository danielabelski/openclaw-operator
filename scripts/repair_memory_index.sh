#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/repair_memory_index.sh doctor
  bash scripts/repair_memory_index.sh index
  bash scripts/repair_memory_index.sh index --force
  bash scripts/repair_memory_index.sh promote-temp

Environment overrides:
  OPENCLAW_CONFIG_PATH        Default: $HOME/.openclaw/openclaw.json
  OPENCLAW_MEMORY_AGENT_ID    Default: main
  OPENCLAW_MEMORY_DIR         Default: $HOME/.openclaw/memory
  OPENCLAW_MEMORY_CLI         Default: auto-detect `openclaw`
EOF
}

command_name="${1:-doctor}"
if [[ $# -gt 0 ]]; then
  shift
fi

force_reindex="0"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      force_reindex="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

config_path="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
agent_id="${OPENCLAW_MEMORY_AGENT_ID:-main}"
memory_dir="${OPENCLAW_MEMORY_DIR:-$HOME/.openclaw/memory}"
sqlite_path="$memory_dir/${agent_id}.sqlite"
workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
memory_cli="${OPENCLAW_MEMORY_CLI:-}"
resolved_cli_command=""
resolved_cli_label=""

resolve_cli() {
  if [[ -n "$memory_cli" ]]; then
    resolved_cli_command="$memory_cli"
    resolved_cli_label="$memory_cli"
    return
  fi

  if command -v openclaw >/dev/null 2>&1; then
    resolved_cli_command="$(command -v openclaw)"
    resolved_cli_label="$resolved_cli_command"
    return
  fi

  if command -v npm >/dev/null 2>&1; then
    local npm_bin_dir
    local npm_dist_index
    npm_bin_dir="$(dirname "$(command -v npm)")"
    if [[ -x "$npm_bin_dir/openclaw" ]]; then
      resolved_cli_command="$npm_bin_dir/openclaw"
      resolved_cli_label="$resolved_cli_command"
      return
    fi

    npm_dist_index="$(cd "$npm_bin_dir/../lib/node_modules/openclaw/dist" 2>/dev/null && pwd)/index.js"
    if [[ -f "$npm_dist_index" ]]; then
      resolved_cli_command="node \"$npm_dist_index\""
      resolved_cli_label="node $npm_dist_index"
      return
    fi
  fi

  resolved_cli_command=""
  resolved_cli_label="missing"
}

mtime_or_zero() {
  local target="$1"
  if [[ -e "$target" ]]; then
    stat -c %Y "$target"
  else
    printf '0\n'
  fi
}

iso_mtime_or_missing() {
  local target="$1"
  if [[ -e "$target" ]]; then
    stat -c %y "$target"
  else
    printf 'missing\n'
  fi
}

newest_memory_source_epoch() {
  local newest="0"
  local candidate
  for candidate in "$workspace_root/MEMORY.md" "$workspace_root"/memory/*.md; do
    if [[ ! -e "$candidate" ]]; then
      continue
    fi
    local candidate_mtime
    candidate_mtime="$(mtime_or_zero "$candidate")"
    if (( candidate_mtime > newest )); then
      newest="$candidate_mtime"
    fi
  done
  printf '%s\n' "$newest"
}

newest_temp_candidate() {
  local newest_path=""
  local newest_mtime="0"
  local candidate
  for candidate in "$sqlite_path".tmp-*; do
    if [[ ! -e "$candidate" ]]; then
      continue
    fi
    local candidate_mtime
    candidate_mtime="$(mtime_or_zero "$candidate")"
    if (( candidate_mtime > newest_mtime )); then
      newest_mtime="$candidate_mtime"
      newest_path="$candidate"
    fi
  done
  printf '%s\n' "$newest_path"
}

sqlite_probe_json() {
  local target="$1"
  python3 - "$target" <<'PY'
import json
import sqlite3
import sys

path = sys.argv[1]
conn = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
try:
    integrity = conn.execute('PRAGMA integrity_check').fetchone()[0]
    counts = {}
    for table in ('files', 'chunks', 'embedding_cache'):
        try:
            counts[table] = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        except Exception as exc:
            counts[table] = f'ERR:{exc}'
    print(json.dumps({
        'integrity': integrity,
        'counts': counts,
    }))
finally:
    conn.close()
PY
}

print_temp_candidate_summary() {
  local candidate
  candidate="$(newest_temp_candidate)"
  if [[ -z "$candidate" ]]; then
    printf 'temp_candidate: none\n'
    return
  fi

  local probe_json
  probe_json="$(sqlite_probe_json "$candidate")"
  local integrity
  local files_count
  local chunks_count
  local cache_count
  integrity="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.integrity ?? 'unknown'));" "$probe_json")"
  files_count="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.counts?.files ?? 'unknown'));" "$probe_json")"
  chunks_count="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.counts?.chunks ?? 'unknown'));" "$probe_json")"
  cache_count="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.counts?.embedding_cache ?? 'unknown'));" "$probe_json")"

  printf 'temp_candidate: %s\n' "$candidate"
  printf 'temp_candidate_mtime: %s\n' "$(iso_mtime_or_missing "$candidate")"
  printf 'temp_candidate_integrity: %s\n' "$integrity"
  printf 'temp_candidate_counts: files=%s chunks=%s embedding_cache=%s\n' "$files_count" "$chunks_count" "$cache_count"
}

config_summary() {
  if [[ ! -f "$config_path" ]]; then
    printf 'config: missing (%s)\n' "$config_path"
    return
  fi

  node - "$config_path" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const raw = fs.readFileSync(path, 'utf8');
const parsed = JSON.parse(raw);
const defaults = parsed?.agents?.defaults ?? {};
const memory = defaults.memorySearch ?? null;
const slot = parsed?.plugins?.slots?.memory ?? 'implicit-default';
if (!memory) {
  console.log('config: memorySearch missing');
  console.log(`plugins.slot.memory: ${slot}`);
  process.exit(0);
}
const provider = memory.provider ?? 'unset';
const enabled = memory.enabled ?? 'unset';
const fallback = memory.fallback ?? 'unset';
const modelPath = memory?.local?.modelPath ?? 'unset';
const storePath = memory?.store?.path ?? 'unset';
const watch = memory?.sync?.watch ?? 'unset';
console.log(`config: memorySearch present`);
console.log(`plugins.slot.memory: ${slot}`);
console.log(`memorySearch.enabled: ${enabled}`);
console.log(`memorySearch.provider: ${provider}`);
console.log(`memorySearch.fallback: ${fallback}`);
console.log(`memorySearch.local.modelPath: ${modelPath}`);
console.log(`memorySearch.store.path: ${storePath}`);
console.log(`memorySearch.sync.watch: ${watch}`);
NODE
}

print_doctor() {
  resolve_cli
  local newest_source
  newest_source="$(newest_memory_source_epoch)"
  local sqlite_mtime
  sqlite_mtime="$(mtime_or_zero "$sqlite_path")"

  printf 'Memory index doctor\n'
  printf 'workspace: %s\n' "$workspace_root"
  printf 'config_path: %s\n' "$config_path"
  printf 'agent_id: %s\n' "$agent_id"
  printf 'memory_sqlite: %s\n' "$sqlite_path"
  printf 'memory_sqlite_mtime: %s\n' "$(iso_mtime_or_missing "$sqlite_path")"
  printf 'latest_memory_source_mtime: %s\n' "$(TZ=UTC date -d "@$newest_source" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || printf 'unknown')"
  print_temp_candidate_summary

  printf 'openclaw_cli: %s\n' "${resolved_cli_label:-missing}"

  config_summary

  if (( newest_source > sqlite_mtime )); then
    printf 'status: stale (Markdown memory is newer than the SQLite index)\n'
  elif [[ ! -e "$sqlite_path" ]]; then
    printf 'status: missing (SQLite index has not been created yet)\n'
  else
    printf 'status: current-or-unverified\n'
  fi

  local newest_temp
  newest_temp="$(newest_temp_candidate)"
  if [[ -n "$newest_temp" ]] && (( "$(mtime_or_zero "$newest_temp")" > sqlite_mtime )); then
    printf 'hint: newest temp candidate is newer than main.sqlite; run `bash scripts/repair_memory_index.sh promote-temp` after verifying it looks valid\n'
  fi

  if [[ -z "$resolved_cli_command" ]]; then
    printf 'next: install or expose the OpenClaw CLI, then run `bash scripts/repair_memory_index.sh index --force`\n'
  else
    printf 'next: run `bash scripts/repair_memory_index.sh index --force` to force a full rebuild\n'
  fi
}

run_index() {
  resolve_cli
  if [[ -z "$resolved_cli_command" ]]; then
    printf 'OpenClaw CLI not found. Export OPENCLAW_MEMORY_CLI or put `openclaw` on PATH first.\n' >&2
    exit 1
  fi

  if [[ "$force_reindex" == "1" ]]; then
    eval "$resolved_cli_command" memory index --agent "\"$agent_id\"" --force --verbose
  else
    eval "$resolved_cli_command" memory status --agent "\"$agent_id\"" --deep --index --verbose
  fi
}

promote_temp() {
  local candidate
  candidate="$(newest_temp_candidate)"
  if [[ -z "$candidate" ]]; then
    printf 'No temp SQLite candidate found under %s\n' "$memory_dir" >&2
    exit 1
  fi

  local probe_json
  probe_json="$(sqlite_probe_json "$candidate")"
  local integrity
  local chunks_count
  integrity="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.integrity ?? 'unknown'));" "$probe_json")"
  chunks_count="$(node -e "const data = JSON.parse(process.argv[1]); process.stdout.write(String(data.counts?.chunks ?? '0'));" "$probe_json")"

  if [[ "$integrity" != "ok" ]]; then
    printf 'Refusing to promote %s because integrity_check=%s\n' "$candidate" "$integrity" >&2
    exit 1
  fi

  if [[ "$chunks_count" == "0" ]]; then
    printf 'Refusing to promote %s because chunks=0\n' "$candidate" >&2
    exit 1
  fi

  local backup_path
  backup_path="${sqlite_path}.bak-$(date +%Y%m%dT%H%M%S)"
  if [[ -e "$sqlite_path" ]]; then
    cp "$sqlite_path" "$backup_path"
  fi
  cp "$candidate" "$sqlite_path"

  printf 'Promoted temp memory index\n'
  printf 'live: %s\n' "$sqlite_path"
  if [[ -e "$backup_path" ]]; then
    printf 'backup: %s\n' "$backup_path"
  fi
  printf 'source: %s\n' "$candidate"
}

case "$command_name" in
  doctor)
    print_doctor
    ;;
  index)
    run_index
    ;;
  promote-temp)
    promote_temp
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
