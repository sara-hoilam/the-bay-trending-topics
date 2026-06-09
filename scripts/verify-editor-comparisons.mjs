#!/usr/bin/env node
/**
 * Warn if editor comparison training data is stale or missing.
 */
import fs from "fs";
import path from "path";
import { listParsedJson, paths } from "./editor-comparison-utils.mjs";

const MAX_AGE_DAYS = Number(process.env.MAX_COMPARISON_AGE_DAYS ?? 7);
let warnings = 0;

const parsed = listParsedJson();
if (!parsed.length) {
  console.warn("WARN: No parsed editor comparison files — training uses defaults only.");
  warnings++;
} else {
  const latest = parsed[0].replace(".json", "");
  const ageMs = Date.now() - new Date(`${latest}T12:00:00Z`).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays > MAX_AGE_DAYS) {
    console.warn(
      `WARN: Latest comparison edition ${latest} is ${ageDays.toFixed(1)} days old (max ${MAX_AGE_DAYS}d).`,
    );
    warnings++;
  } else {
    console.log(`OK latest comparison: ${latest} (${ageDays.toFixed(1)}d ago)`);
  }
}

if (!fs.existsSync(paths.weights)) {
  console.warn("WARN: references/editor-selection-weights.json missing — run build-editor-selection-model.mjs");
  warnings++;
} else {
  console.log("OK editor-selection-weights.json present");
}

if (!fs.existsSync(path.join(paths.digest, "latest.md"))) {
  console.warn("WARN: digest/latest.md missing");
  warnings++;
} else {
  console.log("OK digest/latest.md present");
}

if (warnings) {
  console.log(`Editor comparison verification: ${warnings} warning(s)`);
  process.exit(0);
}
console.log("Editor comparison verification passed");
