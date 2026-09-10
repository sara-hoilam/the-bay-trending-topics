# Hero photo accuracy (mandatory)

Relevant is not enough. The photo must be **the named subject**, not a stand-in from the same category.

This exists because past Stories used a generic humanoid for an XPeng production-line story, and a generic city skyline for Hengqin Port. Both were on-topic. Neither was true.

Read this file before every `update_fill` on a hero or interior photo.

## Pass / fail

The image passes only if a reader who knows the story would say **“that is the thing in the headline.”**

| Story names | Must show | Fail (do not ship) |
|-------------|-----------|--------------------|
| A brand product (XPeng IRON, a named restaurant, a named hotel) | That product / venue, with a visible identifier (logo, model, façade) | A generic robot, dining room, or lobby from another brand |
| A place (Hengqin Port, Qianhai, a named museum) | That place: the port, the checkpoint, the named district | A generic skyline, “a Chinese city,” or another GBA crossing |
| A person | That person | A stock “executive” or crowd |
| An event (Belt and Road Summit, Hotelex Shenzhen) | That event, venue, or official key art | A generic conference hall or hotel corridor |
| A number / policy story with no visual | Official chart, the building where it was signed, or **no substitute photo** | Random related clip-art |

## Search, don’t invent

1. Name the subject in one line: brand + product, or place + what it is (`XPeng IRON humanoid official`, `Hengqin Port Macao vehicle channels`, `Hotelex Shenzhen 2026`).
2. Prefer, in order: company / government newsroom, the source article’s own photo, a named wire (Xinhua, Reuters) of **that** subject, thebay.mo.
3. Use a **public HTTPS URL that already hosts the file**. Upload with `Canva:upload-asset-from-url`, then `update_fill`. Do not re-host private files on the public internet to feed Canva.
4. **Check resolution before upload** (see Quality below). Read `width` × `height` from the file or from the upload response `metadata`.
5. After fill, **look at the page thumbnail at a large size**. If you cannot point to a visual ID (XPeng chest mark, Hengqin Port canopy, named venue sign), replace it. If edges or signage look mushy, the file is too small — replace it.
6. Credit the real source in the rotated credit slot (`photo courtesy of xpeng`, `photo by …`).

Do not use Canva Magic Media / `generate-design` imagery as a hero. Do not use a “close enough” stock photo of the category.

## Quality (mandatory)

Accuracy first, then sharpness. A true photo that looks soft still fails.

This exists because a correct Hengqin Port vehicle-lane still (1280 × 670) was cropped into a ~1080 × 1085 Story frame and came out blurry.

### Cover-crop test

Canva fills the existing frame (no letterboxing). The source is scaled by:

`scale = max(frame_w / src_w, frame_h / src_h)`

- `scale ≤ 1.0` — pass (source has enough pixels; smaller is sharper)
- `scale ≤ 0.5` — prefer (2× retina)
- `scale > 1.05` — **fail** (Canva is upscaling). Find a larger original or do not use this photo. Allow 1.00–1.05 only for rounding (e.g. a 1080-high file in a 1085 frame).

| Frame | Size | Source must satisfy |
|-------|------|---------------------|
| Stories hero | ~1080 × 1085–1110 | `min(src_w, src_h)` ≥ **1085** after a 1:1-ish crop. A 1280 × 670 landscape cannot. |
| News cover / LinkedIn | ~1080 × 823 | `src_h ≥ 823` and `src_w ≥ 1080` (or the inverse if the crop is taller than it is wide) |
| News interior | ~1080 × 823 | same as News cover |
| Gallery full-bleed | 1080 × 1350 | `src_w ≥ 1080` and `src_h ≥ 1350` |

Worked example: Stories hero 1080 × 1085.

- ISD signing photo 4000 × 2725 → `scale = max(1080/4000, 1085/2725) = 0.40` → pass
- Gov.mo Hengqin lanes 1280 × 670 → `scale = max(1080/1280, 1085/670) = 1.62` → fail

### Reject these files

- Open Graph / social cards (`og:image`, `-1024x576`)
- CMS thumbs (`-150x150`, `-300x200`, in-article 800-wide compressions)
- Any file that fails the cover-crop test
- Canva Magic Media / `generate-design` imagery

Prefer ISD / wire originals (often 3000–4000px on the long side) over the JPEG sitting in the article body.

### How to check

1. Download the candidate. Read `width` × `height` (`file`, or `upload-asset-from-url` → `metadata`).
2. Run the cover-crop test against the **actual frame** you will fill, not the full canvas.
3. If it fails, search for the same official still at a larger URL (GIA `photo_*.jpg`, full WordPress file, newsroom download). Do not upscale it yourself.
4. After `update_fill`, inspect the thumbnail. Soft type on signs, mushy faces, or JPEG blocks = replace.
5. Export PNG at the **template pixel size** (Stories 1080 × 1920, News/Gallery 1080 × 1350). Set `export_quality: "pro"` when `get-export-formats` allows it. Never export a 335px preview and attach that.

### If the only official still is too small

Do **not** ship a blurry upscale.

- Leave the template photo and say the official file is below the frame size, **or**
- Ask the user for a higher-res URL, **or**
- Switch to a text-led News Key Facts page that does not depend on that hero.

Slack compresses inline previews. Still attach the full 1080-wide PNG, not a Canva thumbnail.

## If you cannot verify

Do **not** ship a misleading photo.

- Leave the template photo and say in the thread that an official still is still needed, **or**
- Use a text-led News page (Key Facts) that does not depend on a wrong hero, **or**
- Ask the user for a URL.

Never fill a Hengqin Port story with “a city in the Bay Area.” Never fill an XPeng humanoid story with “a humanoid robot.”

## Crop (unchanged from the templates)

- Photography is **full-bleed** or **top-bleed** into the existing frame. Crop to fill; do not letterbox.
- Keep faces and signage out from under the B mark, wordmark, and footer.
- Interior News frames are ~**1080 × 823** at the top; Gallery interiors are full 1080×1350.
- Stories hero is ~**1080 × 1085–1110** at the top (slight overflow is already in the template).
