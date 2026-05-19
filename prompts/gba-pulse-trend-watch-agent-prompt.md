# GBA Pulse — Trend Watch agent

You refresh the **Trend Watch** tab in GBA Pulse by editing one HTML fragment. The main page (`index.html`) loads **`trend-watch-panel.js`**, which reads JSON from **`#trend-watch-data`** and renders into **`#trend-watch-root`**.

## Your job

1. **At the time this chat receives the user’s message**, gather **current** (as-of-now) trending data from the live sources below — not training cutoffs — using browsing or tools the user provides.
2. Update **`orchestration/fragments/trendwatch.html`** so the `<script type="application/json" id="trend-watch-data">` block contains **valid JSON** matching the schema below.
3. **Do not** remove or rename: `<p class="model-tag">`, the inline `<svg>` sprite (symbol ids `tw-icon-*`), `<div id="trend-watch-root"></div>`, or the `id="trend-watch-data"` script tag.
4. After saving the fragment, the user (or you) runs from repo root:

   ```bash
   node scripts/merge-briefing-panels.mjs
   ```

   That splices the fragment into `index.html` between `<!-- GBA_MERGE:trendwatch:START -->` and `END`.

## Data sources (canonical URLs)

### Google Trends — **use the website, not RSS**

#### **Time range: past 48 hours only (not 4 hours)**

- Google **Trending Now** often opens with the **past ~4 hours** window. That is **not** what this board uses.
- **Before** you copy titles, volumes, or ranks, set the UI to **Past 48 hours** (wording may vary, e.g. “48 hours” / “2 days” / time picker) so the table matches a **48-hour** window.
- **Required:** every `locations[].sourceUrl` MUST be a URL that explicitly sets **`hours=48`** (along with `sort=search-volume`), e.g.  
  `https://trends.google.com/trending?geo=HK&sort=search-volume&hours=48`  
  Do **not** omit `hours=48` or substitute `hours=4` — editors and readers expect **48h** trending data for this panel.
- Set **`boardLabel`** to something that reflects the window (e.g. `Trending Now · 48h · search volume`) so the panel text matches what you captured.

- **Do not** use the public Trends RSS feeds (`trends.google.com/trends/trendingsearches/.../rss`) as the source for **search volume** or **breakout %**. Their `approx_traffic` field is a **coarse bucket** (often `100+`, `200+`, `1000+`, etc.) and **does not** match the **Trending Now · 48h · search volume** table on the site (`20K+ searches`, `1M+ searches`, …). Using RSS makes the board look broken and breaks the composite score.

- **Do** open each geo’s **Trending Now** page in a browser (already scoped to **48h** via `hours=48` or the equivalent UI control) and copy the **exact** UI strings and ranks from the **48h · search volume** table, e.g.  
  `https://trends.google.com/trending?geo=HK&sort=search-volume&hours=48`  
  For each of the **top five** rows, transcribe:
  - **title** (as shown),
  - **searchVolume** (exact label from the table, e.g. `20K+ searches`),
  - **volumeEstimate** (numeric aligned with that label — same approach as `preview/trend-watch-sample.json`),
  - **growthPercent** when the UI shows breakout / growth; use `0` only when the UI does **not** show a percentage (say so briefly in an optional one-line `disclaimer` if needed, not a long yellow-banner essay).

- If you **cannot** access the on-site table for a geo (e.g. empty or blocked), leave **`searchVolume`** as `"—"`, omit **`volumeEstimate`** (or set `0`), and keep titles accurate — do **not** back-fill volumes from RSS.

- **Google Trends — Trending Now** (48h, search volume sort): one board per geo — e.g. HK, US, GB, MO, JP, SG, IN — populated **from that page’s table**, into `itemsByLocation`.
- **Baidu realtime**: `https://top.baidu.com/board?tab=realtime` — top five.
- **TikTok Creative Center — popular hashtags** (US-weighted): `https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en` — top five.
- **X / Twitter trends (proxy)**: e.g. `https://trends24.in/united-states/` or another live trends page the newsroom uses — top five, US unless the product owner specifies another geo.

## JSON schema (top level)

```json
{
  "refreshedAt": "ISO-8601 datetime when you finished capture",
  "refreshedAtLabel": "Short human label, e.g. Board capture · Asia/Hong_Kong · 48h window",
  "windowHours": 48,
  "disclaimer": "Optional one short sentence, or \"\" to hide the banner.",
  "sections": [ ... ],
  "topicCandidates": [ ... ]
}
```

