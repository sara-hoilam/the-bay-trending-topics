# SEO Ranks tab — install guide

A new **SEO Ranks** tab for GBA Pulse that tracks The Bay's Google rankings for four keywords: *Greater Bay Area*, *Greater Bay Area China*, *GBA* and *GBA China*.

For each keyword and market (Hong Kong, United States, Global) it shows:

- the current average Google position, and how it changed on the previous 7 days
- position over time as a line chart (28 days, 3 months, 12 months or all)
- which thebay.mo articles rank for the keyword, and each one's position
- who ranks above us: what kind of site it is, its rank, and a clickable link

It follows the same pattern as the IG Leaderboard: a JSON data file, a panel script, and a GitHub Actions job that refreshes the data.

---

## 1. Files to add (same paths as in the repo)

| File | What it does |
|---|---|
| `seo-rankings-panel.js` | Draws the tab. No libraries; styles use the site's CSS variables |
| `seo-rankings-data.json` | **Sample data** so the tab shows something before the first run. The first workflow run overwrites it |
| `references/seo-keywords.json` | The keywords and markets. Edit this to add next month's keyword |
| `scripts/capture-seo-rankings.mjs` | Pulls Search Console data and runs the Cursor competitor check |
| `scripts/verify-seo-rankings.mjs` | Checks the data file before it is committed |
| `prompts/gba-pulse-seo-competitors.md` | The read-only prompt the Cursor agent runs |
| `.github/workflows/seo-rankings.yml` | Runs daily at 10:30 HKT and commits the data |

The script reuses `scripts/hkt-date.mjs` and `scripts/cloud-sdk-utils.mjs`, which are already in the repo. `googleapis` and `@cursor/sdk` are already in `package.json`.

---

## 2. Edit `index.html` (four small changes)

**a. Add the tab button** inside `<div class="masthead-stripe" …>`, after the Source Links button:

```html
<button type="button" class="masthead-pill" role="tab" id="tab-seoranks" data-panel="seoranks" aria-selected="false" title="Google rank tracker for GBA keywords">SEO Ranks</button>
```

**b. Add the panel**, next to the other `model-panel` blocks (for example after `panel-igleaderboard`):

```html
<div id="panel-seoranks" class="model-panel" role="tabpanel" aria-labelledby="tab-seoranks" hidden>
  <main class="wrapper">
    <div class="seo-header">
      <h2>Google rank tracker</h2>
      <p class="seo-meta"><span id="seo-rankings-meta">Loading…</span></p>
    </div>
    <div id="seo-rankings-root"></div>
  </main>
</div>
```

**c. Load the script**, next to the other panel scripts:

```html
<script src="seo-rankings-panel.js?v=20260923a" defer></script>
```

**d. Allow the `#seoranks` link.** In the small tab-switching script near the end of the page, add `"seoranks"` to the list of allowed hashes:

```js
if (["overall", "claude", "composer", "chatgpt", "trendwatch", "happenings", "newhotels", "hotelpress", "igleaderboard", "sourcelinks", "seoranks"].indexOf(h) !== -1) show(h);
```

After this, `https://sara-hoilam.github.io/the-bay-trending-topics/#seoranks` opens the tab directly.

---

## Property

Search Console is the **URL-prefix** property `https://thebay.mo/`, which is the `site` value in `references/seo-keywords.json`. Leave the `GSC_SITE_URL` variable unset. Set it only if the property is later changed to the Domain property `sc-domain:thebay.mo`.

## Supabase history

The page still reads `seo-rankings-data.json`. Nothing in the browser talks to Supabase.

Each capture also upserts three tables (see `supabase/migrations/20260923093000_seo_rankings.sql`):

| Table | Primary key |
|---|---|
| `seo_rank_daily` | date, keyword, market |
| `seo_page_rank_daily` | date, keyword, market, page_url |
| `seo_competitor_snapshots` | checked_on, keyword, market, position |

If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, or the write fails, the job logs a warning and still commits the JSON.

