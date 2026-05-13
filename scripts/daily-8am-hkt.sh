#!/usr/bin/env bash
# Called by LaunchAgent every hour at :00; runs the HTML scaffold only when
# the clock in Asia/Hong_Kong is 08:00–08:59 (once per day via stamp file).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export TZ=Asia/Hong_Kong
LOG_DIR="$ROOT/output"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/scheduler.log"

log() { printf '%s %s\n' "$(date -Iseconds)" "$*" >>"$LOG"; }

DATE=$(date +%Y-%m-%d)
STAMP="$LOG_DIR/.daily-scaffold-ran-$DATE"

if [ "${1:-}" = "--force" ]; then
  "$ROOT/scripts/new-daily-html.sh" >>"$LOG" 2>&1
  touch "$STAMP"
  log "OK forced scaffold for $DATE"
  exit 0
fi

H=$(date +%H)
if [ "$H" != "08" ]; then
  exit 0
fi

if [ -f "$STAMP" ]; then
  exit 0
fi

if "$ROOT/scripts/new-daily-html.sh" >>"$LOG" 2>&1; then
  touch "$STAMP"
  log "OK daily scaffold for $DATE"
else
  log "ERROR new-daily-html.sh failed for $DATE"
  exit 1
fi