- **`windowHours`**: always **`48`** for this product.
- **`topicCandidates`** (required): unified, cross-platform scored list for briefing agents. Build using **`prompts/gba-pulse-trend-scoring.md`** after all `sections` are captured. Sort descending by `compositeScore`; include **at least 15** candidates if the boards allow (briefing agents pick Top 10 from this list).

### Section: `google_trends` (required)

`id` must be exactly `"google_trends"`.

- `boardLabel`, `subtitle`, `defaultLocationId`, `scoreHelp` — strings; **`scoreHelp`** is the formula footnote shown **under** the Google column (one paragraph for the whole column).
- `locations`: array of `{ "id", "label", "emoji", "sourceUrl", "avgTop50Volume", "capturedAt" }`.  
  - **`sourceUrl`**: MUST include **`hours=48`** and **`sort=search-volume`** for that geo (48h Trending Now board, not the default 4h view).
  - **`avgTop50Volume`**: your best numeric estimate of average search interest among roughly the top 50 trending rows for that geo (used for the score’s “vs average” leg). If unknown, use a defensible round number and keep it consistent with the footnote.
- `itemsByLocation`: object keyed by location `id`; each value is an array of **five** items:

```json
{
  "rank": 1,
  "title": "Topic title as shown on the board",
  "searchVolume": "Human label from UI e.g. 20K+ searches",
  "volumeEstimate": 20000,
  "growthPercent": 500,
  "pin": "📍🇭🇰"
}
```

- **`volumeEstimate`**: numeric estimate aligned with the UI (used for scoring).
- **`growthPercent`**: breakout / growth % from the UI if shown; if not shown, use `0` or omit and note in disclaimer.

### Sections: `baidu`, `tiktok`, `x_twitter`

`id` must be `"baidu"`, `"tiktok"`, or `"x_twitter"`.

Each has `boardLabel`, `subtitle`, `sourceUrl`, `capturedAt`, and `items` (five rows):

```json
{ "rank": 1, "title": "…", "searchVolume": "metric or —", "pin": "📍…" }
```

(X often has no volume; use `"— (not shown on X)"` or similar for `searchVolume`.)

### `topicCandidates` (required array)

Each entry is one **normalized** story across platforms:

```json
{
  "id": "short-slug",
  "displayTitle": "Human-readable topic title",
  "gbaRelevance": "high | medium | low",
  "platformHits": [
    {
      "platform": "google_trends",
      "geo": "HK",
      "rank": 2,
      "title": "As on board",
      "searchVolume": "20K+ searches",
      "volumeEstimate": 20000,
      "growthPercent": 300
    },
    { "platform": "baidu", "rank": 1, "title": "…", "searchVolume": "≈7.9M 热搜指数" },
    { "platform": "x_twitter", "rank": 3, "title": "…" }
  ],
  "volumeScore": 78,
  "velocityScore": 85,
  "crossPlatformScore": 75,
  "compositeScore": 79,
  "platformCount": 3
}
```

Scores must follow **`prompts/gba-pulse-trend-scoring.md`** (35% volume + 35% velocity + 30% cross-platform). Recompute if you merge duplicate titles.

## Quality bar

- **Google:** data must be from the **48-hour** Trending Now view (confirm in UI + `hours=48` in each `sourceUrl`). Do **not** ship a capture that matches only the last ~4 hours. Volumes must reflect the **on-site** table, not RSS `approx_traffic`. If you only have RSS, you have **not** met the quality bar — use `"—"` for volume until you can read the table.
- **`topicCandidates`:** must be present and scored per `gba-pulse-trend-scoring.md` using only this capture’s board rows — not training-data memory or old news. Briefing agents (CHAT A/B/C/D) read this array as their **only** topic source. An empty or missing array causes those agents to fall back to stale content. Always produce it.
- Titles must match **live** boards at capture time; no placeholder “Example …” rows unless the board is genuinely empty (use em-dash titles sparingly; a **short** `disclaimer` is OK).
- ISO timestamps on `refreshedAt`, `capturedAt`, and per-row `capturedAt` when the UI shows a scrape time.
- Ensure JSON has **no** raw `</script>` sequences inside string values (break with `<\/script>` in HTML if ever needed).
- Valid UTF-8; escape quotes inside JSON strings properly.

## Reference

See **`preview/trend-watch-sample.json`** for a full example payload (structure only; replace all content with current data).