Secrets to add on the repository:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Project URL, `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. Do not use the anon key. |

`GSC_CREDENTIALS` is optional. When it is absent the workflow uses `GOOGLE_SHEETS_CREDENTIALS`.

Apply the migration in the Supabase SQL editor (or CLI) before the first live run. Row level security is on. `anon` and `authenticated` have no grants.

## 3. Give the job access to Search Console

The repo already has a Google service account (used for the IG Leaderboard sheet). The simplest route is to reuse it.

1. Find the service account's email: the `client_email` field in the `GOOGLE_SHEETS_CREDENTIALS` JSON (it ends in `.iam.gserviceaccount.com`).
2. In Search Console, open the **https://thebay.mo/** property → **Settings → Users and permissions → Add user**. Paste that email and choose **Restricted** (read-only is enough).
3. In Google Cloud, in the project that owns the service account, enable the **Google Search Console API** (APIs & Services → Library).
4. Nothing else is needed. The workflow uses `GSC_CREDENTIALS` if you create it, otherwise it falls back to `GOOGLE_SHEETS_CREDENTIALS`.

This install uses the URL-prefix property, so do not set `GSC_SITE_URL`. If the property is later switched to a Domain property (`sc-domain:thebay.mo`), add a repository **variable** `GSC_SITE_URL` with that exact value. A mismatch returns 403.

---

## 4. First run

GitHub → **Actions → SEO rankings → Run workflow**, with *competitors* set to **always**.

- The first run backfills about 16 months of history (480 days), so the chart is populated straight away.
- It replaces the sample data. The yellow "Sample data" banner disappears.

After that it runs daily on its own. Search Console data is about 3 days behind, so "Search Console data to …" will always show a date 3 days back.

---

## 5. How the competitor check works — please read

Search Console only reports **our** pages. It cannot say who else ranks. So the competitor list comes from the Cursor cloud agent, using the `CURSOR_API_KEY` already in the repo:

- It runs **once a week** (Mondays HKT, or if the last check is older than 6 days) to control Cursor spend. Force it from the Run workflow menu.
- The prompt is **read-only**. The agent is told not to edit, commit or push anything, and to return JSON only.
- It tries to read Google's own results page for Hong Kong (`gl=hk`). If Google blocks it, it falls back to its web search tool and marks the result **"order estimated"**. The page footnote says which method was used.
- **Every link the agent returns is checked live.** Links that return 404, 410 or do not resolve are dropped, since they are likely invented. Links that block bots (403/429, e.g. SCMP) are kept.
- Competitors are checked for **Hong Kong only**. The US and Global views reuse the Hong Kong list and say so. To add the US, set `"competitors": true` on the `usa` market in `references/seo-keywords.json` (this doubles the Cursor runs).

**Limits worth knowing.** Competitor ranks are an AI estimate from one moment, one location and no login. They will sometimes differ from what a person sees in Google. Treat them as "who is in the neighbourhood", not exact positions. Our own positions are Search Console averages and are reliable.

If you later want exact, location-controlled competitor ranks, a paid SERP API (for example DataForSEO or SerpApi) is the usual upgrade. That would replace `runCompetitors()` in the capture script; the page would not need to change.

---

## 6. Adding next month's keyword

Edit `references/seo-keywords.json`:

```json
{ "keyword": "hong kong to shenzhen border crossing", "label": "HK–Shenzhen border crossing", "target": true, "since": "2026-10-21" }
```

- `keyword` must be **lowercase**, exactly as people search it. Search Console stores queries in lowercase and the filter is an exact match.
- Set `"target": true` on the keyword you are working on this month and `false` on the others. The target shows a red TARGET tag and opens by default.

The next run picks it up, including its history.

---

## 7. Local testing

```bash
npm install
GSC_CREDENTIALS="$(cat service-account.json)" node scripts/capture-seo-rankings.mjs --competitors=never --dry-run
node scripts/verify-seo-rankings.mjs
```

`--dry-run` prints a summary without writing. `SEO_URL_CHECK=off` skips the live link checks (debugging only).

---

## What was tested

- Panel rendered in Chromium at 1280px and 390px wide: no script errors and no horizontal scroll. Tested with the sample data and with output from the capture script.
- The capture script was run end to end against **mocked** Search Console and Cursor responses. That covered history backfill, 7-day vs prior-7-day maths, page titles, rejecting bad agent output (invalid URLs, out-of-range ranks, unknown types), keeping old competitor data when a check is skipped, and the verify step.
- **Not tested:** the real Search Console API and the real Cursor agent. That needs your credentials, so the first workflow run is the live test. If it fails, the log names the step.
