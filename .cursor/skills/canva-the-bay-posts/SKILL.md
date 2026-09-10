---
name: canva-the-bay-posts
description: Create, edit, or generate The Bay Canva posts for Instagram (feed, Story, carousel) and LinkedIn using brand templates in Canva folder FAHUw3DTDC0. Covers fonts, colors, logo size/position, image layout, dimensions, and photo accuracy. Use whenever the user asks for a Canva post, IG post, IG Story, LinkedIn post, LinkedIn image, news template, gallery template, or on-brand social graphic. Never generate a Canva post from scratch. Always attach the finished image in the chat or Slack thread plus the Canva edit link.
---

# The Bay — Canva post creation

Every Canva post for The Bay — **Instagram or LinkedIn, any time** — **must** be built from the brand templates in [this Canva folder](https://www.canva.com/folder/FAHUw3DTDC0), not from `generate-design` or a blank canvas.

The Canva API **cannot change font family**. Copying a template is the only way titles, body, badges, and footers keep the correct typefaces.

Before editing, read:

1. `guidelines.md` (tokens, logos, palette)
2. `images.md` (hero photos must be the named subject **and** sharp enough for the frame)
3. The matching format file: `news.md`, `gallery.md`, `stories.md`, or `linkedin.md`

## Pick a template

| Format | Use when | Canvas | Design ID | Pages |
|--------|----------|--------|-----------|-------|
| **News** | News / policy / travel story; **LinkedIn** image posts | 1080×1350 (4:5) | `DAHUw4eva3Y` | 9 |
| **Gallery** | Photo essay, architecture, art, place feature | 1080×1350 (4:5) | `DAHUw9cEaPQ` | 9 |
| **Stories** | Instagram / Facebook Story news card | 1080×1920 (9:16) | `DAHUw1YJMeQ` | 14 |

If the user says **LinkedIn** (post, image, graphic, carousel): use **News** at 1080×1350. LinkedIn displays 4:5 natively. Details: `linkedin.md`.

If the user does not specify a format: **News** for a reported story, **Gallery** for a visual feature, **Stories** for a Story.

## Hard rules

1. **Copy, then swap content.** `Canva:copy-design` with the template ID above. Optionally pass `page_numbers` for a subset (cover-only, key-facts + closer, one Story card, etc.).
2. **Do not** call `Canva:generate-design` for The Bay social posts (including LinkedIn). It will invent layout, fonts, and colors.
3. **Do not** move, resize, recolor, or replace brand logos. They are already placed.
4. **Do not** change font family, canvas size, or the cream / charcoal / lime palette. `replace_text` keeps the box’s existing type and color — that is the point.
5. **Do not** add new text boxes (API cannot). Fit copy to the existing slots.
6. After copy: `start-editing-transaction` → `replace_text` / `update_fill` → inspect the thumbnail → `commit-editing-transaction`. Follow `canva-edit-design` for the transaction protocol. Do not wait for a second “please save” if the user already asked you to make the post.
7. Leave a read-only inspection transaction **cancelled**, never committed.
8. **Photos:** follow `images.md`. A category-similar stock shot is a fail. A correct still that upscales into the frame (`scale > 1.0`) is also a fail.

## Fill order (every post)

1. **Hero photo(s)** — find an **accurate** still (`images.md`), confirm it passes the cover-crop test, `upload-asset-from-url`, then `update_fill`. Crop to fill the existing frame; do not change frame size/position.
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

## Deliver (always — do not skip)

The user must see the **graphic in the thread**, not only a Canva URL.

After `commit-editing-transaction`:

1. `get-export-formats` then `export-design` as **PNG** at the template size (Stories 1080×1920, News/Gallery 1080×1350). Use `export_quality: "pro"` when available. Do not attach a 335px thumbnail.
2. Save files under `/opt/cursor/artifacts/` (or the session artifacts folder).
3. Post in the **current Slack thread** (or the Cursor chat if there is no Slack) with:
   - The PNG inline (`<img alt="…" src="/opt/cursor/artifacts/….png" />` on Slack)
   - The Canva **edit** link on the next line
   - One line on template + pages used
4. Multi-page carousels: one image per page, in order, then a single edit link.

Never deliver a table of Canva links with no images. Never say “open Canva to review” instead of attaching the PNG.
