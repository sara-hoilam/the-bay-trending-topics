#!/usr/bin/env node
/**
 * Fail CI if Trend Watch JSON is missing or refreshedAt is too old.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const frag = fs.readFileSync(
  path.join(root, "orchestration/fragments/trendwatch.html"),
  "utf8",
);
const m = frag.match(
  /<script type="application\/json" id="trend-watch-data">\s*([\s\S]*?)\s*<\/script>/,
);
if (!m) {
  console.error("Missing trend-watch-data JSON");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(m[1]);
} catch (e) {
  console.error("Invalid trend-watch JSON:", e.message);
  process.exit(1);
}

const at = data.refreshedAt;
if (!at) {
  console.error("Missing refreshedAt");
  process.exit(1);
}

const ageH = (Date.now() - new Date(at).getTime()) / 36e5;
const maxH = Number(process.env.MAX_CAPTURE_AGE_HOURS || "36");
if (ageH > maxH) {
  console.error(`refreshedAt ${at} is ${ageH.toFixed(1)}h old (max ${maxH}h)`);
  process.exit(1);
}

if (!Array.isArray(data.topicCandidates) || data.topicCandidates.length < 10) {
  console.warn("topicCandidates missing or < 10 — edition run may be weaker");
}

console.log(`OK trendwatch refreshedAt=${at} (${ageH.toFixed(1)}h ago)`);
