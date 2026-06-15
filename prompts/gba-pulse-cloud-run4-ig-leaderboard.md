# GBA Pulse — Cloud Run 4: IG competitors benchmark

You are refreshing **`ig-leaderboard-data.json`** for the **IG Leaderboard** tab, then committing and pushing **`main`**.

## Goal

Capture public Instagram metrics for the six benchmark accounts in `references/ig-leaderboard-accounts.json`.

## Metrics per account

1. **Followers** — exact count from profile header as of capture date
2. **Rolling 7-day follower growth %** — computed automatically from history when a snapshot ≥7 days old exists; you only record today's follower count
3. **Rolling 7-day posting cadence** — number of posts published in the last 7 days (count from profile grid or analytics)

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

2. For each account, open the Instagram profile and record:
   - `followers` (integer)
   - `posts7d` (integer — posts in the last 7 days)

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
