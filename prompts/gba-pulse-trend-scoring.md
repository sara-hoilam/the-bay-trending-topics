# GBA Pulse — Trend Watch scoring (for briefing selection)

Use this **after** Trend Watch data is captured in `orchestration/fragments/trendwatch.html` (JSON inside `#trend-watch-data`). Briefing agents (Claude / Composer / GPT / Live Edition merger) **must** rank stories from this process—not from stale news search alone.

## Time window (hard rule)

- **Discovery window: last 48 hours only.**  
  Google rows must come from **Trending Now · 48h** (`hours=48`). Baidu realtime, TikTok, and X are “right now” boards—treat them as within the same 48h edition.
- **Do not** promote a topic whose **only** evidence is news articles **older than 48 hours** and **not** present on any Trend Watch board at capture time.
- **Verification news** may be older only as **background** (one line max); the **headline story** must explain why it is trending **now** (48h search/social spike).

## Step 1 — Build a unified candidate list

From the Trend Watch JSON `sections` (and optional `topicCandidates` if already filled):

1. Collect every row from:
   - `google_trends` → all geos in `itemsByLocation` (prioritize **HK**, **MO**, **US**, **GB**, **SG**, **JP**, **IN** for GBA editorial mix)
   - `baidu`, `tiktok`, `x_twitter` → each `items[]`
2. **Normalize** titles into one topic per real-world story (merge synonyms, hashtags, translations, e.g. `Trump Xi` ≈ `中美元首`, `#HZMB` ≈ `港珠澳大橋`).
3. Skip empty rows (`title` is `—` or blank).
4. Record **platform hits** per candidate: platform id, geo (if any), rank, raw title, `volumeEstimate`, `growthPercent`, `searchVolume`.

## Step 2 — Score each candidate (0–100)

Compute three sub-scores, then a **composite**:

| Sub-score | Weight | How to derive |
|-----------|--------|----------------|
| **Volume** | 35% | Best available `volumeEstimate` or parsed `searchVolume` (K/M/B) across hits; normalize 0–100 vs the **max volume among all candidates** in this capture. |
| **Velocity** | 35% | Best `growthPercent` from Google (cap at 1000% → 100); else infer from rank (#1=100, #2=80, #3=65, #4=50, #5=40) on the **strongest** platform. |
| **Cross-platform** | 30% | Count **distinct platform families** where the topic appears: `google_trends`, `baidu`, `tiktok`, `x_twitter`. Score = min(100, 25 × count). Bonus +10 (cap 100) if Google **HK or MO** **and** Baidu both hit. |

**Composite score** (round to integer):

```text
composite = round(0.35 × volumeScore + 0.35 × velocityScore + 0.30 × crossPlatformScore)
```

Store on each candidate (for your working notes and optional JSON):

- `volumeScore`, `velocityScore`, `crossPlatformScore`, `compositeScore`
- `platformCount` (number of platform families)
- `primaryPlatforms` (e.g. `Google Trends HK`, `Baidu`, `X`)

## Step 3 — Select Top 10 for the briefing

1. Sort candidates by **compositeScore** descending.
2. Break ties: (a) more platform families, (b) GBA/HK/Macao relevance, (c) stronger Google HK/MO signal.
3. Take **exactly 10** (or fewer only if fewer than 10 defensible candidates exist—never pad with old news).
4. **GBA filter:** Prefer topics with clear Greater Bay Area, Hong Kong, Macao, Shenzhen, Guangzhou, or cross-border China relevance; deprioritize pure US-local trends unless they move HK/MO search.

## Step 4 — Research and write (existing HTML format)

For each of the **Top 10 scored topics**:

1. **Research why it is trending now** (last 48h): events, releases, deadlines, celebrity/news hooks, policy announcements—use **fresh** sources (news, official releases, social threads) published or peaking within **48h** when possible.
2. Write in the standard GBA Pulse HTML (`.topic`, `.why-box`, etc.).
3. In **Why It's Trending**, cite Trend Watch evidence first:
   - `<code>Google Trends HK</code>`, `<code>Baidu Hot Search</code>`, `<code>TikTok Hashtag</code>`, `<code>X/Twitter</code>` with **rank, volume, or growth** from the capture.
4. In `.topic-meta` **📊** line, include: `Trend score: NN/100 · N platforms` (from your composite).
5. **Posted date rule:** `Posted:` must be the verification article’s date. If the best article is **older than 48h**, use `Posted: date not shown (accessed YYYY-MM-DD)` and ensure the summary explains the **current** spike from Trend Watch—not a recycled weekly story.

## What not to do

- Do **not** run a generic “GBA news” search and pick last week’s headlines.
- Do **not** use Google Trends **RSS** for volumes (coarse `100+` buckets).
- Do **not** use a **4-hour** Google window; only **48h** Trending Now.
- Do **not** list a topic in Top 10 without at least **one** Trend Watch platform hit unless you document a breaking gap in Key Observations.

## Optional: write scores back to Trend Watch JSON

The Trend Watch agent may add a `topicCandidates` array to the same JSON (see `prompts/gba-pulse-trend-watch-agent-prompt.md`). Briefing agents may **recompute** scores if the array is missing or incomplete.
