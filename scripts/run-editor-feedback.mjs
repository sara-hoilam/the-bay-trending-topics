#!/usr/bin/env node
/**
 * On-demand editor feedback pipeline (invoke via skill or npm run editor:feedback).
 * NOT run automatically by daily cloud refresh.
 */
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { paths, root, listRawDocx, listParsedJson } from "./editor-comparison-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const feedbackDir = path.join(root, "GBA Pulse Feedback");
console.log("GBA Pulse — editor feedback (on-demand)\n");

if (!fs.existsSync(feedbackDir)) {
  console.warn(`Warning: GBA Pulse Feedback/ not found at ${feedbackDir}`);
  console.warn("Create it and add comparison .docx files from Google Drive.");
} else {
  const docx = fs
    .readdirSync(feedbackDir, { recursive: true })
    .filter((f) => typeof f === "string" && /\.docx$/i.test(f) && !String(f).startsWith("~$"));
  console.log(`GBA Pulse Feedback: ${docx.length} docx file(s) found`);
}

const importDir = path.join(root, "GBA Pulse Feedback");
if (fs.existsSync(importDir)) {
  run("sync-editor-comparisons.mjs", [`--import-dir=${importDir}`]);
}

run("parse-editor-comparison.mjs", ["--force"]);
run("build-editor-selection-model.mjs");

const today = new Date().toISOString().slice(0, 10);
tryRun("compare-daily-brief.mjs", [`--date=${today}`]);

console.log("\n--- Summary ---");
console.log(`raw/: ${listRawDocx().length} docx`);
console.log(`parsed/: ${listParsedJson().length} editions`);
if (fs.existsSync(paths.weights)) {
  const w = JSON.parse(fs.readFileSync(paths.weights, "utf8"));
  console.log(`totalSelectedStories: ${w.totalSelectedStories ?? 0}`);
  console.log(`tagCounts: ${JSON.stringify(w.tagCounts ?? {})}`);
}
console.log("\nEditor feedback complete. Weights apply on next Daily Brief run with digest attached.");
