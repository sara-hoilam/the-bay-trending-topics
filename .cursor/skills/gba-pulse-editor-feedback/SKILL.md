---
name: gba-pulse-editor-feedback
description: On-demand editor feedback training for GBA Pulse Daily Brief. Import comparison docx from GBA Pulse Feedback, parse [Selected]/[IG selected]/[News selected] markers, rebuild editor-selection weights and digest. Invoke only when the user asks to apply editor feedback — not part of the automatic daily refresh.
---

# GBA Pulse — Editor feedback training (on-demand)

Apply managing editors' manual brief feedback so **Run 2 (Daily Brief)** selects stories more like the human process, especially items marked **`[Selected]`**, **`[IG selected]`**, or **`[News selected]`** (often red font in Word).

**This skill is manual.** The automated 08:00 HKT daily pipeline does **not** run this workflow unless the user explicitly invokes this skill.

## When to use

Trigger when the user says things like:

- "Apply editor feedback"
- "Run GBA Pulse editor feedback skill"
- "Update daily brief training from comparison docs"
- "Refresh editor selection weights"

## Source folders (repo-relative)

| Folder | Purpose |
|--------|---------|
| `Training Data/` | AI daily brief markdown (`YYYY-MM-DD-daily-brief.md`), parsed comparisons (`editor-comparisons/`), digest |
| `GBA Pulse Feedback/` | Downloaded Google Drive comparison Word docs (one per day) |

On the user's Surface, these map to:

- `...\the-bay-trending-topics\Training Data`
- `...\the-bay-trending-topics\GBA Pulse Feedback`

Google Drive source: https://drive.google.com/drive/folders/1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw?usp=sharing

## Weighting rules (selection only — not prose style)

| Editor tag | Weight |
|------------|--------|
| `[News selected]` | 3× |
| `[IG selected]` | 2× |
| `[Selected]` | 2× |

The agent must mirror **what** editors select, not **how** they write summaries.

## Workflow (execute in order)

### 1. Preflight

- Confirm repo root contains `Training Data/` and `GBA Pulse Feedback/`.
- If `GBA Pulse Feedback/` is missing or empty, tell the user to download comparison docx from Google Drive into that folder.
- Check `jszip` is installed: `node -e "import('jszip').then(()=>console.log('ok'))"`. If missing, run minimal install (see step 2).

### 2. Import comparison docx

**Windows (PowerShell):**

```powershell
py scripts/import-editor-comparisons.py
```

Or:

```powershell
node scripts/sync-editor-comparisons.mjs --import-dir="GBA Pulse Feedback"
```

Filenames must include a date (`2026-06-09`, `9 June 2026`, etc.) or files are skipped.

Copies into: `Training Data/editor-comparisons/raw/YYYY-MM-DD-comparison.docx`

### 3. Parse and build training artifacts

**Minimal local install (Windows ARM — if needed):**

```powershell
npm.cmd install jszip --omit=optional
```

**Parse + build:**

```powershell
npm.cmd run editor:feedback
```

Or:

```bash
node scripts/run-editor-feedback.mjs
```

**Outputs:**

- `Training Data/editor-comparisons/parsed/YYYY-MM-DD.json`
- `references/editor-selection-weights.json`
- `Training Data/editor-comparisons/digest/latest.md`

### 4. Optional — overlap report

If today's AI brief exists, compare against editor picks:

```powershell
npm.cmd run editor:compare
```

Report: `Training Data/editor-comparisons/reports/YYYY-MM-DD.md`

### 5. Summarize for the user

Report:

- How many docx imported / parsed
- Count of `[News selected]` / `[IG selected]` / `[Selected]` stories
- Top sections and domains in `editor-selection-weights.json`
- Whether digest was updated
- If overlap report exists: recall % (editor picks found in AI brief)

### 6. Git (only if user wants cloud to use new weights)

Ask before committing. If yes:

```bash
git add "Training Data/editor-comparisons/" references/editor-selection-weights.json
git commit -m "editor: refresh comparison training from manual feedback"
git push origin main
```

Until pushed, weights apply only locally and in the next agent run that attaches the digest.

## What this does NOT do

- Does **not** regenerate today's Daily Brief HTML automatically
- Does **not** run Trend Watch or Happenings
- Does **not** replace the scheduled daily cloud agents unless the user separately asks to run Daily Brief with updated digest attached

## Prompt attachments for next Daily Brief run

After this skill completes, the next **Daily Brief** generation should attach:

- `@Training Data/editor-comparisons/digest/latest.md`
- `@references/editor-selection-weights.json`
- `@prompts/daily-brief-agent-prompt.md` (editor calibration section)

## Troubleshooting (Windows Surface)

| Issue | Fix |
|-------|-----|
| `npm` blocked | Use `npm.cmd` |
| `gyp ERR` / `sqlite3` on full install | Use `npm.cmd install jszip --omit=optional` only |
| `jszip` not found | Delete `node_modules`, reinstall jszip |
| Files skipped on import | Add date to filename |

## Related scripts

- `scripts/import-editor-comparisons.py` — Python import (no npm)
- `scripts/parse-editor-comparison.mjs` — docx → JSON
- `scripts/build-editor-selection-model.mjs` — weights + digest
- `scripts/compare-daily-brief.mjs` — AI vs editor overlap
- `scripts/run-editor-feedback.mjs` — full on-demand pipeline
