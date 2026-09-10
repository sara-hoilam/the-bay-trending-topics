# The Bay Canva — shared brand tokens

Source: training designs in [Canva folder FAHUw3DTDC0](https://www.canva.com/folder/FAHUw3DTDC0). Positions are in **pixels on the template canvas**. Colors are sampled from rendered pages (Canva does not reliably return hex/font from the API).

## Dimensions

| Channel | Size | Ratio | Canva type |
|---------|------|-------|------------|
| Instagram / Facebook feed (News, Gallery) | **1080 × 1350** | 4:5 | Instagram portrait |
| Instagram / Facebook Story | **1080 × 1920** | 9:16 | Story |

Never resize a copied template to square 1080×1080 or landscape unless the user explicitly asks. If they do, copy first, then `resize-design`, then fix overflow by hand in Canva (API cannot add text boxes).

## Type (visual, locked in the templates)

Canva API cannot set font **family**. These are the roles already baked into the templates — preserve them by only replacing text.

| Role | Look | Typical color | Approx. size (from box height) |
|------|------|---------------|--------------------------------|
| **Title** | High-contrast serif (same family as Playfair Display on thebay.mo / GBA Pulse) | White on photos; near-black `#393E47` on cream/gray | Feed cover ~52–64pt; Stories ~48–56pt; interior heading ~32–36pt |
| **Body** | Same serif, regular | White on photos; dark gray on cream; light gray on charcoal | ~20–24pt |
| **Kicker / subtitle** | Italic serif | White | ~22pt |
| **Category badge** | Small sans, uppercase (`NEWS`, `ART`) or lowercase topic (`travel`) | Lime `#DAE480` on near-black fill; outline badge is white stroke + white text | ~12–14pt |
| **Fact labels** | Small sans, uppercase (`WHAT CHANGED`, `WHEN`, `THE TIMELINE`) | Lime `#DAE480` | ~14–16pt |
| **Footer location** | Italic serif, **lowercase** (`hong kong`, `guangdong`) | White on photos; `#393E47` on light pages | ~16–18pt |
| **Footer date** | Small sans or serif, often uppercase (`01 AUG 2026`) | White / light | ~16pt |
| **Photo credit** | Condensed sans, often lowercase “photo by …”, **rotated 90°** on the right edge | White | ~11–12pt |
| **Name highlight** | Same body serif, lime | `#DAE480` | body size |
| **Location chip (Stories)** | Lowercase sans inside a pill | White on terracotta fill | ~18pt |
| **URL pill** | `thebay.mo` | Dark text on white pill | ~16pt |

Do not switch titles to sans, do not all-caps a title, and do not un-italic the location footer.

## Color palette

| Token | Hex | Use |
|-------|-----|-----|
| Lime / highlighter | `#DAE480` | Labels, years, “What’s next?”, name highlights, badge text |
| Charcoal panel | `#363B44` | Key Facts split, dark overlays |
| Paper / chip | `#EFEDE8` | KEY FACTS chip, Stories lower panel, warm off-white |
| Gallery closer gray | `#DFDBDB` | Text closer background |
| Ink | `#393E47` | Body and location on light grounds |
| White | `#FFFFFF` | Titles/body on photography, outline badges |
| Near-black | `#050609` | Solid category badges |
| Terracotta chip | ~`#C45C45` | Stories location pills (visual; chips live in the template) |

Do not introduce GBA Pulse’s print red `#C8441B` or gold `#C8A21B` into these social templates unless the user asks. The social system is **lime + charcoal + paper + white + terracotta chips**.

## Logo lockups (do not move)

Three lockups appear across the set. Always keep the instance already on the page.

### 1. B mark (covers)

- Asset role: stacked **B** icon, white
- Size: **63 × 60**
- Position: **left 45, top 42**
- Pages: News p1, Gallery p1

### 2. THE BAY wordmark (interiors)

- White wordmark, letter-spaced
- Size: **165 × 43**
- Position: **left 458, top 50** (horizontally centered)
- Pages: News p2–8, Gallery p2–8
- A slightly smaller wordmark (~145 × 22 at left 467, top 61) appears on some News interiors — leave it.

### 3. Stacked B + THE BAY (closers)

- Centered near the top of the page
- News closer (p9): **177 × 167** at left **451**, top **40**
- Gallery closer (p9): **196 × 185** at left **442**, top **93**

### 4. Stories footer wordmark

- Size: **208 × 31**
- Position: **left 812, top 1836** (bottom-right)

Never stretch logos. Never recolor them. Never add a second logo to a page that already has one.

## Shared feed chrome (1080×1350)

| Element | Position (left, top) | Size (w × h) |
|---------|----------------------|--------------|
| Full-bleed photo | 0, 0 | 1080 × 1350 |
| Text column | 108, (varies) | 864 wide |
| Footer location | 599, 1282 | 435 × 26 |
| Footer date (News cover) | 45, 1282 | 435 × 26 |
| Vertical photo credit | ~574, ~488 (cover) or ~649, ~413 (interior) | ~882 × 22 (rotated) |
| Bottom safe zone | y ≥ 1280 | Keep logos/type out of the last ~70px except the footer row |

## Image rules

- Photography is **full-bleed** or **top-bleed** into a fixed frame. Crop to fill; do not letterbox.
- Prefer real reportage / architecture / city photos. No stock-illustration collages.
- Keep faces and signage out from under the B mark, wordmark, and footer.
- Interior News frames are ~**1080 × 823** at the top; Gallery interiors are full 1080×1350.
- Stories hero is ~**1080 × 1085–1110** at the top (slight overflow is already in the template).

## Copy tone

- Titles are full sentences or sharp news heads, not hashtags.
- Location footer is geographic, lowercase, one place (`hong kong`, not `Hong Kong SAR`).
- Credits: `photo by Name/Outlet` or `photo courtesy of …`.
- Lime is for **labels and proper-name highlights**, not decoration.
