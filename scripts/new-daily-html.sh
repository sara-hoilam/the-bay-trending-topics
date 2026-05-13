#!/usr/bin/env bash
# Creates output/gba-pulse-YYYY-MM-DD.html from the HTML template with today's HKT date/time.
# Usage: ./scripts/new-daily-html.sh [YYYY-MM-DD] [optional time string]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE="${1:-$(TZ=Asia/Hong_Kong date +%Y-%m-%d)}"
TIME="${2:-$(TZ=Asia/Hong_Kong date +'%H:%M HKT')}"
OUT_DIR="$ROOT/output"
mkdir -p "$OUT_DIR"
DEST="$OUT_DIR/gba-pulse-$DATE.html"
sed -e "s/REPLACE_ME_DATE/$DATE/g" -e "s/REPLACE_ME_TIME/$TIME/g" "$ROOT/templates/gba-pulse-template.html" > "$DEST"
echo "Wrote $DEST"
