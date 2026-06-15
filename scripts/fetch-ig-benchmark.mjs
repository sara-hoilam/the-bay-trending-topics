#!/usr/bin/env node
/**
 * Public fetch for IG benchmark metrics via Instastatistics API.
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { Buffer } from "buffer";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

const INSTAGRAM_EPOCH_MS = 1314220021721n;

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; GBA-Pulse/1.0)",
            Accept: "application/json",
            ...headers,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, json: JSON.parse(body) });
            } catch {
              resolve({ status: res.statusCode, json: null, body });
            }
          });
        }
      )
      .on("error", reject);
  });
}

function shortcodeToTimestampMs(shortCode) {
  const padded = shortCode.padStart(12, "A");
  const bytes = Buffer.from(padded, "base64url");
  let id = 0n;
  for (const byte of bytes) id = (id << 8n) + BigInt(byte);
  return Number((id >> (64n - 41n)) + INSTAGRAM_EPOCH_MS);
}

function weekAgoMs(today = hktDateStr()) {
  return new Date(`${today}T00:00:00+08:00`).getTime() - 7 * 86400000;
}

function metricsFromHistory(series, today = hktDateStr()) {
  if (!series?.length) return { value: null, growthPct7d: null };
  const latest = series.at(-1);
  const cutoff = weekAgoMs(today);
  const ref =
    [...series].reverse().find((point) => point[0] <= cutoff) ?? series[0];
  const days = (latest[0] - ref[0]) / 86400000;
  let growthPct7d = null;
  if (ref[1] > 0 && latest[1] != null && ref[1] != null && latest[0] !== ref[0]) {
    growthPct7d = Math.round(((latest[1] - ref[1]) / ref[1]) * 10000) / 100;
  }
  const scaled =
    days > 0 && latest[1] != null && ref[1] != null
      ? Math.round(((latest[1] - ref[1]) / days) * 7)
      : null;
  return { value: latest[1] ?? null, growthPct7d, scaled, days, ref };
}

async function posts7dFromRecent(handle, token, today = hktDateStr()) {
  const { status, json } = await getJson(
    `https://backend.instastatistics.com/instagram/posts/${handle}`,
    {
      Authorization: `Bearer ${token}`,
      Referer: `https://instastatistics.com/${handle}`,
      Origin: "https://instastatistics.com",
    }
  );
  if (status !== 200 || !json?.posts?.length) return null;

  const cutoff = weekAgoMs(today);
  const timestamps = json.posts
    .map((post) => shortcodeToTimestampMs(post.id))
    .filter((ts) => Number.isFinite(ts));
  if (!timestamps.length) return null;

  const inWindow = timestamps.filter((ts) => ts >= cutoff);
  const oldest = Math.min(...timestamps);
  const spanDays = (Date.now() - oldest) / 86400000;
  if (spanDays <= 0) return inWindow.length;
  return Math.max(inWindow.length, Math.round((timestamps.length / spanDays) * 7));
}

async function fetchHandle(handle, token, today) {
  const referer = `https://instastatistics.com/${handle}`;
  const auth = { Authorization: `Bearer ${token}`, Referer: referer };
  const statsResp = await getJson(
    `https://instastatistics.com/api/stats/${handle}`,
    auth
  );
  if (statsResp.status !== 200 || !statsResp.json?.instagram) {
    return { handle, ok: false };
  }

  const followersMeta = metricsFromHistory(
    statsResp.json.instagram.followers,
    today
  );
  const postsMeta = metricsFromHistory(statsResp.json.instagram.posts, today);

  let posts7d = postsMeta.scaled;
  if (posts7d == null) {
    posts7d = await posts7dFromRecent(handle, token, today);
  }

  if (followersMeta.value == null && posts7d == null) {
    return { handle, ok: false };
  }

  return {
    handle,
    ok: true,
    followers: followersMeta.value,
    followersGrowthPct7d: followersMeta.growthPct7d,
    posts7d,
    source: "instastatistics",
  };
}

async function main() {
  const today = hktDateStr();
  const configs = loadAccountConfig();
  const tokenResp = await getJson("https://instastatistics.com/api/token");
  const token = tokenResp.json?.token;
  if (!token) {
    console.error("Could not obtain Instastatistics API token");
    process.exit(1);
  }

  const snapshot = {};
  const notes = [];

  for (const cfg of configs) {
    const result = await fetchHandle(cfg.handle, token, today);
    if (result.ok) {
      snapshot[cfg.handle] = {
        followers: result.followers,
        posts7d: result.posts7d,
        followersGrowthPct7d: result.followersGrowthPct7d,
      };
      notes.push(
        `${cfg.handle}: ${result.followers?.toLocaleString() ?? "?"} followers, ${result.posts7d ?? "?"} posts/7d (${result.source})`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ capturedAt: today, notes, accounts: snapshot }, null, 2) + "\n",
    "utf8"
  );

  const count = Object.keys(snapshot).length;
  console.log(
    `Wrote ${outPath} (${count}/${configs.length} accounts from Instastatistics)`
  );
  if (count < configs.length) {
    console.log("Some accounts need manual snapshot fields — merge with existing data in capture script.");
  }
}

main();
