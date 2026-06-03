#!/usr/bin/env node
/**
 * Fail CI if today's Daily Brief markdown or overall fragment is missing/stale.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ageHours, hktDateStr } from "./hkt-date.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = hktDateStr();
const briefPath = path.join(root, "Training Data", `${today}-daily-brief.md`);
const fragPath = path.join(root, "orchestration/fragments/overall.html");

let ok = true;

if (!fs.existsSync(briefPath)) {
  console.error(`Missing daily brief: Training Data/${today}-daily-brief.md`);
  ok = false;
} else {
  const stat = fs.statSync(briefPath);
  const ageH = (Date.now() - stat.mtimeMs) / 36e5;
  const maxH = Number(process.env.MAX_BRIEF_AGE_HOURS || "36");
  if (ageH > maxH) {
    console.error(`Daily brief mtime is ${ageH.toFixed(1)}h old (max ${maxH}h)`);
    ok = false;
  } else {
    console.log(`OK brief file Training Data/${today}-daily-brief.md (${ageH.toFixed(1)}h ago)`);
  }
}

if (!fs.existsSync(fragPath)) {
  console.error("Missing orchestration/fragments/overall.html");
  ok = false;
} else {
  const frag = fs.readFileSync(fragPath, "utf8");
  if (!frag.includes(`Edition: ${today}`) && !frag.includes(`Daily Brief · ${today}`)) {
    console.warn(`overall.html may not match today (${today}) — check edition stamp in fragment`);
  }
  const m = frag.match(/<!--[\s\S]*?Edition:\s*(\d{4}-\d{2}-\d{2})/);
  if (m && m[1] !== today) {
    console.warn(`Fragment edition ${m[1]} differs from HKT today ${today}`);
  }
  const articleMatch = frag.match(/(\d+)\s+articles/);
  if (articleMatch) {
    console.log(`OK overall fragment (${articleMatch[1]} articles)`);
  }
}

if (!ok) process.exit(1);
console.log("Daily Brief verification passed");
