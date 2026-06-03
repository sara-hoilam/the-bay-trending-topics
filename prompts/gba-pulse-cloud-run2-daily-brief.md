# GBA Pulse — Cloud Run 2: Daily Brief

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). **Run 1** should already have committed fresh `trendwatch.html`.

## Deliverable

Produce **today’s Daily Brief** markdown, convert it to the **📰 Daily Brief** panel (`overall` zone), merge into **`index.html`**, and push **`main`**.

## Workflow

1. Read and follow **`prompts/daily-brief-agent-prompt.md`** (GBA scope, 120 approved domains, selection rules).
2. Use **today’s date in Asia/Hong_Kong** for the edition filename and audit block.
3. Live-scan approved sources (browser/tools) — do **not** invent URLs or recycle stale stories.
4. Write markdown to:

   `Training Data/YYYY-MM-DD-daily-brief.md`

   Target **18–24 articles** across GBA News, Macao, HK, Zhuhai/Hengqin, Guangzhou, Shenzhen, other cities, Nation, GBA sport (as warranted).
5. Convert and merge:

   ```bash
   node scripts/daily-brief-to-html.mjs --input="Training Data/YYYY-MM-DD-daily-brief.md" --merge
   ```

6. **Commit and push to `main`** (no pull request):

   ```bash
   git add "Training Data/YYYY-MM-DD-daily-brief.md" orchestration/fragments/overall.html index.html
   git commit -m "daily: Daily Brief $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
   git push origin main
   ```

Use `GITHUB_TOKEN` from the environment if `git push` needs auth.

## Do not

- Edit `trendwatch.html`, `claude.html`, `composer.html`, or `chatgpt.html` in this run.
- Use domains outside `references/daily-brief-source-domains.md`.
- Open PRs — push directly to `main`.

## Cost discipline

- Follow scan order in the prompt; stop when the edition is full.
- Prefer outlet home/list pages over deep site-wide search.
- Cluster related stories; do not duplicate the same incident across sections.
