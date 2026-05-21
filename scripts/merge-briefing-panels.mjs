#!/usr/bin/env node
/**
 * Splices HTML fragments into index.html between GBA_MERGE markers.
 * Usage (from repo root):
 *   node scripts/merge-briefing-panels.mjs
 *   node scripts/merge-briefing-panels.mjs --index=./index.html --claude=./orchestration/fragments/claude.html
 *
 * Fragment files should contain ONLY the inner HTML (no <main> wrapper):
 * the same block you would paste between <!-- GBA_MERGE:ZONE:START --> and END.
 *
 * After merging, updates masthead Date | Generated (HKT) and footer edition date
 * unless you pass --no-stamp.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseArgs(argv) {
  const out = { index: path.join(root, "index.html"), noStamp: false };
  for (const a of argv) {
    if (a === "--no-stamp") {
      out.noStamp = true;
      continue;
    }
    const m = a.match(/^--(\w+)=(.+)$/);
    if (m) out[m[1]] = path.resolve(root, m[2]);
  }
  return out;
}

/** Asia/Hong_Kong calendar date YYYY-MM-DD and clock HH:MM (24h) for masthead/footer. */
function mastheadStampParts() {
  const tz = "Asia/Hong_Kong";
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(/\u202f/g, " ");
  return { dateStr, timeStr };
}

function applyEditionStamp(html) {
  const { dateStr, timeStr } = mastheadStampParts();
  const mastheadInner = `Date: ${dateStr} &nbsp;|&nbsp; Generated: ${timeStr} HKT`;
  const footerInner = `GBA Pulse · 粤港澳大湾区脉搏 · ${dateStr}`;

  if (!html.includes('id="gba-masthead-stamp"') || !html.includes('id="gba-footer-edition"')) {
    throw new Error(
      "index.html must include spans id=\"gba-masthead-stamp\" and id=\"gba-footer-edition\" for edition stamping.",
    );
  }

  return html
    .replace(/(<span\s+id="gba-masthead-stamp">)[\s\S]*?(<\/span>)/, `$1${mastheadInner}$2`)
    .replace(/(<span\s+id="gba-footer-edition">)[\s\S]*?(<\/span>)/, `$1${footerInner}$2`);
}

function replaceZone(html, zone, inner) {
  const start = `<!-- GBA_MERGE:${zone}:START -->`;
  const end = `<!-- GBA_MERGE:${zone}:END -->`;
  const startIndex = html.indexOf(start);
  const endIndex = html.lastIndexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing merge markers for zone "${zone}" in index.html`);
  }
  return [
    html.slice(0, startIndex),
    start,
    "\n",
    inner.trim(),
    "\n",
    end,
    html.slice(endIndex + end.length),
  ].join("");
}

function normalizeFragment(raw) {
  const mainMatch = raw.match(/<main\s+class=["']wrapper["'][^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1].trim();
  return raw.trim();
}

const args = parseArgs(process.argv.slice(2));
const defaults = {
  overall: path.join(root, "orchestration/fragments/overall.html"),
  claude: path.join(root, "orchestration/fragments/claude.html"),
  composer: path.join(root, "orchestration/fragments/composer.html"),
  chatgpt: path.join(root, "orchestration/fragments/chatgpt.html"),
  trendwatch: path.join(root, "orchestration/fragments/trendwatch.html"),
};

let html = fs.readFileSync(args.index, "utf8");

// chatgpt zone omitted — Trending News uses Claude + Composer only; panel stays hidden in UI
for (const zone of ["overall", "claude", "composer", "trendwatch"]) {
  const fragPath = args[zone] ?? defaults[zone];
  if (!fs.existsSync(fragPath)) {
    console.warn(`Skip ${zone}: file not found: ${fragPath}`);
    continue;
  }
  const inner = normalizeFragment(fs.readFileSync(fragPath, "utf8"));
  html = replaceZone(html, zone, inner);
  console.log(`Merged ${zone} <= ${fragPath}`);
}

if (!args.noStamp) {
  html = applyEditionStamp(html);
  const { dateStr, timeStr } = mastheadStampParts();
  console.log(`Stamped edition meta (HKT): ${dateStr} ${timeStr}`);
} else {
  console.log("Skipped masthead/footer stamp (--no-stamp)");
}

fs.writeFileSync(args.index, html);
console.log("Wrote", args.index);
