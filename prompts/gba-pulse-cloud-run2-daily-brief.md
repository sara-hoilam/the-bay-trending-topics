# GBA Pulse — Cloud Run 2: Daily Brief

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). **Run 1** should already have committed fresh `trendwatch.html`.

## Deliverable

Produce **today’s Daily Brief** markdown, convert it to the **📰 Daily Brief** panel (`overall` zone), merge into **`index.html`**, and push **`main`**.

## Workflow

0. **Editor feedback (on-demand only):** Do **not** run the editor comparison pipeline unless the user has invoked the **`gba-pulse-editor-feedback`** skill in this session. If `Training Data/editor-comparisons/digest/latest.md` and `references/editor-selection-weights.json` exist, attach them and apply weighted editor picks at Step 3 (Cluster & rank). If missing, proceed with default selection rules.

1. Read and follow **`prompts/daily-brief-agent-prompt.md`** (GBA scope, 124 approved domains, selection rules, **city balance** via `source-links-data.json` `region`, editor calibration when digest is present).
2. Use **today’s date in Asia/Hong_Kong** for the edition filename and audit block.
3. Live-scan approved sources (browser/tools) — do **not** invent URLs or recycle stale stories.
4. Write markdown to:

   `Training Data/YYYY-MM-DD-daily-brief.md`

   **Maximum 40 articles.** Complete the city-balance floors in the agent prompt (Shenzhen, Guangzhou, Foshan, Zhuhai, Dongguan, and any other nine-city Region with fresh news) before closing the edition. Also cover GBA News, Macao, HK, Nation, and GBA sport when warranted. Do not pad to 40.
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

- Follow scan order in the prompt. Do **not** stop at 30, and do not stop after Macao and Hong Kong. Finish the city-balance sweep (open each Guangdong city Region’s source URLs), then stop at **40** articles.
- Prefer outlet home/list pages over deep site-wide search.
- Cluster related stories; do not duplicate the same incident across sections.
