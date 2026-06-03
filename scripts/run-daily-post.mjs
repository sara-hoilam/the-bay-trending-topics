#!/usr/bin/env node
/**
 * Post-cloud daily pipeline: regenerate static data, convert brief, verify, merge.
 *
 * Usage: node scripts/run-daily-post.mjs
 *   --skip-verify   continue even if verify scripts fail (warn only)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { hktDateStr } from "./hkt-date.mjs";
import {
  isDailyBriefFragment,
  isTrendingNewsFragment,
  resolveDailyBriefInput,
} from "./daily-brief-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const skipVerify = process.argv.includes("--skip-verify");
const overallPath = path.join(root, "orchestration/fragments/overall.html");

function run(script, args = []) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n→ node scripts/${script}${args.length ? " " + args.join(" ") : ""}`);
  execFileSync(process.execPath, [scriptPath, ...args], { cwd: root, stdio: "inherit" });
}

function tryRun(script, args = []) {
  try {
    run(script, args);
    return true;
  } catch {
    return false;
  }
}

function relBriefPath(absPath) {
  return path.relative(root, absPath);
}

function ensureDailyBriefOverall() {
  const briefPath = resolveDailyBriefInput(null);
  if (!briefPath) {
    console.warn("No daily brief markdown in Training Data/ — skipping overall conversion");
    run("merge-briefing-panels.mjs");
    return;
  }

  let needsConvert = true;
  if (fs.existsSync(overallPath)) {
    const overall = fs.readFileSync(overallPath, "utf8");
    if (isDailyBriefFragment(overall) && !isTrendingNewsFragment(overall)) {
      needsConvert = false;
      console.log(`overall.html is Daily Brief format (${path.basename(briefPath)})`);
    } else if (isTrendingNewsFragment(overall)) {
      console.warn("overall.html contains Trend Watch / Trending News — converting from daily brief markdown");
    }
  }

  if (needsConvert) {
    run("daily-brief-to-html.mjs", [`--input=${relBriefPath(briefPath)}`, "--merge"]);
  } else {
    run("merge-briefing-panels.mjs");
  }
}

const today = hktDateStr();
console.log(`Daily post-pipeline (HKT ${today})`);

run("generate-source-links-data.mjs");
run("generate-happenings-data.mjs");
run("prune-trendwatch-gba.mjs");
ensureDailyBriefOverall();

const checks = [
  ["verify-daily-capture.mjs", true],
  ["verify-daily-brief.mjs", false],
  ["verify-happenings.mjs", false],
];

for (const [script, required] of checks) {
  const ok = tryRun(script);
  if (!ok && (required || !skipVerify)) {
    console.error(`Required check failed: ${script}`);
    process.exit(1);
  }
  if (!ok && skipVerify) {
    console.warn(`Skipped failing check: ${script}`);
  }
}

console.log("\nPost-pipeline complete.");
