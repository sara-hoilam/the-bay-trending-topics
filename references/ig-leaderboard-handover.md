# IG Leaderboard — Instagram API & Google Sheets Handover

Handover guide for setting up the **GBA Pulse IG Competitors Benchmark** in a new project: live Instagram metrics, daily JSON for the site, and a Google Sheet audit log.

**Source repo:** `sara-hoilam/the-bay-trending-topics`  
**Timezone:** All dates use **Asia/Hong_Kong (HKT)**.

---

## 1. What this system does

| Output | Purpose |
|--------|---------|
| `ig-leaderboard-data.json` | Powers the **IG Leaderboard** tab on the site (`ig-leaderboard-panel.js`) |
| Google Sheet **GBA Pulse IG Leaderboard Log** | Daily row-per-account log for history and 7-day follower growth % |
| `orchestration/ig-leaderboard-snapshot.json` | Intermediate fetch result (debug / cloud agent) |

### Metrics per account

| Metric | JSON field | Sheet column | How it is computed |
|--------|------------|--------------|-------------------|
| Followers | `followers` | `followers` | Instagram profile API |
| 7-day follower growth % | `followersGrowthPct7d` | `followers_growth_pct_7d` | **Sheet history only** — today vs exactly 7 calendar days ago |

Growth % is **not** fetched from Instagram. It is calculated during sheet sync from prior rows.

---

## 2. Architecture overview

```
Daily automation (choose one or both)
│
├─ Cloud Run 4 (Cursor agent)
│    node scripts/capture-ig-leaderboard.mjs --refresh
│    → commit ig-leaderboard-data.json
│
└─ GitHub Actions post-pipeline (run-daily-post.mjs)
     → capture-ig-leaderboard.mjs --refresh
     → sync-ig-leaderboard-sheet.mjs
     → commit artifacts

capture-ig-leaderboard.mjs --refresh
  │
  ├─ fetch-ig-benchmark.mjs          ← Instagram profile API (followers)
  │     └─ GET  i.instagram.com/api/v1/users/web_profile_info/
  │
  ├─ references/ig-leaderboard-manual-snapshot.json   (followers-only fallback)
  ├─ ig-leaderboard-data.json                         (site data)
  └─ sync-ig-leaderboard-sheet.mjs                    (Google Sheet upsert)
```

### Key files to copy into a new project

| File | Role |
|------|------|
| `scripts/fetch-ig-benchmark.mjs` | Instagram follower fetch |
| `scripts/capture-ig-leaderboard.mjs` | Merge fetch → JSON |
| `scripts/sync-ig-leaderboard-sheet.mjs` | Push rows to Google Sheet |
| `scripts/ig-leaderboard-utils.mjs` | Shared helpers |
| `scripts/hkt-date.mjs` | HKT date helpers |
| `references/ig-leaderboard-accounts.json` | Account list |
| `references/ig-leaderboard-manual-snapshot.json` | Followers-only emergency fallback |
| `ig-leaderboard-panel.js` | Frontend table |
| `ig-leaderboard-data.json` | Generated data (committed daily) |
| `.github/workflows/daily-gba-pulse.yml` | Daily pipeline (optional) |
| `.github/workflows/ig-leaderboard-sheet-sync.yml` | Manual sheet sync workflow |

### npm scripts

```bash
npm run ig:refresh      # fetch Instagram + update JSON + sync sheet
npm run ig:capture      # merge existing snapshot only (no fetch)
npm run ig:sheet-sync   # push current JSON to sheet only
```

---

## 3. Instagram API setup

This project uses **Instagram's public web APIs** (the same endpoints the instagram.com web app calls). There is **no Meta developer app**, **no OAuth token**, and **no third-party analytics service**.

### 3.1 Endpoints used

| Step | Endpoint | Returns |
|------|----------|---------|
| Profile | `GET https://i.instagram.com/api/v1/users/web_profile_info/?username={handle}` | Follower count, user `id` |
| Post feed | `GET https://www.instagram.com/api/v1/feed/user/{user_id}/?count=50&max_id={cursor}` | Post timestamps for 7d / today counts |
| Fallback | `GET https://www.instagram.com/graphql/query/?doc_id=…` | Used only if feed API fails |

### 3.2 Required request headers

```http
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15
X-IG-App-ID: 936619743392459
Accept: */*
Referer: https://www.instagram.com/{handle}/
```

`X-IG-App-ID` is Instagram's public web app identifier (not a secret).

### 3.3 Accounts configuration

