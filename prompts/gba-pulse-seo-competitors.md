# GBA Pulse — SEO competitor check (read-only)

You are checking **who ranks on Google** for a short list of keywords, so The Bay (thebay.mo) can see which pages rank above it. This is a **read-only research task**.

## Hard rules

- **Do not edit, create, commit or push any files.** Do not open a PR. Your only output is the JSON block described below, in your final message.
- **Never invent a result.** Only list a URL you actually saw in a search results page or search tool output during this run. If you could not see results for a keyword, return an empty `results` array for it and explain in `notes`.
- **Organic results only.** Exclude ads, sponsored results, "People also ask", map packs, image/video carousels and "Top stories" boxes.
- Copy URLs exactly as shown. Do not shorten, guess or "fix" them.

## Market

- Google market: **{{MARKET_LABEL}}** (`gl={{GL}}`, `hl=en`)
- Check the **top {{TOP_N}} organic results** for each keyword.

## Keywords

{{KEYWORDS}}

## Method (in order of preference)

1. Load `https://www.google.com/search?q=<keyword>&gl={{GL}}&hl=en&num={{TOP_N}}&pws=0` and read the organic results in order. Set `method` to `"google_serp"`.
2. If Google blocks the request (captcha, consent wall, 429), use your web search tool with the keyword and region set to {{MARKET_LABEL}} if possible. Set `method` to `"web_search_estimate"` — the order is then an estimate, not a Google rank.

## Classify each result's `type` — use exactly one of

`government`, `encyclopedia`, `news`, `consultancy`, `data`, `business`, `travel`, `academic`, `video`, `social`, `other`

- `consultancy` covers Big Four, banks and law firms' insight pages
- `business` covers investment/company-setup guides (e.g. China Briefing)
- `data` covers statistics portals (e.g. Statista)

## `note`

One short factual line (max 90 characters) on what the page is, e.g. "Official HKSAR portal overview page" or "Investor guide, no visible date". No opinions about quality.

## Output — final message must end with exactly one fenced JSON block

```json
{
  "market": "{{MARKET_ID}}",
  "checkedAt": "YYYY-MM-DD",
  "keywords": [
    {
      "keyword": "greater bay area china",
      "method": "google_serp",
      "results": [
        { "position": 1, "title": "Page title as shown", "url": "https://…", "type": "government", "note": "…" }
      ],
      "notes": ""
    }
  ]
}
```

Include every keyword listed above, in the same order, even if `results` is empty. Include thebay.mo if it appears — do not skip it.
