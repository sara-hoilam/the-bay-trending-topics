#!/usr/bin/env node
/**
 * Fetch IG benchmark metrics from Instagram's web_profile_info API only.
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { hktAddDays, hktDateStr } from "./hkt-date.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

const IG_APP_ID = "936619743392459";
const IG_API = "https://www.instagram.com/api/v1/users/web_profile_info/";

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "X-IG-App-ID": IG_APP_ID,
            "X-Requested-With": "XMLHttpRequest",
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

function weekAgoUnix(today = hktDateStr()) {
  const refDate = hktAddDays(today, -7);
  return Math.floor(new Date(`${refDate}T00:00:00+08:00`).getTime() / 1000);
}

function posts7dFromProfile(user, today = hktDateStr()) {
  const cutoff = weekAgoUnix(today);
  const edges = user?.edge_owner_to_timeline_media?.edges || [];
  return edges.filter((edge) => {
    const ts = edge?.node?.taken_at_timestamp;
    return Number.isFinite(ts) && ts >= cutoff;
  }).length;
}

async function fetchHandle(handle, today, attempt = 1) {
  const url = `${IG_API}?username=${encodeURIComponent(handle)}`;
  const resp = await getJson(url);

  if (resp.status === 429 && attempt < 4) {
    const waitMs = attempt * 3000;
    console.warn(`${handle}: Instagram rate limit — retry in ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    return fetchHandle(handle, today, attempt + 1);
  }

  if (resp.status !== 200 || !resp.json?.data?.user) {
    return { handle, ok: false, status: resp.status };
  }

  const user = resp.json.data.user;
  const followers = user.edge_followed_by?.count ?? null;
  const posts7d = posts7dFromProfile(user, today);

  if (followers == null) return { handle, ok: false };

  return {
    handle,
    ok: true,
    followers: Math.round(followers),
    posts7d: posts7d || null,
    source: "instagram-api",
  };
}

async function main() {
  const today = hktDateStr();
  const configs = loadAccountConfig();
  const snapshot = {};
  const notes = [];

  for (const cfg of configs) {
    const result = await fetchHandle(cfg.handle, today);
    if (result.ok) {
      snapshot[cfg.handle] = {
        followers: result.followers,
        posts7d: result.posts7d,
      };
      notes.push(
        `${cfg.handle}: ${result.followers.toLocaleString()} followers, ${result.posts7d ?? "?"} posts/7d (${result.source})`
      );
    } else {
      notes.push(`${cfg.handle}: fetch failed (HTTP ${result.status ?? "error"})`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ capturedAt: today, notes, accounts: snapshot }, null, 2) + "\n",
    "utf8"
  );

  const count = Object.keys(snapshot).length;
  console.log(
    `Wrote ${outPath} (${count}/${configs.length} accounts from Instagram API)`
  );
  if (count < configs.length) {
    console.log("Some accounts need manual snapshot fields — merge with existing data in capture script.");
  }
  if (!count) process.exit(1);
}

main();
