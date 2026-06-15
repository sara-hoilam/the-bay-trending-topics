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

export function formatFollowers(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "K";
  return String(n);
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

export function computeDeltas(history, today) {
  const current = (history || []).find((h) => h.date === today);
  const followers = current?.followers ?? null;
  const ref7 = historyEntryOnOrBefore(history, today, 7);
  const ref30 = historyEntryOnOrBefore(history, today, 30);
  return {
    followers,
    followersDelta7d:
      followers != null && ref7?.followers != null ? followers - ref7.followers : null,
    followersDelta30d:
      followers != null && ref30?.followers != null ? followers - ref30.followers : null,
  };
}

export function mergeSnapshot(existing, cfg, snapshot, today = hktDateStr()) {
  const prevHistory = existing?.history || [];
  const nextHistory = prevHistory.filter((h) => h.date !== today);
  if (snapshot.followers != null) {
    nextHistory.push({
      date: today,
      followers: snapshot.followers,
      engagementRate: snapshot.engagementRate ?? null,
      posts: snapshot.posts ?? null,
    });
  }
  nextHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
  const deltas = computeDeltas(nextHistory, today);
  const latest = nextHistory[nextHistory.length - 1] || {};

  return {
    handle: cfg.handle,
    displayName: cfg.displayName,
    org: cfg.org,
    market: cfg.market,
    group: cfg.group,
    url: cfg.url,
    followers: deltas.followers,
    engagementRate: latest.engagementRate ?? snapshot.engagementRate ?? null,
    posts: latest.posts ?? snapshot.posts ?? null,
    followersDelta7d: deltas.followersDelta7d,
    followersDelta30d: deltas.followersDelta30d,
    history: nextHistory,
  };
}

export function buildLeaderboardData(accounts, captureMethod = "manual") {
  const today = hktDateStr();
  return {
    generatedFrom: "references/ig-leaderboard-accounts.json",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    refreshedAtLabel: "Public profile snapshot · Asia/Hong_Kong",
    captureMethod,
    accounts: accounts
      .slice()
      .sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1)),
  };
}

export function writeLeaderboardData(data) {
  fs.writeFileSync(IG_DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
