# GBA Pulse — Cloud Run 1: Trend Watch capture

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). Complete this run in one session.

## Deliverable

Update **`orchestration/fragments/trendwatch.html`** with a fresh **48-hour** board capture and scored **`topicCandidates`**.

Read and follow:

- `prompts/gba-pulse-trend-watch-agent-prompt.md`
- `prompts/gba-pulse-trend-scoring.md`
- `references/source-links.md` (board URLs)

## Required steps

1. Capture **live** boards (browser/tools), not training memory:
   - Google Trends Trending Now: HK, US, GB, MO, JP, SG, IN — **`hours=48`** in URL and UI
   - Baidu realtime, Weibo `cate=realtimehot`, X via trends24 US
2. Fill `sections[]`; build **`topicCandidates`** (≥15 if possible), sorted by `compositeScore`.
3. Set `refreshedAt` to current ISO time (Asia/Hong_Kong), `windowHours: 48`, `disclaimer: ""`.
4. Keep unchanged: `model-tag`, `<svg>` sprite (`tw-icon-*`), `#trend-watch-root`, `#trend-watch-data` script tag.
5. Run from repo root:

   ```bash
   node scripts/merge-briefing-panels.mjs
   ```

6. **Commit and push to `main`** (no pull request):

   ```bash
   git add orchestration/fragments/trendwatch.html index.html
   git commit -m "daily: Trend Watch capture $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
   git push origin main
   ```

Use `GITHUB_TOKEN` from the environment if `git push` needs auth.

## Do not

- Edit `claude.html`, `composer.html`, `chatgpt.html`, or `overall.html` in this run.
- Use Google Trends RSS for volumes.
- Use Google’s default ~4h window.

## Cost discipline

- Prefer on-site tables over long news searches.
- One capture pass per board; avoid redundant searches.
