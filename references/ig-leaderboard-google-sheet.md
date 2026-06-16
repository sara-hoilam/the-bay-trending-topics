# IG Leaderboard → Google Sheets daily log

Each daily refresh appends one row per account to **GBA Pulse IG Leaderboard Log** (`Daily_Datalog` tab). If today's date already exists, those rows are deleted first (no duplicates).

## One-time setup

### 1. Enable Google Sheets API
In Google Cloud Console → **APIs & Services** → enable **Google Sheets API** (you've done this).

### 2. Create a service account key
1. **APIs & Services → Credentials → Create credentials → Service account**
2. Name it e.g. `gba-pulse-sheets`
3. Open the service account → **Keys → Add key → Create new key → JSON**
4. Save the downloaded JSON file securely (do not commit it to git)

Copy the service account email, e.g. `gba-pulse-sheets@the-bay-data-platform.iam.gserviceaccount.com`.

### 3. Share the spreadsheet
1. Open **GBA Pulse IG Leaderboard Log**
2. **Share** → add the service account email as **Editor**
3. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

### 4. Prepare the tab
Tab name: **`Daily_Datalog`** (or set `GOOGLE_SHEETS_IG_TAB`).

The sync script writes the header automatically on first run:

| date | handle | display_name | followers | followers_growth_pct_7d | posts_7d | posts_today | captured_at |

### 5. GitHub Actions secrets
Repo **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|--------|
| `GOOGLE_SHEETS_IG_LEADERBOARD_ID` | Spreadsheet ID from step 3 |
| `GOOGLE_SHEETS_IG_TAB` | `Daily_Datalog` (optional if using this name) |
| `GOOGLE_SHEETS_CREDENTIALS` | Full contents of the service account JSON file |

You can reuse `GOOGLE_DRIVE_CREDENTIALS` instead of `GOOGLE_SHEETS_CREDENTIALS` if it's the same service account.

### 6. Test locally
```bash
export GOOGLE_SHEETS_IG_LEADERBOARD_ID="your-spreadsheet-id"
export GOOGLE_SHEETS_IG_TAB="Daily_Datalog"
export GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account",...}'
node scripts/sync-ig-leaderboard-sheet.mjs --dry-run
node scripts/sync-ig-leaderboard-sheet.mjs
```

## When it runs

- After `capture-ig-leaderboard.mjs` in the daily post-pipeline
- After `npm run ig:refresh`

If secrets are missing, sync is skipped with a log message (refresh still succeeds).

## Metrics sources

| Column | Source |
|--------|--------|
| `followers` | Instagram `web_profile_info` API (`scripts/fetch-ig-benchmark.mjs`) |
| `posts_7d` | Instagram GraphQL timeline pagination — posts in the last 7 calendar days (HKT) |
| `posts_today` | Instagram GraphQL timeline pagination — posts on the update date (HKT) |
| `followers_growth_pct_7d` | **Google Sheet history** — compares today vs exactly 7 calendar days ago (e.g. 15 Jun vs 8 Jun). Empty if the reference date has no row for that handle. |

Growth is written to both the sheet and `ig-leaderboard-data.json` during sheet sync.
