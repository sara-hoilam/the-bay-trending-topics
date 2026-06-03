#!/usr/bin/env node
/**
 * Fail CI if overall panel is Trending News format or daily brief markdown is missing/stale.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";
import {
  isDailyBriefFragment,
  isTrendingNewsFragment,
  listDailyBriefFiles,
  briefPathForDate,
} from "./daily-brief-utils.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = hktDateStr();
const briefPath = briefPathForDate(today);
const fragPath = path.join(root, "orchestration/fragments/overall.html");

let ok = true;

if (!fs.existsSync(briefPath)) {
  const latest = listDailyBriefFiles()[0];
  if (latest) {
    console.warn(`No brief for HKT today; latest file is ${latest}`);
  } else {
    console.error(`Missing daily brief: Training Data/${today}-daily-brief.md`);
    ok = false;
  }
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
  if (isTrendingNewsFragment(frag)) {
    console.error("overall.html is Trending News format — Daily Brief tab will show wrong content");
    ok = false;
  } else if (!isDailyBriefFragment(frag)) {
    console.error("overall.html is not a recognised Daily Brief fragment");
    ok = false;
  } else {
    const articleMatch = frag.match(/(\d+)\s+articles/);
    if (articleMatch) {
      console.log(`OK overall fragment (${articleMatch[1]} articles, Daily Brief format)`);
    }
  }
}

if (!ok) process.exit(1);
console.log("Daily Brief verification passed");
