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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const skipVerify = process.argv.includes("--skip-verify");

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

const today = hktDateStr();
console.log(`Daily post-pipeline (HKT ${today})`);

run("generate-source-links-data.mjs");
run("generate-happenings-data.mjs");

const briefRel = `Training Data/${today}-daily-brief.md`;
const briefPath = path.join(root, briefRel);
if (fs.existsSync(briefPath)) {
  run("daily-brief-to-html.mjs", [`--input=${briefRel}`, "--merge"]);
} else {
  console.warn(`No ${briefRel} — skipping daily-brief-to-html (cloud Run 2 may have failed)`);
  run("merge-briefing-panels.mjs");
}

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
