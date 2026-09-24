# GBA Pulse — Cloud Run 2: Daily Brief

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). **Run 1** should already have committed fresh `trendwatch.html`.

## Deliverable

Produce **today’s Daily Brief** markdown, convert it to the **📰 Daily Brief** panel (`overall` zone), merge into **`index.html`**, and push **`main`**.

## Workflow

0. **Editor feedback (on-demand only):** Do **not** run the editor comparison pipeline unless the user has invoked the **`gba-pulse-editor-feedback`** skill in this session. If the June digest and `references/editor-selection-weights.json` exist, use them only to break ties **inside** a band. Region counts and the hard / lifestyle / award mix come from **Sep2026-training-data**.

1. Read and follow **`prompts/daily-brief-agent-prompt.md`** and **`references/Sep2026-training-data.md`** (100-candidate pool, maximum 40 stories, colleague band targets, 34 hard / 5 lifestyle / 1 award). Do not fit selection on past automated briefs in `Training Data/`.
2. Use **today’s date in Asia/Hong_Kong** for the edition filename and audit block.
3. Live-scan approved sources (browser/tools) — do **not** invent URLs or recycle stale stories.
4. Write markdown to:

   `Training Data/YYYY-MM-DD-daily-brief.md`

   **Maximum 40 articles** at the Sep2026-training-data targets: Hong Kong 9, Shenzhen 8, Macao 8, Nation 4, Around the World 4, GBA News 3, Guangzhou 2, Zhuhai inc. Hengqin 2. Types: 34 hard news, 5 lifestyle, 1 award. Do not pad.
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

- Build a candidate pool of **100** from the scan order and Source Links regions, then stop the published edition at **40**. Do not stop the pool once Macao and Hong Kong are full.
- Prefer outlet home/list pages over deep site-wide search.
- Cluster related stories; do not duplicate the same incident across sections.
