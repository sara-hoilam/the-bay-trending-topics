# Instagram Stories_News — 1080 × 1920

- Design ID: `DAHUw1YJMeQ`
- Title in Canva: `Copy of Instagram Stories_News`
- Folder: `FAHUw3DTDC0`
- Pages: 14 (6 daily cards → location-chip legend → 7 URL-pill cards)

Copy **one page per Story**. Do not post the chip legend (page 7) as a Story unless the user wants a location-key reference.

Canvas is 1080×1920. Some template shapes are 1087px wide — leave that overflow; do not “fix” it.

## Card anatomy (pages 1–6)

Top photo (~full width × ~1085–1110). Lower cream panel `#EFEDE8`. Type sits in the panel, not on the photo (except the overlapping chip).

| Slot | Example | Box (left, top) | Size |
|------|---------|-----------------|------|
| Photo | (fill) | ~0, ~0 | ~1111 × 1091 |
| Location chip (pill) | `macao` | 75, 1145 | width varies × 52 |
| Chip label | `macao` | ~92, 1150 | ~140–298 × 41 |
| Title | `PISA 2025: Macao students ranked world number one in computational problem solving` | 75–85, 1222 | ~945–965 × 144–284 |
| Body | 1–2 sentences | 75, 1390–1534 | 945 × 156–207 |
| Date | `9 September 2026` | 60, 1836 | 549 × 41 |
| THE BAY wordmark | (image) | 812, 1836 | 208 × 31 |

**Title:** near-black serif, 2–4 lines. **Body:** dark serif. **Date:** small, left. **Chip:** terracotta pill, **white lowercase** location. **Wordmark:** bottom-right, do not move.

Title should finish above the date row (y < 1830). If copy is long, shorten it — do not resize the title box down over the footer.

## Card anatomy (pages 8–14)

Same cream panel, plus a **thebay.mo URL pill** sitting on the photo/panel seam.

| Slot | Example | Box (left, top) | Size |
|------|---------|-----------------|------|
| URL pill | shape | 383, 995 | 315 × 82 |
| URL text | `thebay.mo` | 465, 1013 | 209 × 46 |
| Favicon | (image, do not replace) | 393, 1004 | 63 × 63 |
| Location chip | `dongguan` | 75, 1130 | width varies × 52 |
| Title | news head | 75, 1207 | 976 × 224–284 |
| Body | dek | 75, 1480 | 930 × 156–207 |
| Date | `02 Feb 2026` | 60, 1836 | 549 × 41 |
| THE BAY wordmark | (image) | 812, 1836 | 208 × 31 |

Use pages 8–14 when the Story should show **thebay.mo**. Use pages 1–6 when it should not.

## Page 7 — Location chip legend (do not post)

Reference sheet of terracotta pills on paper. Vocabulary to use in chips (lowercase):

`macao`, `hong kong`, `guangzhou`, `shenzhen`, `zhuhai`, `foshan`, `huizhou`, `dongguan`, `zhongshan`, `jiangmen`, `zhaoqing`, `beijing`, `shanghai`, `lusophone countries`, `world`, `greater bay area`, `guangdong`, `hengqin`, `mainland china`, `lusofonia`, `china`

If a story needs a new place, still use **lowercase** and the same pill. Prefer an existing chip page whose width is close (short names on `macao`/`world` chips; long names on `mainland china` / `lusophone countries`).

## Which page to copy

| Need | Copy |
|------|------|
| One Story, no URL | `page_numbers: [1]` (or 2–6) |
| One Story with thebay.mo | `page_numbers: [8]` (or 9–14) |
| Multi-frame Story | several of 1–6 **or** 8–14, not mixed unless asked |
| Chip artwork only | `[7]` (rare) |

After copy, replace photo, chip label, title, body, and date. Leave logo, pill, and panel.

**Photo:** follow `images.md` (accuracy **and** the cover-crop test). Search for the named subject (XPeng IRON, Hengqin Port vehicle channels, Hotelex Shenzhen). The Stories hero is ~1080×1085, so a 1280×670 landscape will upscale and look soft — reject it. Inspect the thumbnail at a large size before commit. Do not use a generic robot, skyline, or conference hall.

## Copy limits (from the templates)

- Title: about 8–18 words. Break with `\n` to match 2–4 lines.
- Body: one tight dek, about 20–35 words.
- Date: `D Month YYYY` or `DD Mon YYYY` as already on that page.
- Chip: one location token, lowercase, no `#`.
