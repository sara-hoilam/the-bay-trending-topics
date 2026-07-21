#!/usr/bin/env node
/**
 * Refresh ig-leaderboard-data.json from references/ig-leaderboard-accounts.json.
 *
 * Snapshot fields per handle: { "followers": 641000 }
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
  applyGrowthFromHistory,
  loadAccountConfig,
  loadLeaderboardData,
  mergeSnapshot,
  parseFollowerCount,
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
    snapshot = snapshot.accounts;
  }
  const out = {};
  for (const [handle, val] of Object.entries(snapshot)) {
    if (handle === "capturedAt" || handle === "notes") continue;
    if (val && typeof val === "object" && "followers" in val) {
      const followers = parseFollowerCount(val.followers);
      if (followers != null) out[handle] = { followers };
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
  return fields;
}

function seedSnapshot() {
  return {
    scmpnews: { followers: 648769 },
    tatlerhongkong: { followers: 256204 },
    the_trip_addict: { followers: 94494 },
    sassyhongkong: { followers: 91246 },
    thebayasia: { followers: 31696 },
    greaterbayvibes: { followers: 17268 },
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

  const staleHandles = [];
  let apiHandles = new Set();
  let manualHandles = new Set();

  if (process.argv.includes("--refresh")) {
    const snapPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");
    const manualPath = path.join(root, "references/ig-leaderboard-manual-snapshot.json");
    apiHandles = new Set(
      fs.existsSync(snapPath)
        ? Object.keys(
            normalizeSnapshot(JSON.parse(fs.readFileSync(snapPath, "utf8"))) || {}
          )
        : []
    );
    manualHandles = new Set(
      fs.existsSync(manualPath)
        ? Object.keys(
            normalizeSnapshot(JSON.parse(fs.readFileSync(manualPath, "utf8"))) || {}
          )
        : []
    );
  }

  const accounts = configs.map((cfg) => {
    const prev = existingByHandle[cfg.handle];
    const snap = snapshot?.[cfg.handle];
    if (snap) {
      const row = mergeSnapshot(prev, cfg, snapshotFields(snap, prev), today);
      if (apiHandles.has(cfg.handle)) row.followersSource = "instagram-api";
      else if (manualHandles.has(cfg.handle)) row.followersSource = "manual";
      else row.followersSource = "snapshot";
      return row;
    }
    if (prev?.followers != null) {
      staleHandles.push(cfg.handle);
      console.warn(
        `STALE ${cfg.handle}: Instagram fetch missed — carrying forward ${prev.followers.toLocaleString()} from prior snapshot (may be outdated)`
      );
      const row = mergeSnapshot(prev, cfg, { followers: prev.followers }, today);
      row.followersSource = "carried-forward";
      return row;
    }
    return mergeSnapshot(null, cfg, {}, today);
  });

  const data = buildLeaderboardData(accounts, captureMethod);
  applyGrowthFromHistory(data);
  writeLeaderboardData(data);
  const withFollowers = data.accounts.filter((a) => a.followers != null).length;
  const withGrowth = data.accounts.filter((a) => a.followersGrowthPct7d != null).length;
  console.log(
    `OK ig-leaderboard updatedAt=${data.updatedAt} (${withFollowers}/${data.accounts.length} accounts with follower counts, ${withGrowth} with 7d growth)`
  );
  if (staleHandles.length) {
    console.warn(
      `WARNING: ${staleHandles.length} stale handle(s) carried forward: ${staleHandles.join(", ")}. Update references/ig-leaderboard-manual-snapshot.json with verified follower counts, then re-run.`
    );
  }

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
