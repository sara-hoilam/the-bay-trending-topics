#!/usr/bin/env node
/**
 * Editor comparison training pipeline: sync → parse → build
 */
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function run(script, args = []) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n→ node scripts/${script}${args.length ? " " + args.join(" ") : ""}`);
  try {
    execFileSync(process.execPath, [scriptPath, ...args], { cwd: root, stdio: "inherit" });
  } catch (err) {
    if (err.status === undefined) throw err;
    console.warn(`Script ${script} exited ${err.status} (non-fatal)`);
  }
}

console.log("Editor comparison pipeline");
run("sync-editor-comparisons.mjs");
run("parse-editor-comparison.mjs");
run("build-editor-selection-model.mjs");
console.log("\nEditor comparison pipeline done.");
