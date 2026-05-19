# GBA Pulse — Trend Watch scoring (for briefing selection)

This document defines how to go from raw Trend Watch board data to a **ranked shortlist** for the briefing. Briefing agents must follow this before any news research.

---

## Hard time-window rule

**Discovery window: last 48 hours only.**

- Google rows come from **Trending Now · 48h** (`hours=48`). Not the 4h default, not RSS.
- Baidu realtime, TikTok, and X boards are treated as within the same 48h window.
- A topic whose **only evidence** is a news article **older than 48 hours** and **absent from all Trend Watch boards** does **not** qualify for the Top 10.
- Older news may be used as one line of background context — never as the reason a topic appears on the list.

---

## Step 1 — Build the candidate list from the JSON

Source: `orchestration/fragments/trendwatch.html`, JSON in `<script type="application/json" id="trend-watch-data">`.

If `topicCandidates` is already in the JSON and the `compositeScore` values are present, **use them directly** and skip to Step 3.

Otherwise, collect every non-empty board row from **all geos equally**:

- `sections[id="google_trends"].itemsByLocation` — **every** geo key: HK, US, GB, MO, JP, SG, IN (and any others present). Do **not** skip or deprioritize any geo at this stage.
- `sections[id="baidu"].items`
- `sections[id="tiktok"].items`
- `sections[id="x_twitter"].items`

Skip rows where `title` is `"—"` or blank.

**Normalize** synonyms into one candidate entry per real-world story.  
Examples: `Trump Xi` ≈ `中美元首` ≈ `Trump-Xi summit`; `澳車北上` ≈ `HZMB northbound`; a topic trending as #1 in US and #2 in SG maps to one candidate with two Google geo hits.  
Record every platform hit (including geo) that maps to that story.

**Why all geos matter:** A story trending in the US, SG, or JP often reaches GBA audiences within hours (financial news, AI releases, geopolitical events). Collecting all geos first lets the cross-platform score correctly reflect that a topic is moving across multiple markets. The GBA relevance filter is applied at Step 3 (ranking), not here.

---

## Step 2 — Compute scores (0–100 each)

### Volume score (35%)

1. Find the best `volumeEstimate` across all platform hits for this candidate.  
   - If `volumeEstimate` is 0 or absent, parse `searchVolume` (e.g. `"20K+ searches"` → 20000, `"1M+"` → 1000000).  
   - For Baidu, parse the numeric part from e.g. `"≈7.9M 热搜指数"` → 7900000.  
   - If no numeric volume at all, use `0`.
2. Find `maxVolume` = highest best-volume across **all** candidates in this capture.
3. `volumeScore = round(100 × log10(1 + bestVolume) / log10(1 + maxVolume))`  
   (log-scale prevents one viral outlier from collapsing all other scores to near zero.)

### Velocity score (35%)

1. Use the best `growthPercent` from Google Trending Now for this candidate (capped at 1000%).  
   `velocityScore = round(min(100, growthPercent / 10))`
2. If `growthPercent` is 0 or absent for all hits, fall back to **rank-based** inference from the strongest platform:  
   `#1 → 100, #2 → 80, #3 → 65, #4 → 50, #5 → 40`
3. Take whichever gives the higher score.

### Cross-platform score (30%)

1. Count **distinct platform families** where the topic appears:  
   `google_trends` (any geo counts as one family hit, but multiple geos within Google count as extra signal — see bonus), `baidu`, `tiktok`, `x_twitter` — base maximum 4.
2. `crossPlatformScore = min(100, 25 × platformCount)`
3. Bonuses (each capped so total ≤ 100):
   - +10 if topic appears in Google **HK or MO** (directly GBA-relevant geo)
   - +10 if topic appears in **both** Google (any geo) **and** Baidu (cross-strait signal)
   - +5 if topic appears in **3 or more** Google geos (broad international traction)

### Composite

```
compositeScore = round(0.35 × volumeScore + 0.35 × velocityScore + 0.30 × crossPlatformScore)
```

---

## Step 3 — Select Top 10

1. Sort all candidates by `compositeScore` descending.
2. Tie-break: (a) more platform families, (b) Google HK or MO hit, (c) GBA/HK/Macao editorial relevance.
3. **GBA relevance filter** — from the sorted list, prefer topics with at least one of:
   - Appears on Google HK or MO boards
   - Appears on Baidu
   - Is a global story (finance, AI, geopolitics, celebrity) with clear GBA audience interest even if trending in US/SG/JP only — note this in `gbaRelevance: "medium"`
   - Drop topics with **zero** GBA relevance (e.g. a purely local US sports event with no China/HK angle) unless the boards strongly signal GBA audience pickup (e.g. #1 on Google HK).
4. Take the top 10 after the GBA filter. **Never pad** with a topic not on the boards. If only 8 strong candidates pass, write 8.
5. **Aim for geographic mix:** don't let all 10 slots go to HK-only Google topics. If candidates from US/SG/JP Google boards have GBA relevance and strong scores, include them — they represent international trends the GBA audience is also tracking.

---

## Step 4 — Mandatory self-audit before writing

Before writing any HTML, produce this table (in working notes or as an HTML comment):

```
Rank | Title (normalized)    | Score | Platforms              | Evidence
1    | [title]               | 84    | Google HK, Baidu       | Google HK #1 20K+ / Baidu #3
2    | [title]               | 78    | Google HK, X           | Google HK #2 10K+ / X #5
...
```

**Rejection rule:** any row where the Evidence column is empty (no board hit) must be removed and replaced with the next highest-scoring candidate that does have evidence.

This table is proof the briefing came from Trend Watch, not from a news search.

---

## Step 5 — Research and write

Only after Step 4:

1. For each confirmed candidate, search for **fresh news** (prefer ≤48h) explaining *why* it is spiking now.
2. If the freshest article is weeks or months old, write the summary around the **search/social spike** itself. Do not present old articles as today's news.
3. The `Posted:` date must reflect the actual article date. Use `Posted: date not shown (accessed YYYY-MM-DD)` if the article has no visible date or is stale.
4. Cite Trend Watch evidence **first** in every `.why-box` bullet before adding news context.

---

## What not to do

| ❌ Forbidden | ✅ Required alternative |
|-------------|------------------------|
| Run a general GBA news search first | Parse Trend Watch JSON first |
| Pick a topic because it was important last month | Pick only if it appears on a board in this capture |
| Use Google RSS approx_traffic (`100+` buckets) | Read the on-site 48h table |
| Use Google's default 4h window | `hours=48` only |
| Leave Evidence column empty in self-audit | Replace with next scored candidate |
| Use an article from weeks ago as the lead story | Find fresh context or write around the spike |

---

## Optional: pre-scored `topicCandidates` in JSON

If the Trend Watch agent already computed `topicCandidates` in the JSON, briefing agents should use those scores. They may recompute if the scores look wrong or the array is incomplete.
