# Editor comparison docs (manual brief vs GBA Pulse AI)

Google Drive folder (viewer access):  
https://drive.google.com/drive/folders/1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw?usp=sharing

## Purpose

One Word document per day comparing the **manual** daily brief (managing editors) with **GBA Pulse AI** output. Parsed selections train Run 2 (Daily Brief) story ranking.

## Filename convention

`YYYY-MM-DD-comparison.docx` (edition date = manual brief date)

Examples: `2026-06-09-comparison.docx`, `2026-06-08-comparison.docx`

## Editor selection markers

Stories chosen by managing editors are marked with **red font** and/or bracket tags (case-insensitive):

- `[News selected]`
- `[IG selected]`
- `[Selected]`

The parser treats these as weighted training signals (News > IG ≈ generic).

## Folder layout

| Path | Contents |
|------|----------|
| `raw/` | Source `.docx` files (copy from Drive or auto-sync) |
| `parsed/` | `YYYY-MM-DD.json` — extracted selected stories |
| `digest/` | `latest.md` — compact prompt attachment for the agent |
| `reports/` | Post-run overlap reports (AI brief vs editor picks) |

## Manual ingest (v1)

1. Download new comparison docx from Google Drive.
2. Save to `Training Data/editor-comparisons/raw/YYYY-MM-DD-comparison.docx`.
3. Run:

```bash
node scripts/parse-editor-comparison.mjs
node scripts/build-editor-selection-model.mjs
```

## Automated sync (v2)

Set GitHub/repo secrets:

- `GOOGLE_DRIVE_CREDENTIALS` — service account JSON
- `GOOGLE_DRIVE_FOLDER_ID` — defaults to `1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw`

Share the Drive folder with the service account email, then:

```bash
node scripts/sync-editor-comparisons.mjs
```

## Fixture

`node scripts/create-fixture-comparison-docx.mjs` writes `raw/2026-06-09-comparison.docx` for parser smoke tests.
