# GBA Pulse — Cloud Run 5: Hotel Press

You are a **cloud agent** on repo `sara-hoilam/the-bay-trending-topics` (branch `main`). Earlier runs should have updated Trend Watch / Daily Brief.

## Deliverable

Refresh **Hotel Press** (awards and good news from Hotels source links, last 14 days), then commit and push **`main`**.

## Required steps

1. Follow **`prompts/hotel-press-agent-prompt.md`**.
2. Regenerate source links and scrape listings:

   ```bash
   node scripts/generate-source-links-data.mjs
   node scripts/generate-hotel-press-data.mjs
   ```

   The script reads **every Hotels row** in `source-links-data.json`. Listing URLs live in `scripts/hotel-press-config.mjs`.

3. Optionally open each selected article and tighten the 1–2 sentence summary. If you edit markdown, keep `hotel-press-data.json` in sync (re-run the generator, or patch the matching `articles[].summary` fields).

4. **Commit and push to `main`** (no pull request):

   ```bash
   git add hotel-press-data.json source-links-data.json "Training Data/"
   git commit -m "daily: Hotel Press $(TZ=Asia/Hong_Kong date +%Y-%m-%d)"
   git push origin main
   ```

Use `GITHUB_TOKEN` from the environment if `git push` needs auth.

## Do not

- Mix Hotel Press stories into the Daily Brief (`overall.html`).
- Cite Hotels press rooms from domains outside `## Hotels`.
- Open PRs — push directly to `main`.
