#!/usr/bin/env node
/**
 * Fail CI if hotel-press-data.json is missing or stale after refresh.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "hotel-press-data.json");
const today = hktDateStr();

if (!fs.existsSync(jsonPath)) {
  console.error("Missing hotel-press-data.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const updatedAt = data.updatedAt;
if (!updatedAt) {
  console.error("Missing updatedAt in hotel-press-data.json");
  process.exit(1);
}

const maxDays = Number(process.env.MAX_HOTEL_PRESS_AGE_DAYS || "2");
const updated = new Date(`${updatedAt}T12:00:00+08:00`);
const todayNoon = new Date(`${today}T12:00:00+08:00`);
const ageDays = (todayNoon - updated) / 864e5;

if (ageDays > maxDays) {
  console.error(
    `updatedAt ${updatedAt} is ${ageDays.toFixed(1)} days behind HKT today (max ${maxDays}d)`,
  );
  process.exit(1);
}

const articles = data.articles ?? [];
for (const a of articles.slice(0, 5)) {
  for (const key of ["title", "url", "posted", "sourceDomain"]) {
    if (!a[key]) {
      console.error(`Hotel Press article missing ${key}: ${JSON.stringify(a).slice(0, 200)}`);
      process.exit(1);
    }
  }
}

console.log(
  `OK hotel-press updatedAt=${updatedAt} (${articles.length} articles, window ${data.windowStart} → ${data.windowEnd})`,
);
