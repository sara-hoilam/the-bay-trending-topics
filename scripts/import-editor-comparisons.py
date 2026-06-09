#!/usr/bin/env python3
"""
Import comparison .docx from a local folder → Training Data/editor-comparisons/raw/

No Node.js required. Run the parse/build steps separately after installing Node,
or ask a teammate to run npm run editor:pipeline on a machine with Node.

Usage (from repo root):
  py scripts/import-editor-comparisons.py
  py scripts/import-editor-comparisons.py "GBA Pulse Feedback"
  py scripts/import-editor-comparisons.py "C:\\Users\\...\\GBA Pulse Feedback"
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "Training Data" / "editor-comparisons" / "raw"
DEFAULT_IMPORT = ROOT / "GBA Pulse Feedback"

MONTHS = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "jun": "06",
    "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def extract_date(name: str) -> str | None:
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    m = re.search(r"(\d{4})[_\s](\d{1,2})[_\s](\d{1,2})", name)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})", name, re.I)
    if m:
        mo = MONTHS.get(m.group(2).lower())
        if mo:
            return f"{m.group(3)}-{mo}-{int(m.group(1)):02d}"

    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})", name, re.I)
    if m:
        mo = MONTHS.get(m.group(1).lower())
        if mo:
            return f"{m.group(3)}-{mo}-{int(m.group(2)):02d}"

    return None


def find_docx(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    out: list[Path] = []
    for p in folder.rglob("*.docx"):
        if p.name.startswith("~$"):
            continue
        out.append(p)
    return sorted(out)


def main() -> int:
    import_dir = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_IMPORT
    if not import_dir.is_absolute():
        import_dir = (ROOT / import_dir).resolve()

    RAW.mkdir(parents=True, exist_ok=True)

    if not import_dir.is_dir():
        print(f"Folder not found: {import_dir}")
        print('Create it or pass a path: py scripts/import-editor-comparisons.py "GBA Pulse Feedback"')
        return 1

    files = find_docx(import_dir)
    if not files:
        print(f"No .docx files under {import_dir}")
        return 1

    copied = skipped = 0
    for src in files:
        date = extract_date(src.name)
        if not date:
            print(f"Skip (no date in filename): {src.name}")
            skipped += 1
            continue

        dest = RAW / f"{date}-comparison.docx"
        if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
            print(f"Up to date: {dest.name}")
            continue

        shutil.copy2(src, dest)
        print(f"Imported: {src.name} → {dest.name}")
        copied += 1

    print(f"\nDone: {copied} copied, {skipped} skipped.")
    print(f"Output folder: {RAW}")
    print("\nNext (requires Node.js): npm run editor:pipeline")
    print("Or install Node from https://nodejs.org/ then run that command.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
