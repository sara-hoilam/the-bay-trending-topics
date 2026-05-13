#!/usr/bin/env node
/**
 * Splices HTML fragments into index.html between GBA_MERGE markers.
 * Usage (from repo root):
 *   node scripts/merge-briefing-panels.mjs
 *   node scripts/merge-briefing-panels.mjs --index=./index.html --claude=./orchestration/fragments/claude.html
 *
 * Fragment files should contain ONLY the inner HTML (no <main> wrapper):
 * the same block you would paste between <!-- GBA_MERGE:ZONE:START --> and END.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function parseArgs(argv) {
  const out = { index: path.join(root, "index.html") };
  for (const a of argv) {
    const m = a.match(/^--(\w+)=(.+)$/);
    if (m) out[m[1]] = path.resolve(root, m[2]);
  }
  return out;
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
};

let html = fs.readFileSync(args.index, "utf8");

for (const zone of ["overall", "claude", "composer", "chatgpt"]) {
  const fragPath = args[zone] ?? defaults[zone];
  if (!fs.existsSync(fragPath)) {
    console.warn(`Skip ${zone}: file not found: ${fragPath}`);
    continue;
  }
  const inner = normalizeFragment(fs.readFileSync(fragPath, "utf8"));
  html = replaceZone(html, zone, inner);
  console.log(`Merged ${zone} <= ${fragPath}`);
}

fs.writeFileSync(args.index, html);
console.log("Wrote", args.index);
