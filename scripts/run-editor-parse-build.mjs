#!/usr/bin/env node
/**
 * Parse + build only (no sync). Minimal local install: npm install jszip --omit=optional
 */
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function run(script) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n→ node scripts/${script}`);
  execFileSync(process.execPath, [scriptPath], { cwd: root, stdio: "inherit" });
}

console.log("Editor parse + build (local minimal)");
run("parse-editor-comparison.mjs");
run("build-editor-selection-model.mjs");
console.log("\nDone.");
