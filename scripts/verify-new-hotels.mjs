#!/usr/bin/env node
/**
 * Fail CI if new-hotels-data.json is missing, stale, or empty after refresh.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "new-hotels-data.json");
const today = hktDateStr();

if (!fs.existsSync(jsonPath)) {
  console.error("Missing new-hotels-data.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const updatedAt = data.updatedAt;
if (!updatedAt) {
  console.error("Missing updatedAt in new-hotels-data.json");
  process.exit(1);
}

const maxDays = Number(process.env.MAX_NEW_HOTELS_AGE_DAYS || "2");
const updated = new Date(`${updatedAt}T12:00:00+08:00`);
const todayNoon = new Date(`${today}T12:00:00+08:00`);
const ageDays = (todayNoon - updated) / 864e5;

if (ageDays > maxDays) {
  console.error(
    `updatedAt ${updatedAt} is ${ageDays.toFixed(1)} days behind HKT today (max ${maxDays}d)`,
  );
  process.exit(1);
}

const hotels = data.hotels ?? [];
if (hotels.length < 1) {
  console.error("new-hotels-data.json has zero hotels in window");
  process.exit(1);
}

const required = ["name", "openDateLabel", "sourceUrl", "sourceDomain"];
for (const h of hotels.slice(0, 5)) {
  for (const key of required) {
    if (!h[key]) {
      console.error(`Hotel missing ${key}: ${JSON.stringify(h).slice(0, 200)}`);
      process.exit(1);
    }
  }
}

console.log(
  `OK new-hotels updatedAt=${updatedAt} (${hotels.length} hotels, window ${data.windowStart} → ${data.windowEnd})`,
);
