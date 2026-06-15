#!/usr/bin/env node
/**
 * Refresh ig-leaderboard-data.json from references/ig-leaderboard-accounts.json.
 *
 * Modes:
 *   node scripts/capture-ig-leaderboard.mjs
 *     Merge optional --snapshot JSON file or preserve existing history.
 *   node scripts/capture-ig-leaderboard.mjs --snapshot=path/to/snap.json
 *     snap.json: { "discoverhongkong": { "followers": 716900, "engagementRate": 0.0101 }, ... }
 *
 * Daily cloud agent (prompts/gba-pulse-cloud-run4-ig-leaderboard.md) browses each
 * Instagram profile and writes a snapshot file before this script runs.
 *
 * Usage: node scripts/capture-ig-leaderboard.mjs
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
  /** Initial public-profile estimates (Checkbb, Jun 2026) — overwritten by daily capture. */
  return {
    discoverhongkong: { followers: 716900, engagementRate: 0.0101 },
    visit_singapore: { followers: 829800, engagementRate: 0.0057 },
    tourismthailand: { followers: 305200, engagementRate: 0.081 },
    visitlondon: { followers: 1800000, engagementRate: 0.0011 },
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
    captureMethod = "checkbb-seed";
    console.log("No existing ig-leaderboard-data.json — seeding from public profile estimates.");
  }

  const accounts = configs.map((cfg) => {
    const prev = existingByHandle[cfg.handle];
    const snap = snapshot?.[cfg.handle];
    if (snap) {
      return mergeSnapshot(prev, cfg, snap, today);
    }
    if (prev) {
      return mergeSnapshot(prev, cfg, { followers: prev.followers, engagementRate: prev.engagementRate, posts: prev.posts }, today);
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
