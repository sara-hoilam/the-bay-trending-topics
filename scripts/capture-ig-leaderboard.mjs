#!/usr/bin/env node
/**
 * Refresh ig-leaderboard-data.json from references/ig-leaderboard-accounts.json.
 *
 * Snapshot fields per handle:
 *   { "followers": 641000, "posts7d": 35 }
 *
 * Usage:
 *   node scripts/capture-ig-leaderboard.mjs
 *   node scripts/capture-ig-leaderboard.mjs --snapshot=orchestration/ig-leaderboard-snapshot.json
 */
import fs from "fs";
import {
  buildLeaderboardData,
  loadAccountConfig,
  loadLeaderboardData,
  mergeSnapshot,
  writeLeaderboardData,
} from "./ig-leaderboard-utils.mjs";
import { hktDateStr } from "./hkt-date.mjs";

function readSnapshotArg() {
  const eq = process.argv.find((a) => a.startsWith("--snapshot="));
  if (!eq) return null;
  const p = eq.split("=")[1];
  if (!p || !fs.existsSync(p)) {
    console.error("Snapshot file not found:", p);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function seedSnapshot() {
  /** Instagram Competitors Benchmark baseline — overwritten by daily capture. */
  return {
    scmpnews: { followers: 641000, posts7d: 35 },
    tatlerhk: { followers: 251000, posts7d: 45 },
    the_trip_addict: { followers: 94000, posts7d: 12 },
    sassyhk: { followers: 91000, posts7d: 9 },
    thebayasia: { followers: 30900, posts7d: 6 },
    greaterbayvibes: { followers: 16500, posts7d: 9 },
  };
}

function main() {
  const today = hktDateStr();
  const configs = loadAccountConfig();
  const existing = loadLeaderboardData();
  const existingByHandle = {};
  for (const row of existing?.accounts || []) {
    existingByHandle[row.handle] = row;
  }

  let snapshot = readSnapshotArg();
  let captureMethod = snapshot ? "agent-snapshot" : "history-preserve";

  if (!snapshot && !existing) {
    snapshot = seedSnapshot();
    captureMethod = "benchmark-seed";
    console.log("No existing ig-leaderboard-data.json — seeding from competitors benchmark.");
  }

  const accounts = configs.map((cfg) => {
    const prev = existingByHandle[cfg.handle];
    const snap = snapshot?.[cfg.handle];
    if (snap) {
      return mergeSnapshot(prev, cfg, snap, today);
    }
    if (prev) {
      return mergeSnapshot(prev, cfg, { followers: prev.followers, posts7d: prev.posts7d }, today);
    }
    return mergeSnapshot(null, cfg, {}, today);
  });

  const data = buildLeaderboardData(accounts, captureMethod);
  writeLeaderboardData(data);
  const withFollowers = accounts.filter((a) => a.followers != null).length;
  console.log(
    `OK ig-leaderboard updatedAt=${data.updatedAt} (${withFollowers}/${accounts.length} accounts with follower counts)`
  );
}

main();
