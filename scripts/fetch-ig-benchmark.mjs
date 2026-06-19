#!/usr/bin/env node
/**
 * Fetch IG benchmark metrics from Instagram APIs:
 * - Followers: web_profile_info
 * - Posts/7d + postsToday: /api/v1/feed/user/{id}/ pagination (7 full days ending yesterday)
 *
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { hktDateFromUnix, hktDateStr, hktDayStartUnix, postCountWindow } from "./hkt-date.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

const IG_APP_ID = "936619743392459";
const IG_PROFILE_API = "https://i.instagram.com/api/v1/users/web_profile_info/";
const IG_FEED_API = "https://www.instagram.com/api/v1/feed/user/";
const IG_GRAPHQL_API = "https://www.instagram.com/graphql/query";
const IG_TIMELINE_DOC_IDS = [
  "34579740524958711",
  "9310670392322965",
  "7950326061742207",
];
const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const ACCOUNT_DELAY_MS = 4000;
const PAGE_DELAY_MS = 1500;

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "X-IG-App-ID": IG_APP_ID,
  "X-Requested-With": "XMLHttpRequest",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestViaCurl(method, url, body = null, headers = {}) {
  const reqHeaders = { ...BASE_HEADERS, ...headers };
  if (body) reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
  const args = ["-sS", "-w", "\n__CURL_STATUS__%{http_code}", "-X", method];
  for (const [key, value] of Object.entries(reqHeaders)) {
    args.push("-H", `${key}: ${value}`);
  }
  if (body) args.push("--data-binary", body);
  args.push(url);
  const raw = execFileSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const marker = "\n__CURL_STATUS__";
  const markerIdx = raw.lastIndexOf(marker);
  const status = Number.parseInt(raw.slice(markerIdx + marker.length), 10);
  const data = raw.slice(0, markerIdx);
  let json = null;
  try {
    json = JSON.parse(data);
  } catch {
    json = null;
  }
  return { status, json, body: data };
}

function requestViaHttps(method, url, body = null, headers = {}) {
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

async function request(method, url, body = null, headers = {}) {
  const resp = await requestViaHttps(method, url, body, headers);
  if (resp.status === 429 || resp.status === 401) {
    try {
      return requestViaCurl(method, url, body, headers);
    } catch {
      return resp;
    }
  }
  return resp;
}

async function requestWithRetry(label, fn, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fn();
    if ((resp.status === 429 || resp.status === 401) && attempt < maxAttempts) {
      const waitMs = attempt * 4000;
      console.warn(`${label}: Instagram rate limit — retry in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    return resp;
  }
  return { status: 429, json: null };
}

function itemTimestamp(item) {
  const ts = item?.taken_at ?? item?.taken_at_timestamp ?? item?.device_timestamp;
  return Number.isFinite(ts) ? Math.floor(ts) : null;
}

function edgeTimestamp(edge) {
  const ts = edge?.node?.taken_at_timestamp ?? edge?.node?.taken_at;
  return Number.isFinite(ts) ? ts : null;
}

function countItems(items, window) {
  const { windowStart, windowEnd, anchorDate } = window;
  const cutoff = hktDayStartUnix(windowStart);
  let count7d = 0;
  let countToday = 0;
  let minTs = null;
  for (const item of items || []) {
    const ts = itemTimestamp(item) ?? edgeTimestamp(item);
    if (ts == null) continue;
    if (minTs == null || ts < minTs) minTs = ts;
    const postDate = hktDateFromUnix(ts);
    if (postDate >= windowStart && postDate <= windowEnd) count7d++;
    if (postDate === anchorDate) countToday++;
  }
  return { count7d, countToday, minTs, cutoff };
}

function extractTimeline(json) {
  const userMedia = json?.data?.user?.edge_owner_to_timeline_media;
  if (userMedia?.edges) {
    return {
      items: userMedia.edges,
      pageInfo: userMedia.page_info || {},
      nextMaxId: userMedia.page_info?.end_cursor ?? null,
      hasMore: userMedia.page_info?.has_next_page === true,
    };
  }
  const feed = json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;
  if (feed?.edges) {
    return {
      items: feed.edges,
      pageInfo: feed.page_info || {},
      nextMaxId: feed.page_info?.end_cursor ?? null,
      hasMore: feed.page_info?.has_next_page === true,
    };
  }
  return null;
}

async function fetchUserFeedPage(userId, handle, maxId) {
  const params = new URLSearchParams({ count: String(PAGE_SIZE) });
  if (maxId) params.set("max_id", maxId);
  const url = `${IG_FEED_API}${userId}/?${params}`;
  return requestWithRetry(`${handle} feed`, () =>
    request("GET", url, null, { Referer: `https://www.instagram.com/${handle}/` })
  );
}

async function fetchGraphqlPage(handle, after, docId) {
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
  const qs = `doc_id=${docId}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
  return requestWithRetry(`${handle} graphql`, () =>
    request("GET", `${IG_GRAPHQL_API}/?${qs}`, null, {
      Referer: `https://www.instagram.com/${handle}/`,
    })
  );
}

async function countPostsViaFeed(userId, handle, window) {
  let total7d = 0;
  let totalToday = 0;
  let maxId = null;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const resp = await fetchUserFeedPage(userId, handle, maxId);
    if (resp.status !== 200 || !Array.isArray(resp.json?.items)) {
      return null;
    }

    const page = countItems(resp.json.items, window);
    total7d += page.count7d;
    totalToday += page.countToday;

    if (!resp.json.more_available) break;
    if (page.minTs != null && page.minTs < page.cutoff) break;

    const next = resp.json.next_max_id;
    if (!next || next === maxId) break;
    maxId = next;
    pages++;
    await sleep(PAGE_DELAY_MS);
  }

  return { posts7d: total7d, postsToday: totalToday };
}

async function countPostsViaGraphql(handle, window) {
  let total7d = 0;
  let totalToday = 0;
  let cursor = null;
  let pages = 0;

  for (const docId of IG_TIMELINE_DOC_IDS) {
    total7d = 0;
    totalToday = 0;
    cursor = null;
    pages = 0;

    while (pages < MAX_PAGES) {
      const resp = await fetchGraphqlPage(handle, cursor, docId);
      if (resp.status !== 200) break;

      const timeline = extractTimeline(resp.json);
      if (!timeline) break;

      const page = countItems(timeline.items, window);
      total7d += page.count7d;
      totalToday += page.countToday;

      if (!timeline.hasMore) {
        return { posts7d: total7d, postsToday: totalToday };
      }
      if (page.minTs != null && page.minTs < page.cutoff) {
        return { posts7d: total7d, postsToday: totalToday };
      }

      const next = timeline.nextMaxId;
      if (!next || next === cursor) break;
      cursor = next;
      pages++;
      await sleep(PAGE_DELAY_MS);
    }

    if (total7d > 0 || totalToday > 0) {
      return { posts7d: total7d, postsToday: totalToday };
    }
  }

  return null;
}

async function countPostMetrics(userId, handle, window) {
  const viaFeed = await countPostsViaFeed(userId, handle, window);
  if (viaFeed) return viaFeed;

  console.warn(`${handle}: feed API unavailable — trying GraphQL fallback`);
  const viaGraphql = await countPostsViaGraphql(handle, window);
  if (viaGraphql) return viaGraphql;

  return { posts7d: 0, postsToday: 0 };
}

async function fetchProfile(handle) {
  const url = `${IG_PROFILE_API}?username=${encodeURIComponent(handle)}`;
  return requestWithRetry(handle, () =>
    request("GET", url, null, { Referer: `https://www.instagram.com/${handle}/` })
  );
}

async function fetchHandle(handle, runDate, window) {
  const resp = await fetchProfile(handle);
  if (resp.status !== 200 || !resp.json?.data?.user) {
    return { handle, ok: false, status: resp.status };
  }

  const user = resp.json.data.user;
  const followers = user.edge_followed_by?.count ?? null;
  if (followers == null) return { handle, ok: false, status: resp.status };

  const { posts7d, postsToday } = await countPostMetrics(user.id, handle, window);

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
  const runDate = hktDateStr();
  const window = postCountWindow(runDate);
  const configs = loadAccountConfig();
  const snapshot = {};
  const notes = [];

  for (const cfg of configs) {
    const result = await fetchHandle(cfg.handle, runDate, window);
    if (result.ok) {
      snapshot[cfg.handle] = {
        followers: result.followers,
        posts7d: result.posts7d,
        postsToday: result.postsToday,
      };
      notes.push(
        `${cfg.handle}: ${result.followers.toLocaleString()} followers, ${result.posts7d} posts/7d (${window.windowStart}–${window.windowEnd}), ${result.postsToday} posts on ${window.anchorDate} (${result.source})`
      );
    } else {
      notes.push(`${cfg.handle}: fetch failed (HTTP ${result.status ?? "error"})`);
    }
    await sleep(ACCOUNT_DELAY_MS);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { capturedAt: runDate, postCountWindow: window, notes, accounts: snapshot },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const count = Object.keys(snapshot).length;
  console.log(
    `Wrote ${outPath} (${count}/${configs.length} accounts from Instagram API)`
  );
  if (count < configs.length) {
    console.log(
      "Missing handles will keep prior post metrics; manual snapshot supplies followers only."
    );
  }
  if (!count) process.exit(1);
}

main();
