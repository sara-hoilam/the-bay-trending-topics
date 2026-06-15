import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr, hktIsoDateTime } from "./hkt-date.mjs";

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

function daysBetween(a, b) {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db - da) / 86400000);
}

function historyEntryOnOrBefore(history, targetDate, minDaysAgo) {
  const sorted = (history || [])
    .slice()
    .filter((h) => h.date && h.followers != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  let best = null;
  for (const entry of sorted) {
    const gap = daysBetween(entry.date, targetDate);
    if (gap >= minDaysAgo) best = entry;
  }
  return best;
}

export function computeMetrics(history, today) {
  const current = (history || []).find((h) => h.date === today);
  const followers = current?.followers ?? null;
  const posts7d = current?.posts7d ?? null;
  const ref7 = historyEntryOnOrBefore(history, today, 7);
  let followersGrowthPct7d = null;
  if (followers != null && ref7?.followers != null && ref7.followers > 0) {
    followersGrowthPct7d =
      Math.round(((followers - ref7.followers) / ref7.followers) * 10000) / 100;
  }
  return { followers, posts7d, followersGrowthPct7d };
}

export function mergeSnapshot(existing, cfg, snapshot, today = hktDateStr()) {
  const prevHistory = existing?.history || [];
  const nextHistory = prevHistory.filter((h) => h.date !== today);
  if (snapshot.followers != null || snapshot.posts7d != null) {
    nextHistory.push({
      date: today,
      followers: snapshot.followers ?? null,
      posts7d: snapshot.posts7d ?? null,
    });
  }
  nextHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
  const metrics = computeMetrics(nextHistory, today);
  const followersGrowthPct7d =
    metrics.followersGrowthPct7d ?? snapshot.followersGrowthPct7d ?? null;

  return {
    handle: cfg.handle,
    displayName: cfg.displayName,
    url: cfg.url,
    highlight: cfg.highlight === true,
    followers: metrics.followers,
    followersGrowthPct7d,
    posts7d: metrics.posts7d,
    history: nextHistory,
  };
}

export function buildLeaderboardData(accounts, captureMethod = "manual") {
  const today = hktDateStr();
  return {
    generatedFrom: "references/ig-leaderboard-accounts.json",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    refreshedAtLabel: "Follower snapshot as of update date · rolling 7-day growth & posting cadence",
    captureMethod,
    accounts,
  };
}

export function writeLeaderboardData(data) {
  fs.writeFileSync(IG_DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
