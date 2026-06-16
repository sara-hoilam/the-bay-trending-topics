#!/usr/bin/env node
/**
 * Refresh ig-leaderboard-data.json from references/ig-leaderboard-accounts.json.
 *
 * Snapshot fields per handle:
 *   { "followers": 641000, "posts7d": 35, "postsToday": 4 }
 *
 * Usage:
 *   node scripts/capture-ig-leaderboard.mjs
 *   node scripts/capture-ig-leaderboard.mjs --snapshot=orchestration/ig-leaderboard-snapshot.json
 *   node scripts/capture-ig-leaderboard.mjs --refresh
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import {
  buildLeaderboardData,
  loadAccountConfig,
  loadLeaderboardData,
  mergeSnapshot,
  writeLeaderboardData,
} from "./ig-leaderboard-utils.mjs";
import { hktDateStr } from "./hkt-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readSnapshotArg() {
  const eq = process.argv.find((a) => a.startsWith("--snapshot="));
  if (!eq) return null;
  const p = eq.split("=")[1];
  if (!p || !fs.existsSync(p)) {
    console.error("Snapshot file not found:", p);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return raw.accounts ?? raw;
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  if (snapshot.accounts && typeof snapshot.accounts === "object") {
    return snapshot.accounts;
  }
  const out = {};
  for (const [handle, val] of Object.entries(snapshot)) {
    if (handle === "capturedAt" || handle === "notes") continue;
    if (
      val &&
      typeof val === "object" &&
      ("followers" in val || "posts7d" in val || "postsToday" in val)
    ) {
      out[handle] = val;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Fetched API data wins; manual snapshot only fills missing followers. */
function mergeFetchedAndManual(fetched, manual) {
  const out = { ...fetched };
  for (const [handle, manualSnap] of Object.entries(manual || {})) {
    if (!out[handle]) {
      out[handle] = { followers: manualSnap.followers ?? null };
      continue;
    }
    if (out[handle].followers == null && manualSnap.followers != null) {
      out[handle].followers = manualSnap.followers;
    }
  }
  return out;
}

function snapshotFields(snap, prev) {
  const fields = {};
  if (snap.followers != null) fields.followers = snap.followers;
  else if (prev?.followers != null) fields.followers = prev.followers;
  if ("posts7d" in snap) fields.posts7d = snap.posts7d;
  if ("postsToday" in snap) fields.postsToday = snap.postsToday;
  return fields;
}

function seedSnapshot() {
  return {
    scmpnews: { followers: 648769, posts7d: 30 },
    tatlerhongkong: { followers: 256204, posts7d: 50 },
    the_trip_addict: { followers: 94494, posts7d: 7 },
    sassyhongkong: { followers: 91246, posts7d: 8 },
    thebayasia: { followers: 31696, posts7d: 11 },
    greaterbayvibes: { followers: 17268, posts7d: 8 },
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

  let snapshot = normalizeSnapshot(readSnapshotArg());
  let captureMethod = snapshot ? "agent-snapshot" : "history-preserve";

  if (process.argv.includes("--refresh")) {
    const fetchPath = path.join(__dirname, "fetch-ig-benchmark.mjs");
    try {
      execFileSync(process.execPath, [fetchPath], { cwd: root, stdio: "inherit" });
    } catch {
      console.warn("fetch-ig-benchmark.mjs failed — continuing with manual snapshot if present");
    }
    const snapPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");
    const manualPath = path.join(root, "references/ig-leaderboard-manual-snapshot.json");
    const fetched = fs.existsSync(snapPath)
      ? normalizeSnapshot(JSON.parse(fs.readFileSync(snapPath, "utf8")))
      : {};
    const manual = fs.existsSync(manualPath)
      ? normalizeSnapshot(JSON.parse(fs.readFileSync(manualPath, "utf8")))
      : {};
    snapshot = mergeFetchedAndManual(fetched, manual);
    captureMethod = "public-refresh";
  }

  if (!snapshot && !existing) {
    snapshot = seedSnapshot();
    captureMethod = "benchmark-seed";
    console.log("No existing ig-leaderboard-data.json — seeding from competitors benchmark.");
  }

  const accounts = configs.map((cfg) => {
    const prev = existingByHandle[cfg.handle];
    const snap = snapshot?.[cfg.handle];
    if (snap) {
      return mergeSnapshot(prev, cfg, snapshotFields(snap, prev), today);
    }
    if (prev) {
      return mergeSnapshot(prev, cfg, { followers: prev.followers }, today);
    }
    return mergeSnapshot(null, cfg, {}, today);
  });

  const data = buildLeaderboardData(accounts, captureMethod);
  writeLeaderboardData(data);
  const withFollowers = accounts.filter((a) => a.followers != null).length;
  const withPostsToday = accounts.filter((a) => a.postsToday != null).length;
  console.log(
    `OK ig-leaderboard updatedAt=${data.updatedAt} (${withFollowers}/${accounts.length} accounts with follower counts, ${withPostsToday} with today's post count)`
  );

  if (!process.argv.includes("--no-sheet-sync")) {
    const sheetPath = path.join(__dirname, "sync-ig-leaderboard-sheet.mjs");
    try {
      execFileSync(process.execPath, [sheetPath], { cwd: root, stdio: "inherit" });
    } catch {
      console.warn("sync-ig-leaderboard-sheet.mjs failed — leaderboard JSON was still saved");
    }
  }
}

main();
