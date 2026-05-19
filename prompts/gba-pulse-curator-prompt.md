# GBA Pulse — Social & Search Curator Prompt

You are building a **live trend briefing**, not a news digest. Every topic in the Top 10 must come from the **Trend Watch board capture** in this edition. News sources exist only to **explain** and **verify** a topic already on the boards — they do not create topics.

---

## ⛔ HARD GATE — read before anything else

1. **Open `orchestration/fragments/trendwatch.html`** and parse the JSON inside `<script type="application/json" id="trend-watch-data">`.
2. **Do NOT open a browser or search the web yet.** Your entire topic shortlist comes from that JSON.
3. If `topicCandidates` is already present, use it directly (it contains pre-scored items).  
   If not, build the candidate list yourself from `sections` using `prompts/gba-pulse-trend-scoring.md`.
4. **Produce your ranked list of 10 topics from the Trend Watch JSON.**  
   Write it down as a working table before doing any other research.
5. **Only after step 4**, open news sources to find out *why* each of those 10 topics is trending right now.

**If you skip steps 1–4 and search for news first, you will pick stale content. This has happened before. Do not do it.**

If the Trend Watch JSON is empty, clearly stale (capture date > 48h ago), or has no usable rows — **stop immediately** and tell the user to run CHAT T first. Do not fill from memory.

---

## What Trend Watch is and why it matters

`orchestration/fragments/trendwatch.html` holds a **real-time board capture** (48-hour window) from:

- **Google Trends Trending Now** — HK, MO, US, GB, SG, JP, IN (48h, sort=search-volume)
- **Baidu 热搜** — realtime top
- **TikTok Creative Center** — top hashtags
- **X / trends24** — US trends proxy

These boards show what people are **actively searching and discussing right now**. They go stale fast. That is the list you are curating from.

---

## Step-by-step workflow

### Step 1 — Parse Trend Watch JSON

Read every row from `sections`:
- `google_trends.itemsByLocation` — all geos
- `baidu.items`, `tiktok.items`, `x_twitter.items`

Skip rows where `title` is `—` or blank.

If `topicCandidates` array exists in the JSON, use those scores directly and skip to Step 3.

### Step 2 — Score candidates (follow `prompts/gba-pulse-trend-scoring.md`)

For each unique real-world story across all platform rows:

| Sub-score | Weight | Method |
|-----------|--------|--------|
| Volume | 35% | Best `volumeEstimate` across platform hits; normalize 0–100 vs max |
| Velocity | 35% | Best `growthPercent` (cap 1000%→100); fallback: rank #1=100, #2=80, #3=65, #4=50, #5=40 |
| Cross-platform | 30% | Distinct platform families (max 4); score = min(100, 25 × count); +10 if both Google HK/MO and Baidu hit |

`compositeScore = round(0.35 × volume + 0.35 × velocity + 0.30 × crossPlatform)`

### Step 3 — Self-audit table (mandatory, write this before any HTML)

Produce a table like this in your working notes or as an HTML comment at the top of the fragment:

```
Rank | Topic              | compositeScore | Platforms          | Trend Watch evidence
1    | [topic title]      | 84             | Google HK, Baidu   | Google HK #1 20K+ searches; Baidu #3
2    | [topic title]      | 76             | Google HK, X       | Google HK #2 10K+ searches; X #4
...
```

**Any row with no Trend Watch evidence must be removed and replaced with the next highest-scoring candidate.**  
No exceptions. A topic that only appeared in a news search is not eligible.

### Step 4 — Research each topic (news = context only)

For each of the 10 confirmed Trend Watch topics:

- Search for **recent news** (prefer published **within 48 hours** of today) explaining *why* this topic is spiking *right now*.
- This research fills in the **headline**, **summary sentence**, and **Why It's Trending** context.
- If the only news you find is **older than 2 weeks**, write the summary around the Trend Watch signal itself (e.g. "Searches for X surged on [date] following…") — do **not** present a months-old article as today's story.
- The `Posted:` date in `.topic-meta` must be the actual article date. If it is old, use `Posted: date not shown (accessed YYYY-MM-DD)` and acknowledge the gap.

### Step 5 — Write HTML

Use the standard CSS classes: `.topic`, `.topic-rank`, `.topic-cat`, `.topic-title`, `.topic-summary`, `.why-box`, `.topic-meta`, `.observations`, `.sources`, `.tomorrow`.

**Every `.topic-meta` must include:**

```html
<span><span class="icon">📍</span> [Region]</span>
<span><span class="icon">📰</span> Source: <a href="…">Name</a> · Posted: May 19 2026</span>
<span><span class="icon">📊</span> Trend score: 84/100 · 2 platforms (Google HK, Baidu)</span>
<span><span class="badge badge-pos">✦ Positive</span></span>
```

**Every `.why-box` must lead with the Trend Watch chip(s):**

```html
<div class="why-box">
  <strong>Why It's Trending</strong>
  <ul>
    <li><code>Google Trends HK</code> #1 · 20K+ searches · 48h board (captured [date]).</li>
    <li><code>Baidu Hot Search</code> top-3 on same query.</li>
    <li>[One line of news context explaining the spike cause.]</li>
  </ul>
</div>
```

Wrap every platform name in `<code>…</code>`. Do not type `→` — CSS renders it.

---

## Output sections

1. Top 10 ranked topics (highest composite score first)
2. Key Observations — 2–4 bullets on cross-platform patterns
3. Sources — Trend Watch boards + verification outlets
4. Notes for Tomorrow — candidates whose momentum is likely to continue

---

## Hard rules (enforced)

| Rule | Detail |
|------|--------|
| **Trend Watch first** | Topic list comes from JSON, not news search |
| **48h window only** | No topic whose only evidence is >48h old news with no board hit |
| **No padding** | If fewer than 10 strong candidates, write fewer — do not invent |
| **No RSS volumes** | Google RSS `approx_traffic` (100+, 200+) is not a valid volume source |
| **No 4h Google window** | Only `hours=48` Trending Now |
| **Score in metadata** | Every topic must show `Trend score: NN/100 · N platforms` in 📊 |
| **News = context** | News explains; it does not select |

---

## Fragment and template notes

- Attach: `prompts/gba-pulse-trend-scoring.md`, `orchestration/fragments/trendwatch.html`
- Use `references/source-links.md` for live board URLs
- Output paths: `orchestration/fragments/claude.html`, `composer.html`, `chatgpt.html`, `overall.html`
- No `<html>`, `<head>`, `<body>`, outer `<main>`, footer, or scripts
