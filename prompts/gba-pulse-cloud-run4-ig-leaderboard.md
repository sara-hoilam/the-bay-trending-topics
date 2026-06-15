# GBA Pulse — Cloud Run 4: IG competitors benchmark

You are refreshing **`ig-leaderboard-data.json`** for the **IG Leaderboard** tab, then committing and pushing **`main`**.

## Goal

Capture public Instagram metrics for the six benchmark accounts in `references/ig-leaderboard-accounts.json`.

## Metrics per account

1. **Followers** — exact count from profile header as of capture date
2. **Rolling 7-day follower growth %** — computed automatically during Google Sheet sync by comparing today's followers to the sheet row from **exactly 7 calendar days ago** (e.g. 15 Jun vs 8 Jun). Leave empty when that reference date is missing.
3. **Rolling 7-day posting cadence** — number of posts in the last 7 days from Instagram profile API

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

1. Read `references/ig-leaderboard-accounts.json`.

2. For each account, fetch from Instagram's API (or record from profile):
   - `followers` (integer)
   - `posts7d` (integer — posts in the last 7 days)

   Do **not** set `followersGrowthPct7d` — it is derived from the Google Sheet log during sync.

3. Write `orchestration/ig-leaderboard-snapshot.json`:

```json
{
  "scmpnews": { "followers": 648769, "posts7d": 30 },
  "tatlerhongkong": { "followers": 256204, "posts7d": 50 },
  "the_trip_addict": { "followers": 94494, "posts7d": 7 },
  "sassyhongkong": { "followers": 91246, "posts7d": 8 },
  "thebayasia": { "followers": 31696, "posts7d": 11 },
  "greaterbayvibes": { "followers": 17268, "posts7d": 8 }
}
```

4. Merge:

```bash
node scripts/capture-ig-leaderboard.mjs --snapshot=orchestration/ig-leaderboard-snapshot.json
```

5. Commit and push:

```bash
git add ig-leaderboard-data.json orchestration/ig-leaderboard-snapshot.json
git commit -m "daily: IG benchmark refresh $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
git push origin main
```

## Rules

- Do **not** edit `index.html` — the IG Leaderboard tab loads JSON via `ig-leaderboard-panel.js`.
- Use numbers visible on the profile; do not invent follower counts.
- Omit handles you cannot capture (existing history is preserved).
