import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktAddDays, hktDateStr, hktIsoDateTime } from "./hkt-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

export const IG_ACCOUNTS_PATH = path.join(root, "references/ig-leaderboard-accounts.json");
export const IG_DATA_PATH = path.join(root, "ig-leaderboard-data.json");

export function loadAccountConfig() {
  const raw = JSON.parse(fs.readFileSync(IG_ACCOUNTS_PATH, "utf8"));
  return raw.accounts || [];
}

export function loadLeaderboardData() {
  if (!fs.existsSync(IG_DATA_PATH)) return null;
  return JSON.parse(fs.readFileSync(IG_DATA_PATH, "utf8"));
}

export function parseFollowerCount(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw).trim().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  let n = Number(m[1]);
  const unit = (m[2] || "").toUpperCase();
  if (unit === "K") n *= 1000;
  else if (unit === "M") n *= 1_000_000;
  else if (unit === "B") n *= 1_000_000_000;
  return Math.round(n);
}

export function computeMetrics(history, today) {
  const current = (history || []).find((h) => h.date === today);
  const followers = current?.followers ?? null;
  const posts7d = current?.posts7d ?? null;
  const postsToday = current?.postsToday ?? null;
  return { followers, posts7d, postsToday, followersGrowthPct7d: null };
}

/** Rolling 7d follower growth % from sheet rows: today vs exactly 7 calendar days ago. */
export function growthPctFromSheetRows(sheetRows, handle, today, todayFollowers) {
  if (todayFollowers == null) return null;
  const refDate = hktAddDays(today, -7);
  const refRow = (sheetRows || []).find(
    (row) => row.date === refDate && row.handle === handle
  );
  const refFollowers = refRow?.followers;
  if (refFollowers == null || refFollowers <= 0) return null;
  return Math.round(((todayFollowers - refFollowers) / refFollowers) * 10000) / 100;
}

export function mergeSnapshot(existing, cfg, snapshot, today = hktDateStr()) {
  const prevHistory = existing?.history || [];
  const nextHistory = prevHistory.filter((h) => h.date !== today);
  if (snapshot.followers != null || snapshot.posts7d != null || snapshot.postsToday != null) {
    nextHistory.push({
      date: today,
      followers: snapshot.followers ?? null,
      posts7d: snapshot.posts7d ?? null,
      postsToday: snapshot.postsToday ?? null,
    });
  }
  nextHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
  const metrics = computeMetrics(nextHistory, today);

  return {
    handle: cfg.handle,
    displayName: cfg.displayName,
    url: cfg.url,
    highlight: cfg.highlight === true,
    followers: metrics.followers,
    followersGrowthPct7d: null,
    posts7d: metrics.posts7d,
    postsToday: metrics.postsToday,
    history: nextHistory,
  };
}

export function buildLeaderboardData(accounts, captureMethod = "manual") {
  const today = hktDateStr();
  return {
    generatedFrom: "references/ig-leaderboard-accounts.json",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    refreshedAtLabel: "Follower snapshot as of update date · rolling 7-day growth · today's & 7-day post counts",
    captureMethod,
    accounts,
  };
}

export function writeLeaderboardData(data) {
  fs.writeFileSync(IG_DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
