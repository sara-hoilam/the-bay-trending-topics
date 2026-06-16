#!/usr/bin/env node
/**
 * Fetch IG benchmark metrics from Instagram APIs:
 * - Followers: web_profile_info
 * - Posts/7d + posts today: web_profile_info first page + GraphQL timeline pagination
 *
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import { hktAddDays, hktDateFromUnix, hktDateStr } from "./hkt-date.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

const IG_APP_ID = "936619743392459";
const IG_PROFILE_API = "https://www.instagram.com/api/v1/users/web_profile_info/";
const IG_GRAPHQL_API = "https://www.instagram.com/graphql/query";
/** Profile timeline pagination doc_id (Instagram web app; may need periodic updates). */
const IG_TIMELINE_DOC_ID = "9310670392322965";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const ACCOUNT_DELAY_MS = 3000;
const PAGE_DELAY_MS = 1200;

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "X-IG-App-ID": IG_APP_ID,
  "X-Requested-With": "XMLHttpRequest",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function request(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqHeaders = { ...BASE_HEADERS, ...headers };
    if (body) {
      reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      reqHeaders["Content-Length"] = Buffer.byteLength(body);
    }
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, body: data });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestWithRetry(label, fn, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fn();
    if (resp.status === 429 && attempt < maxAttempts) {
      const waitMs = attempt * 3000;
      console.warn(`${label}: Instagram rate limit — retry in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    return resp;
  }
  return { status: 429, json: null };
}

function weekAgoUnix(today = hktDateStr()) {
  const refDate = hktAddDays(today, -7);
  return Math.floor(new Date(`${refDate}T00:00:00+08:00`).getTime() / 1000);
}

function edgeTimestamp(edge) {
  const ts = edge?.node?.taken_at_timestamp ?? edge?.node?.taken_at;
  return Number.isFinite(ts) ? ts : null;
}

function countEdgeMetrics(edges, cutoff, todayDate) {
  let count7d = 0;
  let countToday = 0;
  let minTs = null;
  for (const edge of edges || []) {
    const ts = edgeTimestamp(edge);
    if (ts == null) continue;
    if (minTs == null || ts < minTs) minTs = ts;
    if (ts >= cutoff) count7d++;
    if (hktDateFromUnix(ts) === todayDate) countToday++;
  }
  return { count7d, countToday, minTs };
}

function extractTimeline(json) {
  const userMedia = json?.data?.user?.edge_owner_to_timeline_media;
  if (userMedia?.edges) {
    return {
      edges: userMedia.edges,
      pageInfo: userMedia.page_info || {},
      style: "user-id",
    };
  }
  const feed = json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
  if (feed?.edges) {
    return {
      edges: feed.edges,
      pageInfo: feed.page_info || {},
      style: "username",
    };
  }
  return null;
}

async function fetchTimelinePage({ userId, handle, after, style }) {
  if (style === "username") {
    const variables = {
      after: after ?? null,
      before: null,
      data: {
        count: PAGE_SIZE,
        include_reel_media_seen_timestamp: true,
        include_relationship_info: true,
        latest_besties_reel_media: true,
        latest_reel_media: true,
      },
      first: PAGE_SIZE,
      last: null,
      username: handle,
      __relay_internal__pv__PolarisIsLoggedInrelayprovider: true,
      __relay_internal__pv__PolarisShareSheetV3relayprovider: true,
    };
    const qs = `doc_id=${IG_TIMELINE_DOC_ID}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
    return requestWithRetry(`${handle} timeline`, () =>
      request("GET", `${IG_GRAPHQL_API}/?${qs}`)
    );
  }

  const variables = JSON.stringify({ id: userId, first: PAGE_SIZE, after: after ?? null });
  const body = `variables=${encodeURIComponent(variables)}&doc_id=${IG_TIMELINE_DOC_ID}`;
  return requestWithRetry(`${handle} timeline`, () => request("POST", IG_GRAPHQL_API, body));
}

async function countPostMetrics(user, handle, today = hktDateStr()) {
  const cutoff = weekAgoUnix(today);
  const firstMedia = user?.edge_owner_to_timeline_media;
  const firstEdges = firstMedia?.edges || [];
  let total7d = 0;
  let totalToday = 0;
  let cursor = firstMedia?.page_info?.end_cursor ?? null;
  let hasNext = firstMedia?.page_info?.has_next_page === true;
  let style = "username";

  const first = countEdgeMetrics(firstEdges, cutoff, today);
  total7d += first.count7d;
  totalToday += first.countToday;
  if (!hasNext) return { posts7d: total7d, postsToday: totalToday };
  if (first.minTs != null && first.minTs < cutoff) {
    return { posts7d: total7d, postsToday: totalToday };
  }

  let pages = 1;
  let triedIdFallback = false;
  while (hasNext && pages < MAX_PAGES) {
    await sleep(PAGE_DELAY_MS);
    const resp = await fetchTimelinePage({
      userId: user.id,
      handle,
      after: cursor,
      style,
    });

    if (resp.status !== 200) {
      if (style === "username" && !triedIdFallback) {
        style = "user-id";
        triedIdFallback = true;
        continue;
      }
      console.warn(`${handle}: timeline pagination stopped (HTTP ${resp.status})`);
      break;
    }

    const timeline = extractTimeline(resp.json);
    if (!timeline) {
      if (style === "username" && !triedIdFallback) {
        style = "user-id";
        triedIdFallback = true;
        continue;
      }
      console.warn(`${handle}: unexpected timeline response shape`);
      break;
    }

    style = timeline.style;
    triedIdFallback = false;
    const page = countEdgeMetrics(timeline.edges, cutoff, today);
    total7d += page.count7d;
    totalToday += page.countToday;

    const nextCursor = timeline.pageInfo?.end_cursor ?? null;
    hasNext = timeline.pageInfo?.has_next_page === true;
    if (!hasNext || !nextCursor || nextCursor === cursor) break;
    if (page.minTs != null && page.minTs < cutoff) break;

    cursor = nextCursor;
    pages++;
  }

  return { posts7d: total7d, postsToday: totalToday };
}

async function fetchProfile(handle) {
  const url = `${IG_PROFILE_API}?username=${encodeURIComponent(handle)}`;
  return requestWithRetry(handle, () => request("GET", url));
}

async function fetchHandle(handle, today) {
  const resp = await fetchProfile(handle);
  if (resp.status !== 200 || !resp.json?.data?.user) {
    return { handle, ok: false, status: resp.status };
  }

  const user = resp.json.data.user;
  const followers = user.edge_followed_by?.count ?? null;
  if (followers == null) return { handle, ok: false, status: resp.status };

  const { posts7d, postsToday } = await countPostMetrics(user, handle, today);

  return {
    handle,
    ok: true,
    followers: Math.round(followers),
    posts7d,
    postsToday,
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
        postsToday: result.postsToday,
      };
      notes.push(
        `${cfg.handle}: ${result.followers.toLocaleString()} followers, ${result.posts7d} posts/7d, ${result.postsToday} posts today (${result.source})`
      );
    } else {
      notes.push(`${cfg.handle}: fetch failed (HTTP ${result.status ?? "error"})`);
    }
    await sleep(ACCOUNT_DELAY_MS);
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
    console.log(
      "Some accounts need manual snapshot fields — merge with references/ig-leaderboard-manual-snapshot.json."
    );
  }
  if (!count) process.exit(1);
}

main();
