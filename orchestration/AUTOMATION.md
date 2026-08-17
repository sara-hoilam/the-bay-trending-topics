# GBA Pulse — daily cloud automation (06:00 HKT scheduled, ~08:30 start after queue)

Runs on **GitHub Actions** — your Mac can be off. Uses **Cursor Cloud agents** with **Composer 2.5 Standard** (~$0.35–0.50 per day target).

## What is a PR?

A **Pull Request (PR)** is a GitHub proposal: “merge this branch into `main` after review.”  
This automation **does not use PRs** — agents **push directly to `main`**, and GitHub Pages serves `index.html`.

## Pipeline (2 cloud runs)

| Step | Script / agent | Output |
|------|----------------|--------|
| 1 | `prompts/gba-pulse-cloud-run1-trendwatch.md` | `orchestration/fragments/trendwatch.html` |
| 2 | `prompts/gba-pulse-cloud-run2-edition.md` | `overall.html` + `node scripts/merge-briefing-panels.mjs` → `index.html` |
| Fallback | Workflow merges again if the agent skipped merge | `index.html` |

Skipped in automation: `claude.html`, `composer.html`, `chatgpt.html`.

## One-time setup

1. **GitHub repo:** [sara-hoilam/the-bay-trending-topics](https://github.com/sara-hoilam/the-bay-trending-topics)

2. **Secret `CURSOR_API_KEY`**  
   [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) → create API key →  
   Repo **Settings → Secrets and variables → Actions → New repository secret**

3. **Connect repo to Cursor Cloud**  
   In Cursor team settings, ensure `the-bay-trending-topics` is an allowed GitHub repo for cloud agents.

4. **GitHub Pages** (if not already)  
   Settings → Pages → deploy from branch `main`, folder `/` (root `index.html`).

5. **IG Leaderboard Google Sheet (optional)**  
   See `references/ig-leaderboard-google-sheet.md` — share the sheet with a service account and set `GOOGLE_SHEETS_IG_LEADERBOARD_ID` + `GOOGLE_SHEETS_CREDENTIALS` secrets.

6. **Optional:** restrict who can push to `main` (branch protection) but allow `gba-pulse-bot` / Actions.

## Manual test

```bash
export CURSOR_API_KEY="cursor_..."
export GITHUB_TOKEN="ghp_..."   # optional; cloud agent uses for push
npm install
node scripts/run-daily-cloud.mjs
```

Or: **Actions → Daily GBA Pulse** → **Run workflow** (workflow file: `daily-gba-pulse.yml`).

**Confirm you’re on the fixed workflow:** open the run → check the commit is **`f663bbb` or newer** → after Cloud agents the step must be **`Sync latest main after cloud agent`**, not `Pull agent commits`. If you still see the old step name, cancel in-progress runs and use **Daily GBA Pulse** (not the retired `daily-8am-hkt.yml` workflow).

Single step:

```bash
node scripts/run-daily-cloud.mjs --run=1
node scripts/run-daily-cloud.mjs --run=2
```

## Schedule

- **Cron:** `0 22 * * *` UTC = **06:00 Asia/Hong_Kong** (GitHub queue delay usually pushes actual start to ~08:30 HKT; job runtime ~10–20 min)
- Workflow file: `.github/workflows/daily-gba-pulse.yml`

## Cost (~$0.50 / day)

- **Composer 2.5 Standard:** ~$0.50/M input, ~$2.50/M output ([pricing](https://cursor.com/docs/models/cursor-composer-2-5))
- **2 runs** (boards + edition only) with capped news searches → ~600k–1M input + ~40–60k output → **~$0.35–0.50** API-style
- Individual plans may use **included Composer pool** — check **Cursor → Usage** after the first run

Do **not** enable Fast tier in the workflow (`composer-2.5` Fast is ~6× more expensive).

## Troubleshooting

### `Startup failed: Error (retryable=false)`

This happens **before** the agent runs. Almost always:

1. **GitHub not connected to Cursor** for cloud agents  
   - [cursor.com/dashboard](https://cursor.com/dashboard) → connect **GitHub**  
   - Enable access to **`sara-hoilam/the-bay-trending-topics`** (org/repo picker)

2. **Bad `CURSOR_API_KEY`** — create a **User API key** at [Integrations](https://cursor.com/dashboard/integrations); no quotes/spaces in the secret.

3. **Repo not in connected list** — run locally:

   ```bash
   export CURSOR_API_KEY="cursor_..."
   npm run daily:diagnose
   ```

   You should see `✓ Target repo is connected`. If not, fix GitHub permissions in Cursor first.

4. Re-run with full error detail:

   ```bash
   npm run daily:cloud
   ```

   (Preflight now prints `code`, `status`, `helpUrl` when the SDK provides them.)

| Symptom | Fix |
|---------|-----|
| Workflow green but site old | Hard-refresh; confirm Pages source is `main` |
| `refreshedAt` stale | Re-run Run 1; check agent logs in Cursor dashboard |
| `exit code 128` on refresh | Usually `git pull`/`git push` auth. Workflow uses `github.token` — **delete** any repo secret named `GITHUB_TOKEN` if you created one (blank secret breaks git). Re-run workflow after pushing workflow fix. |
| Push failed | Workflow needs `permissions: contents: write`; disable branch rules blocking `github-actions[bot]` |
| Weibo rows `—` | Expected sometimes; agent may need mirror URL in disclaimer |
| **Cloud Run 3/4 `exit code 2`** (~5–10s) | Cursor cloud agent returned `status: error` early — often transient after prior runs, or a premature SDK poll while the agent is still setting up. **Not** a Happenings/Instagram script failure. Check run id in [Cursor dashboard](https://cursor.com/dashboard). Runs 3–4 are optional so post-pipeline still runs. |
| **Workflow red but Happenings commit on `main`** | Same premature `status: error`: the SDK reported failure in ~7s while the cloud agent continued and pushed. Confirm with `git log` / Cursor agent URL; re-run workflow or post-pipeline for IG + merge if those steps were skipped. |
| **`[resource_exhausted]` / HTTP 429 on Cloud Run 1** | Rate/quota limit on `POST /v1/agents` — **not** an expired API key (preflight already passed). Check [Usage](https://cursor.com/dashboard): Composer can show headroom while agent create is blocked (Other Models 100%, on-demand spend off/capped, or short-window capacity). Re-run after spend is enabled or the window resets. |

### Cloud Run 3 (Happenings) or Run 4 (IG) fails after Runs 1–2 succeed

Runs 1–2 take 2–6 minutes each; Run 3/4 failing in **under 15 seconds** means the **Cursor cloud agent aborted early** (or the SDK reported `error` before work finished), before the refresh scripts could complete inside that agent.

**Why the workflow used to fail entirely:** `run-daily-cloud.mjs` called `process.exit(2)` on any agent `status: error`, which skipped later cloud runs and the post-pipeline step.

**Fallback:** `scripts/run-daily-post.mjs` runs `generate-happenings-data.mjs` and `capture-ig-leaderboard.mjs --refresh` with Google Sheet secrets — the reliable path in GitHub Actions even when Cloud Runs 3–4 fail.


## Mac scheduler (legacy)

`scheduling/install-launchd.sh` only creates `output/gba-pulse-YYYY-MM-DD.html` — **not** this cloud pipeline.