Edit `references/ig-leaderboard-accounts.json`:

```json
{
  "accounts": [
    {
      "handle": "thebayasia",
      "displayName": "The Bay",
      "url": "https://www.instagram.com/thebayasia/",
      "highlight": true
    }
  ]
}
```

### 3.4 Manual test

```bash
node scripts/fetch-ig-benchmark.mjs
cat orchestration/ig-leaderboard-snapshot.json
```

**Success** looks like:

```json
{
  "notes": [
    "thebayasia: 31,748 followers (instagram-api)"
  ],
  "accounts": {
    "thebayasia": {
      "followers": 31748
    }
  }
}
```

Full pipeline test:

```bash
node scripts/capture-ig-leaderboard.mjs --refresh
```

### 3.5 Rate limits (HTTP 429) — important

Instagram blocks aggressive automated requests, especially from:

- GitHub Actions runners
- Cloud agent VMs
- Datacenter IPs

**Symptoms:**

- Snapshot notes: `fetch failed (HTTP 429)`
- `accounts: {}` in snapshot
- Follower counts may show **stale** values from manual snapshot or prior history

**Mitigations:**

| Approach | Notes |
|----------|-------|
| Run from a residential IP | `npm run ig:refresh` on a local Mac often works |
| Retry later | Daily cloud run may succeed when rate limit resets |
| Manual followers fallback | Update `references/ig-leaderboard-manual-snapshot.json` (**followers only**) |

**Manual snapshot format (followers only):**

```json
{
  "accounts": {
    "thebayasia": { "followers": 31748 }
  }
}
```

### 3.6 Maintenance notes

- Profile API (`web_profile_info`) is the sole data source as of mid-2026.

---

## 4. Google Sheets setup

### 4.1 Create the spreadsheet

1. Create a Google Sheet named e.g. **GBA Pulse IG Leaderboard Log**
2. Add a tab: **`Daily_Datalog`**
3. Copy the spreadsheet ID from the URL:

   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

   Example ID: `1s0A-UcME3_-DykkHPNwZFjnTdXEfGsaj5BLV-uxm_-k`

### 4.2 Google Cloud service account

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services**
2. Enable **Google Sheets API**
3. **Credentials → Create credentials → Service account**
   - Name: e.g. `gba-pulse-sheets`
4. Service account → **Keys → Add key → JSON**
5. Save the JSON file securely — **never commit to git**

Copy the service account email, e.g.:

`gba-pulse-sheets@your-project.iam.gserviceaccount.com`

### 4.3 Share the sheet

1. Open the spreadsheet → **Share**
2. Add the service account email as **Editor**

Without this step you get: `Requested entity was not found` or permission errors.

### 4.4 Sheet columns (written automatically)

On first sync, the script writes this header if missing:

| Column | Description |
|--------|-------------|
| `date` | HKT date of capture (`YYYY-MM-DD`) |
| `handle` | Instagram username |
| `display_name` | Friendly name |
| `followers` | Integer follower count |
| `followers_growth_pct_7d` | % change vs row from 7 calendar days ago (empty if no ref row) |
| `captured_at` | ISO timestamp of refresh |

**Upsert behaviour:** If rows for today's date already exist, they are deleted and re-appended (no duplicates).

### 4.5 GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `GOOGLE_SHEETS_IG_LEADERBOARD_ID` | Spreadsheet ID from §4.1 |
| `GOOGLE_SHEETS_IG_TAB` | `Daily_Datalog` (optional if using this exact name) |
| `GOOGLE_SHEETS_CREDENTIALS` | Full JSON contents of the service account key file |

You may reuse `GOOGLE_DRIVE_CREDENTIALS` instead of `GOOGLE_SHEETS_CREDENTIALS` if it is the same service account.

### 4.6 Local sheet sync test

```bash
export GOOGLE_SHEETS_IG_LEADERBOARD_ID="your-spreadsheet-id"
export GOOGLE_SHEETS_IG_TAB="Daily_Datalog"
export GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account",...}'

# Preview rows without writing
node scripts/sync-ig-leaderboard-sheet.mjs --dry-run

# Write to sheet
node scripts/sync-ig-leaderboard-sheet.mjs
```

**Success log:**

```
Appended 9 row(s) to Daily_Datalog for 2026-06-17 (sheet …)
```

If secrets are missing, sync is skipped with a log message — the JSON refresh still succeeds.

### 4.7 How 7-day follower growth % works

