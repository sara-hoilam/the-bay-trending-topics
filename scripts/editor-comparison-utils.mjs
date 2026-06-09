/** Shared paths and helpers for editor comparison doc ingestion. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(__dirname, "..");

export const DRIVE_FOLDER_ID = "1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw";
export const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1sUw2ipTfv-UkVOZnrWuX9-7DGsMHshaw?usp=sharing";

export const TAG_WEIGHTS = { news: 3, ig: 2, generic: 2 };

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
  /\[(?:IG\s+selected|News\s+selected|Selected)\]/i;

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

export function extractDateFromFilename(name) {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
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
  const ig = /\[IG\s+selected\]/i.test(text);
  const news = /\[News\s+selected\]/i.test(text);
  const generic = /\[Selected\]/i.test(text);
  if (news) return "news";
  if (ig) return "ig";
  if (generic) return "generic";
  return null;
}

export function tagWeight(tag) {
  if (!tag) return 0;
  return TAG_WEIGHTS[tag] ?? TAG_WEIGHTS.generic;
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
