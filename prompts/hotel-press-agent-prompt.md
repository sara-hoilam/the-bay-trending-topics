# THE BAY — Hotel Press agent prompt

You are producing **THE BAY: Hotel Press** — awards and good news from official hotel / integrated-resort press rooms. Same selection discipline as the Daily Brief: **live scan, no invented URLs**, then markdown in Daily Brief format.

---

## Scope

- **Sources:** only domains in `references/daily-brief-source-domains.md` under **## Hotels**, listed in `source-links-data.json` with `category: "Hotels"`.
- **Window:** last **14 days** (HKT), inclusive of today.
- **Keep:** awards, honours, certifications, rankings/debuts, Great Place to Work, employee/team awards, CSR donations and community relief, major positive launches tied to those.
- **Drop:** earnings, unaudited results, ticket sales, shopping-carnival ops, menu/F&B launches unless they are an award, exhibition extensions, entertainment bookings.

Example keepers (type, not a required set):

- Wynn Launches 20th Anniversary Share Award for Team Members
- Wynn Palace Becomes the First in Macao to Debut on The World's 50 Best Hotels 2026 Extended 51-100 List
- Wynn Macau and Wynn Palace Recognized at the 2025 Macao Green Hotel Award
- Sands China Receives Two MICE Honours at M&C Asia Stella Awards 2026
- Sands China Earns Great Place To Work Certification™

---

## Preferred path (same daily job as Daily Brief)

Run the listing scrape (reads Hotels rows from source-links-data.json):

```bash
node scripts/generate-source-links-data.mjs
node scripts/generate-hotel-press-data.mjs
```

Then open the listing URLs and the generated `Training Data/YYYY-MM-DD-hotel-press.md`. If a headline is missing a lede, fetch the article page and replace the summary with **1–2 sentences** from the release (facts only). Re-write `hotel-press-data.json` summaries to match if you edit markdown.

If the scrape returns nothing usable, live-scan the Hotels listing URLs yourself and write the markdown.

---

## Output format (exactly)

```
THE BAY: Hotel Press
Date: [DD Month YYYY] · [N] articles · method: hotel-press-agent-prompt (14-day awards & good news)

[Hotel group] (N):

1. **Headline** — Outlet name
https://…
One- or two-sentence summary.

```

Section names are hotel groups (Wynn, Sands China, …). Number articles 1…N across the edition.

Save to:

`Training Data/YYYY-MM-DD-hotel-press.md`

JSON for the tab is produced by `generate-hotel-press-data.mjs` → `hotel-press-data.json`.