1. Sheet sync reads all existing rows
2. For each account, finds today's followers and the row from **exactly 7 calendar days ago** (e.g. 16 Jun vs 9 Jun)
3. Computes: `((today - ref) / ref) * 100`
4. Writes growth back to both the sheet **and** `ig-leaderboard-data.json`

Growth stays **empty** for the first ~7 days until history exists for the reference date.

---

## 5. Automation wiring

### 5.1 Daily post-pipeline (GitHub Actions)

In `scripts/run-daily-post.mjs`:

```javascript
run("capture-ig-leaderboard.mjs", ["--refresh"]);
```

The daily workflow passes sheet secrets to the post-pipeline step:

```yaml
env:
  GOOGLE_SHEETS_IG_LEADERBOARD_ID: ${{ secrets.GOOGLE_SHEETS_IG_LEADERBOARD_ID }}
  GOOGLE_SHEETS_IG_TAB: ${{ secrets.GOOGLE_SHEETS_IG_TAB }}
  GOOGLE_SHEETS_CREDENTIALS: ${{ secrets.GOOGLE_SHEETS_CREDENTIALS }}
run: node scripts/run-daily-post.mjs
```

### 5.2 Cloud Run 4 (Cursor agent)

Prompt: `prompts/gba-pulse-cloud-run4-ig-leaderboard.md`

Agent runs:

```bash
node scripts/capture-ig-leaderboard.mjs --refresh
git add ig-leaderboard-data.json orchestration/ig-leaderboard-snapshot.json
git commit -m "daily: IG benchmark refresh $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
git push origin main
```

### 5.3 Manual workflow trigger

**Actions → IG Leaderboard Sheet Sync → Run workflow**

Runs `npm run ig:refresh` (fetch + JSON + sheet) with secrets injected.

---

## 6. New project checklist

### Instagram

- [ ] Copy scripts: `fetch-ig-benchmark.mjs`, `capture-ig-leaderboard.mjs`, `ig-leaderboard-utils.mjs`, `hkt-date.mjs`
- [ ] Copy `references/ig-leaderboard-accounts.json` and customise handles
- [ ] Copy `ig-leaderboard-panel.js` + wire into `index.html`
- [ ] Seed empty `ig-leaderboard-data.json` or run first refresh
- [ ] Test: `node scripts/capture-ig-leaderboard.mjs --refresh`
- [ ] Confirm snapshot notes include follower counts per handle

### Google Sheets

- [ ] Create spreadsheet + `Daily_Datalog` tab
- [ ] Enable Google Sheets API in Cloud Console
- [ ] Create service account + download JSON key
- [ ] Share sheet with service account (Editor)
- [ ] Add GitHub secrets (`GOOGLE_SHEETS_IG_LEADERBOARD_ID`, `GOOGLE_SHEETS_IG_TAB`, `GOOGLE_SHEETS_CREDENTIALS`)
- [ ] Test: `node scripts/sync-ig-leaderboard-sheet.mjs --dry-run`
- [ ] Confirm 9 rows appended per daily run

### Automation

- [ ] Add `ig:refresh` / `ig:sheet-sync` to `package.json`
- [ ] Wire `--refresh` into daily post-pipeline
- [ ] (Optional) Add `ig-leaderboard-sheet-sync.yml` workflow
- [ ] (Optional) Add Cloud Run 4 prompt for Cursor agent

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `fetch failed (HTTP 429)` | Instagram rate limit | Retry from residential IP or wait for daily run |
| `Requested entity was not found` | Wrong sheet ID or service account not shared | Check ID + share sheet as Editor |
| Growth % always empty | Fewer than 7 days of sheet rows | Normal for first week |
| Sheet sync skipped | Missing env secrets | Add GitHub secrets or export locally |
| Stale follower counts | Manual snapshot outdated | Update `ig-leaderboard-manual-snapshot.json` followers only |

---

## 8. Security

- **Never commit** service account JSON or paste it in chat
- Store credentials only in GitHub Actions secrets or local env vars
- Instagram setup uses public web endpoints — no user passwords or tokens required
- Manual snapshot is a last-resort fallback, not the primary data source

---

## 9. Related docs in this repo

| Doc | Path |
|-----|------|
| Sheet setup (short) | `references/ig-leaderboard-google-sheet.md` |
| Cloud agent prompt | `prompts/gba-pulse-cloud-run4-ig-leaderboard.md` |
| Daily automation overview | `orchestration/AUTOMATION.md` |

---

*Last updated: June 2026 — followers-only leaderboard; post metrics removed.*
