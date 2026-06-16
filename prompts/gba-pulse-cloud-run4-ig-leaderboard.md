# GBA Pulse — Cloud Run 4: IG competitors benchmark

You are refreshing **`ig-leaderboard-data.json`** for the **IG Leaderboard** tab, then committing and pushing **`main`**.

## Goal

Capture public Instagram metrics for the six benchmark accounts in `references/ig-leaderboard-accounts.json`.

## Metrics per account

1. **Followers** — exact count from Instagram `web_profile_info` API
2. **Rolling 7-day follower growth %** — computed automatically during Google Sheet sync by comparing today's followers to the sheet row from **exactly 7 calendar days ago** (e.g. 15 Jun vs 8 Jun). Leave empty when that reference date is missing.
3. **Rolling 7-day posting cadence** — number of posts in the last 7 calendar days (HKT), counted by `scripts/fetch-ig-benchmark.mjs` via Instagram GraphQL timeline pagination

## Accounts (fixed order)

| Handle | Display name |
|--------|----------------|
| `scmpnews` | South China Morning Post |
| `tatlerhongkong` | Tatler HK |
| `the_trip_addict` | The Trip Addict |
| `sassyhongkong` | Sassy HK |
| `thebayasia` | The Bay |
| `greaterbayvibes` | Greater Bay Vibes |

## Steps

1. Run the automated fetch and merge (do **not** hand-count posts or write snapshot JSON yourself):

```bash
node scripts/capture-ig-leaderboard.mjs --refresh
```

This:
- Calls `scripts/fetch-ig-benchmark.mjs` (followers + paginated 7-day post count from Instagram APIs only)
- Merges `references/ig-leaderboard-manual-snapshot.json` only for handles the fetch could not capture
- Updates `ig-leaderboard-data.json` and syncs Google Sheet growth

2. If some handles failed (HTTP 429 / rate limit), **do not invent numbers**. Either:
   - Re-run the command once after a short wait, or
   - Update only the failed handles in `references/ig-leaderboard-manual-snapshot.json` with values you verified on the live profile, then re-run step 1.

   Do **not** set `followersGrowthPct7d` — it is derived from the Google Sheet log during sync.

3. Commit and push:

```bash
git add ig-leaderboard-data.json orchestration/ig-leaderboard-snapshot.json
git commit -m "daily: IG benchmark refresh $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
git push origin main
```

## Rules

- Do **not** edit `index.html` — the IG Leaderboard tab loads JSON via `ig-leaderboard-panel.js`.
- Do **not** manually write `orchestration/ig-leaderboard-snapshot.json` unless the fetch script is completely unavailable after retries.
- Use numbers from the script output; do not invent follower counts or post counts.
- Omit handles you cannot capture (existing history is preserved).
