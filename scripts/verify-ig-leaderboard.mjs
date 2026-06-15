#!/usr/bin/env node
/**
 * Fail CI if ig-leaderboard-data.json is missing or updatedAt is too old.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "ig-leaderboard-data.json");

if (!fs.existsSync(jsonPath)) {
  console.error("Missing ig-leaderboard-data.json");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const updatedAt = data.updatedAt;
if (!updatedAt) {
  console.error("Missing updatedAt in ig-leaderboard-data.json");
  process.exit(1);
}

const maxDays = Number(process.env.MAX_IG_LEADERBOARD_AGE_DAYS || "7");
const ageMs = Date.now() - new Date(updatedAt + "T12:00:00+08:00").getTime();
const ageDays = ageMs / 86400000;
if (ageDays > maxDays) {
  console.error(`ig-leaderboard updatedAt=${updatedAt} is ${ageDays.toFixed(1)} days old (max ${maxDays})`);
  process.exit(1);
}

const accounts = data.accounts || [];
const tracked = accounts.filter((a) => a.followers != null).length;
console.log(`OK ig-leaderboard updatedAt=${updatedAt} (${tracked}/${accounts.length} accounts tracked)`);
