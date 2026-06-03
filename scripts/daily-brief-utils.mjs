/** Helpers for Daily Brief markdown paths and overall fragment detection. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(__dirname, "..");

export function listDailyBriefFiles() {
  const dir = path.join(root, "Training Data");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-daily-brief\.md$/.test(f))
    .sort()
    .reverse();
}

export function briefPathForDate(isoDate) {
  return path.join(root, "Training Data", `${isoDate}-daily-brief.md`);
}

/** Prefer edition date stamped in overall.html, then newest brief file. Never assumes HKT today. */
export function resolveDailyBriefInput(explicitPath) {
  if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;

  const overallPath = path.join(root, "orchestration/fragments/overall.html");
  if (fs.existsSync(overallPath)) {
    const frag = fs.readFileSync(overallPath, "utf8");
    const m = frag.match(/Edition:\s*(\d{4}-\d{2}-\d{2})/);
    if (m) {
      const editionBrief = briefPathForDate(m[1]);
      if (fs.existsSync(editionBrief)) return editionBrief;
    }
  }

  const files = listDailyBriefFiles();
  if (files.length) return path.join(root, "Training Data", files[0]);

  return null;
}

export function isDailyBriefFragment(html) {
  return /brief-article|THE BAY: Daily Brief/i.test(html);
}

export function isTrendingNewsFragment(html) {
  return /Interesting Angles|Trend score:/i.test(html) && !/brief-article/i.test(html);
}
