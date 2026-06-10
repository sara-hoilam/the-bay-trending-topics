/** Shared paths and helpers for editor comparison doc ingestion. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(__dirname, "..");

export const DRIVE_FOLDER_ID = "1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw";
export const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw?usp=sharing";

/** Unified weight for any managing-editor pick ([selected] or legacy tags). */
export const TAG_WEIGHTS = { selected: 4 };

/** Bonuses when a candidate resembles past editor-selected stories. */
export const SELECTION_BONUSES = {
  urlMatch: 3,
  headlineSimilarity: 2,
  storyType: 2,
};

export const SECTION_NAMES = [
  "GBA News",
  "Macao",
  "Hong Kong",
  "Zhuhai inc. Hengqin",
  "Guangzhou",
  "Shenzhen",
  "Foshan",
  "Huizhou",
  "Dongguan",
  "Zhongshan",
  "Jiangmen",
  "Zhaoqing",
  "Nation",
  "GBA sport",
];

export const paths = {
  base: path.join(root, "Training Data", "editor-comparisons"),
  raw: path.join(root, "Training Data", "editor-comparisons", "raw"),
  parsed: path.join(root, "Training Data", "editor-comparisons", "parsed"),
  digest: path.join(root, "Training Data", "editor-comparisons", "digest"),
  reports: path.join(root, "Training Data", "editor-comparisons", "reports"),
  weights: path.join(root, "references", "editor-selection-weights.json"),
};

export const SELECTION_TAG_RE =
  /\[(?:selected|IG\s+selected|News\s+selected)\]/i;

export const RED_COLOR_VALUES = new Set([
  "FF0000",
  "C00000",
  "EE0000",
  "C0504D",
  "943634",
  "FF0000",
  "red",
]);

export function ensureDirs() {
  for (const p of Object.values(paths)) {
    if (p.endsWith(".json")) continue;
    fs.mkdirSync(p, { recursive: true });
  }
}

const MONTHS = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function extractDateFromFilename(name) {
  const iso = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const isoCompact = name.match(/(\d{4})[_\s](\d{1,2})[_\s](\d{1,2})/);
  if (isoCompact) {
    const mm = isoCompact[2].padStart(2, "0");
    const dd = isoCompact[3].padStart(2, "0");
    return `${isoCompact[1]}-${mm}-${dd}`;
  }

  const dmy = name.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (dmy) {
    const mo = MONTHS[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${mo}-${dmy[1].padStart(2, "0")}`;
  }

  const mdy = name.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (mdy) {
    const mo = MONTHS[mdy[1].toLowerCase()];
    if (mo) return `${mdy[3]}-${mo}-${mdy[2].padStart(2, "0")}`;
  }

  const monDashDay = name.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[a-z]*-(\d{1,2})\b/i,
  );
  if (monDashDay) {
    const mo = MONTHS[monDashDay[1].toLowerCase()];
    if (mo) {
      const year = name.match(/(\d{4})/)?.[1] ?? String(new Date().getFullYear());
      return `${year}-${mo}-${monDashDay[2].padStart(2, "0")}`;
    }
  }

  return null;
}

export function standardRawFilename(sourceName) {
  const date = extractDateFromFilename(sourceName);
  if (date) return `${date}-comparison.docx`;
  return sourceName.endsWith(".docx") ? sourceName : `${sourceName}.docx`;
}

export function findDocxFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("~$") || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findDocxFiles(full, results);
    else if (/\.docx$/i.test(entry.name)) results.push(full);
  }
  return results;
}

export function listRawDocx() {
  if (!fs.existsSync(paths.raw)) return [];
  return fs
    .readdirSync(paths.raw)
    .filter((f) => /\.docx$/i.test(f) && !f.startsWith("~$"))
    .sort();
}

export function listParsedJson() {
  if (!fs.existsSync(paths.parsed)) return [];
  return fs
    .readdirSync(paths.parsed)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
}

export function parseSelectionTag(text) {
  if (SELECTION_TAG_RE.test(text)) return "selected";
  return null;
}

/** Normalize legacy parsed tags (news / ig / generic) to unified selected. */
export function normalizeSelectionTag(tag) {
  if (!tag) return null;
  if (tag === "selected") return "selected";
  if (tag === "news" || tag === "ig" || tag === "generic") return "selected";
  return tag;
}

export function tagWeight(tag) {
  if (!normalizeSelectionTag(tag)) return 0;
  return TAG_WEIGHTS.selected;
}

export function normalizeHeadline(s) {
  return s
    .replace(SELECTION_TAG_RE, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectSection(line) {
  const trimmed = line.trim();
  for (const name of SECTION_NAMES) {
    if (new RegExp(`^${name.replace(".", "\\.")}(?:\\s*\\(\\d+\\))?:?$`, "i").test(trimmed)) {
      return name;
    }
  }
  const short = trimmed.replace(/\s*\(\d+\):?\s*$/, "");
  if (SECTION_NAMES.some((n) => n.toLowerCase() === short.toLowerCase())) {
    return SECTION_NAMES.find((n) => n.toLowerCase() === short.toLowerCase());
  }
  return null;
}

export function detectSourceSide(text) {
  const t = text.toLowerCase();
  if (/\b(manual\s+brief|colleague\s+brief|managing\s+editor)\b/.test(t)) return "manual";
  if (/\b(gba\s*pulse|ai\s*gen|ai-generated|automated\s+brief)\b/.test(t)) return "ai";
  return null;
}

export function extractUrls(text) {
  return [...text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map((m) => m[0]);
}

export function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function headlineSimilarity(a, b) {
  const na = normalizeHeadline(a).toLowerCase();
  const nb = normalizeHeadline(b).toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = new Set(na.split(/\W+/).filter((w) => w.length > 3));
  const wb = new Set(nb.split(/\W+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.max(wa.size, wb.size);
}
