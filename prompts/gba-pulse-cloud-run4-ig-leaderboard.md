# GBA Pulse — Cloud Run 4: IG competitor followers

You are refreshing **`ig-leaderboard-data.json`** for the **IG Leaderboard** tab (dedicated panel after Source Links), then committing and pushing **`main`**.

## Goal

Capture **public Instagram follower counts** (and estimated engagement if visible) for every account in `references/ig-leaderboard-accounts.json`. Write a snapshot file, run the merge script, commit, and push.

## Steps

1. Read `references/ig-leaderboard-accounts.json` for the account list (handles, URLs).

2. For **each** account, open the Instagram profile URL in the browser:
   - Record **followers** (exact integer from profile header)
   - Record **posts** count if shown
   - Record **engagement rate** only if a third-party analytics page shows it; otherwise omit

3. Write snapshot JSON to `orchestration/ig-leaderboard-snapshot.json`:

```json
{
  "discoverhongkong": { "followers": 716900, "engagementRate": 0.0101, "posts": 4200 },
  "visitmacao": { "followers": 250000 },
  "visit_singapore": { "followers": 829800 }
}
```

Keys must match `handle` values from the accounts config exactly.

4. Merge snapshot into history and regenerate data:

```bash
node scripts/capture-ig-leaderboard.mjs --snapshot=orchestration/ig-leaderboard-snapshot.json
```

5. Verify the output file exists and `updatedAt` is today (Asia/Hong_Kong).

6. Commit and push to `main`:

```bash
git add ig-leaderboard-data.json orchestration/ig-leaderboard-snapshot.json
git commit -m "daily: IG leaderboard refresh $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
git push origin main
```

## Rules

- Do **not** edit `index.html` — the IG Leaderboard tab loads JSON client-side via `ig-leaderboard-panel.js`.
- Do **not** invent follower counts — use numbers visible on the profile or reputable public analytics pages.
- If Instagram blocks login/bot access, browse each profile manually and record the follower count from the page header.
- Accounts without a successful capture should be omitted from the snapshot (existing history is preserved).

## Accounts tracked

Home (GBA): `discoverhongkong`, `visitmacao`  
Competitors: `visit_singapore`, `tourismthailand`, `visitjapanjp`, `visitkorea.kr`, `visitlondon`, `dubai`
