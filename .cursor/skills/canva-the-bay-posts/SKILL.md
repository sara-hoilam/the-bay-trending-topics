---
name: canva-the-bay-posts
description: Create, edit, or generate The Bay Canva / Instagram posts, Stories, news carousels, and gallery posts using brand template guidelines (fonts, colors, logo size/position, image layout, dimensions). Use whenever the user asks to make a Canva post, IG post, IG Story, news template, gallery template, or on-brand social graphic. Never generate a Canva post from scratch.
---

# The Bay — Canva post creation

Every Canva post for The Bay **must** be built from the brand templates in [this Canva folder](https://www.canva.com/folder/FAHUw3DTDC0), not from `generate-design` or a blank canvas.

The Canva API **cannot change font family**. Copying a template is the only way titles, body, badges, and footers keep the correct typefaces.

Read `guidelines.md` plus the matching format file before editing: `news.md`, `gallery.md`, or `stories.md`.

## Pick a template

| Format | Use when | Canvas | Design ID | Pages |
|--------|----------|--------|-----------|-------|
| **News** | News / policy / travel story, key facts, timeline | 1080×1350 (4:5 IG portrait) | `DAHUw4eva3Y` | 9 |
| **Gallery** | Photo essay, architecture, art, place feature | 1080×1350 (4:5 IG portrait) | `DAHUw9cEaPQ` | 9 |
| **Stories** | Instagram / Facebook Story news card | 1080×1920 (9:16) | `DAHUw1YJMeQ` | 14 |

If the user does not specify a format: **News** for a reported story, **Gallery** for a visual feature, **Stories** for a Story.

## Hard rules

1. **Copy, then swap content.** `Canva:copy-design` with the template ID above. Optionally pass `page_numbers` for a subset (cover-only, key-facts + closer, one Story card, etc.).
2. **Do not** call `Canva:generate-design` for The Bay social posts. It will invent layout, fonts, and colors.
3. **Do not** move, resize, recolor, or replace brand logos. They are already placed.
4. **Do not** change font family, canvas size, or the cream / charcoal / lime palette. `replace_text` keeps the box’s existing type and color — that is the point.
5. **Do not** add new text boxes (API cannot). Fit copy to the existing slots.
6. After copy: `start-editing-transaction` → `replace_text` / `update_fill` → show preview → ask to save → `commit-editing-transaction`. Follow `canva-edit-design` for the transaction protocol.
7. Leave a read-only inspection transaction **cancelled**, never committed.

## Fill order (every post)

1. **Hero photo(s)** — `update_fill` on the large image. Crop to fill the existing frame; do not change frame size/position.
2. **Title** — serif, existing color (white on photos, near-black on cream/gray). Keep line count close to the template so type does not overflow.
3. **Body / kicker** — shorter than the template slot when possible.
4. **Category / location chip** — lowercase city or beat (`hong kong`, `shenzhen`, `macao`, `guangdong`, `travel`, `art`). Use the chip vocabulary in `stories.md` when posting Stories.
5. **Footer location** — italic lowercase, right side (`hong kong`, `guangdong`, …).
6. **Date** — News cover `DD MMM YYYY` (`01 AUG 2026`); Stories `D Month YYYY` (`9 September 2026`).
7. **Photo credit** — lowercase or “photo by …” as in the template; keep it **rotated on the right edge**. Do not un-rotate or restyle.
8. **Lime highlights** — proper names in Gallery closer body stay lime (`#DAE480`). News labels (`WHAT CHANGED`, years, `What’s next?`) stay lime. Do not turn whole paragraphs lime.

## What you must not restyle

| Keep | Why |
|------|-----|
| Canvas 1080×1350 or 1080×1920 | Template dimensions |
| B mark top-left on covers | ~63×60 at x=45, y=42 |
| THE BAY wordmark top-center on interiors | ~165×43 at x=458, y=50 |
| THE BAY wordmark bottom-right on Stories | ~208×31 at x=812, y=1836 |
| Stacked B + THE BAY on closers | Centered near the top |
| 108px left text inset (feed) / ~75px (Stories) | Brand margin |
| Footer y=1282 on 1350 canvases | Location + date row |

Exact measurements: `guidelines.md` and the format file.

## After commit

Give the Canva edit link. Say which template and pages were used. If export is requested, use `get-export-formats` then `export-design` (PNG for social).
