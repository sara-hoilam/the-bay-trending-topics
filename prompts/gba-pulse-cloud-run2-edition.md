# GBA Pulse — Cloud Run 2 (legacy): Trending News edition

> **Superseded** by `prompts/gba-pulse-cloud-run2-daily-brief.md`. The daily workflow now generates **THE BAY: Daily Brief** in the `overall` panel.

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). **Run 1** should already have committed fresh `trendwatch.html`.

## Deliverable

Produce **`orchestration/fragments/overall.html`** — merged **Trending News Top 10** — then merge into **`index.html`** and push **`main`**.

## Workflow (no Claude/Composer panels)

1. Open `orchestration/fragments/trendwatch.html` and parse `#trend-watch-data` JSON.
2. If `refreshedAt` is older than ~36 hours or `topicCandidates` is missing/empty, **stop** and report that Run 1 must be re-run.
3. Follow **`prompts/gba-pulse-curator-prompt.md`** and **`prompts/gba-pulse-trend-scoring.md`**:
   - Topic list **only** from Trend Watch / `topicCandidates` (hard gate — no news-first picking).
   - Self-audit table in an HTML comment at top of fragment.
   - For each topic: limited news search (≤48h) for headline, summary, **Interesting Angles** (2–3 question bullets).
4. Write **inner HTML only** to `orchestration/fragments/overall.html` (no `<html>`, `<head>`, outer `<main>`). Use classes from `templates/gba-pulse-template.html`.
5. Include: Top 10, Key Observations, Sources, Notes for Tomorrow.
6. Run:

   ```bash
   node scripts/merge-briefing-panels.mjs
   ```

7. **Commit and push to `main`** (no pull request):

   ```bash
   git add orchestration/fragments/overall.html index.html
   git commit -m "daily: Trending News edition $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
   git push origin main
   ```

Use `GITHUB_TOKEN` if needed for push.

## Do not

- Read or merge `claude.html`, `composer.html`, or `chatgpt.html`.
- Invent topics not on Trend Watch boards.
- Open PRs — push directly to `main`.

## Cost discipline

- Cap news lookups to what you need for the 10 topics (~2–3 searches per topic max).
- Do not re-capture Trend Watch boards in this run unless JSON is clearly broken.
