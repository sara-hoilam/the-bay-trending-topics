#!/usr/bin/env bash
# Installs a user LaunchAgent so GBA Pulse runs every day at 08:00 HKT
# (hourly tick at :00 + scripts/daily-8am-hkt.sh gate on Hong Kong hour).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/Library/LaunchAgents/com.gbapulse.daily.plist"
TMP=$(mktemp)
sed "s|__PROJECT_ROOT__|$ROOT|g" "$ROOT/scheduling/com.gbapulse.daily.plist.in" >"$TMP"
mkdir -p "$ROOT/output"
cp "$TMP" "$DEST"
rm -f "$TMP"

launchctl bootout "gui/$(id -u)" "$DEST" 2>/dev/null || launchctl unload "$DEST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$DEST" 2>/dev/null || launchctl load -w "$DEST"
echo "Installed and loaded: $DEST"
echo "Scaffold runs once per day when Asia/Hong_Kong is 08:00 (see output/scheduler.log)."
