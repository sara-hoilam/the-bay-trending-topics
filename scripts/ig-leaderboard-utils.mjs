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
  const followersGrowthPct7d = growthPctFromHistory(history, today, followers);
  return { followers, followersGrowthPct7d };
}

/** Rolling 7d follower growth % from account history: today vs exactly 7 calendar days ago. */
export function growthPctFromHistory(history, today, todayFollowers) {
  if (todayFollowers == null) return null;
  const refDate = hktAddDays(today, -7);
  const refRow = (history || []).find((h) => h.date === refDate);
  const refFollowers = refRow?.followers;
  if (refFollowers == null || refFollowers <= 0) return null;
  return Math.round(((todayFollowers - refFollowers) / refFollowers) * 10000) / 100;
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

/** Rank accounts by followers descending; null/missing counts last. */
export function sortAccountsByFollowers(accounts) {
  return [...accounts].sort((a, b) => {
    const af = a.followers;
    const bf = b.followers;
    if (af == null && bf == null) {
      return (a.displayName || a.handle).localeCompare(b.displayName || b.handle);
    }
    if (af == null) return 1;
    if (bf == null) return -1;
    if (bf !== af) return bf - af;
    return (a.displayName || a.handle).localeCompare(b.displayName || b.handle);
  });
}

function historyEntry(date, followers) {
  return { date, followers };
}

export function mergeSnapshot(existing, cfg, snapshot, today = hktDateStr()) {
  const prevHistory = existing?.history || [];
  const prevToday = prevHistory.find((h) => h.date === today);
  const nextHistory = prevHistory
    .filter((h) => h.date !== today)
    .map((h) => historyEntry(h.date, h.followers));

  if (snapshot.followers != null) {
    nextHistory.push(
      historyEntry(today, snapshot.followers ?? prevToday?.followers ?? null)
    );
  }
  nextHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
  const metrics = computeMetrics(nextHistory, today);

  return {
    handle: cfg.handle,
    displayName: cfg.displayName,
    url: cfg.url,
    highlight: cfg.highlight === true,
    followers: metrics.followers,
    followersGrowthPct7d: metrics.followersGrowthPct7d,
    history: nextHistory,
  };
}

export function applyGrowthFromHistory(data) {
  const today = data.updatedAt;
  const refDate = hktAddDays(today, -7);
  let withGrowth = 0;

  for (const account of data.accounts || []) {
    const growth = growthPctFromHistory(account.history, today, account.followers);
    account.followersGrowthPct7d = growth;
    if (growth != null) withGrowth++;
  }

  console.log(
    `7d growth from history: ${withGrowth}/${data.accounts?.length ?? 0} accounts (ref date ${refDate})`
  );
  return data;
}

export function buildLeaderboardData(accounts, captureMethod = "manual") {
  const today = hktDateStr();
  return {
    generatedFrom: "references/ig-leaderboard-accounts.json",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    refreshedAtLabel: "Follower snapshot as of update date · 7d growth from Google Sheet history",
    captureMethod,
    accounts: sortAccountsByFollowers(accounts),
  };
}

export function writeLeaderboardData(data) {
  fs.writeFileSync(IG_DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
