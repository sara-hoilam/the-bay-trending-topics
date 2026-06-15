#!/usr/bin/env node
/**
 * Best-effort public fetch for IG benchmark metrics (Checkbb HTML parse).
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";
import { parseFollowerCount } from "./ig-leaderboard-utils.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; GBA-Pulse/1.0)" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const next = res.headers.location;
          if (next) return resolve(fetchText(next.startsWith("http") ? next : `https://checkbb.com${next}`));
        }
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      })
      .on("error", reject);
  });
}

function parseCheckbb(html, today) {
  const weekAgo = new Date(today + "T12:00:00");
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const followersMatch =
    html.match(/([\d,.]+[KMB]?)\s*followers/i) ||
    html.match(/Total Followers[\s\S]*?([\d,.]+[KMB]?)/i);
  const followers = followersMatch ? parseFollowerCount(followersMatch[1]) : null;

  const dates = [...html.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  const posts7d = dates.filter((d) => d >= weekAgoStr && d <= today).length;

  return { followers, posts7d: posts7d || null };
}

async function fetchHandle(handle, today) {
  const url = `https://checkbb.com/en/instagram/${handle}`;
  try {
    const { status, body } = await fetchText(url);
    if (status !== 200 || body.includes("__next_error__")) {
      return { handle, ok: false };
    }
    const parsed = parseCheckbb(body, today);
    if (parsed.followers == null && parsed.posts7d == null) return { handle, ok: false };
    return { handle, ok: true, ...parsed, source: "checkbb" };
  } catch {
    return { handle, ok: false };
  }
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
      notes.push(`${cfg.handle}: checkbb`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ capturedAt: today, notes, accounts: snapshot }, null, 2) + "\n",
    "utf8"
  );

  const count = Object.keys(snapshot).length;
  console.log(`Wrote ${outPath} (${count}/${configs.length} accounts from Checkbb)`);
  if (count < configs.length) {
    console.log("Some accounts need manual snapshot fields — merge with existing data in capture script.");
  }
}

main();
