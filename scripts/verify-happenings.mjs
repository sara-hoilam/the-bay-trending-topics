#!/usr/bin/env node
/**
 * Fail CI if happenings-events.json is missing or updatedAt is too old.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "happenings-events.json");
const today = hktDateStr();

if (!fs.existsSync(jsonPath)) {
  console.error("Missing happenings-events.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const updatedAt = data.updatedAt;
if (!updatedAt) {
  console.error("Missing updatedAt in happenings-events.json");
  process.exit(1);
}

const maxDays = Number(process.env.MAX_HAPPENINGS_AGE_DAYS || "2");
const updated = new Date(`${updatedAt}T12:00:00+08:00`);
const todayNoon = new Date(`${today}T12:00:00+08:00`);
const ageDays = (todayNoon - updated) / 864e5;

if (ageDays > maxDays) {
  console.error(`updatedAt ${updatedAt} is ${ageDays.toFixed(1)} days behind HKT today (max ${maxDays}d)`);
  process.exit(1);
}

const events = data.events ?? [];
const future = events.filter((ev) => ev.end >= today);
if (future.length < 5) {
  console.warn(`Only ${future.length} upcoming events (expected ≥5)`);
}

console.log(`OK happenings updatedAt=${updatedAt} (${events.length} events, ${future.length} upcoming)`);
