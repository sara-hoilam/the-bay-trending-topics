#!/usr/bin/env node
/**
 * Fetch IG benchmark follower counts from Instagram web_profile_info API.
 * Writes orchestration/ig-leaderboard-snapshot.json for capture-ig-leaderboard.mjs.
 *
 * Usage: node scripts/fetch-ig-benchmark.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";
import { loadAccountConfig } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "orchestration/ig-leaderboard-snapshot.json");

const IG_APP_ID = "936619743392459";
const IG_PROFILE_API = "https://i.instagram.com/api/v1/users/web_profile_info/";
const ACCOUNT_DELAY_MS = 4000;

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

function requestViaCurl(method, url, headers = {}) {
  const reqHeaders = { ...BASE_HEADERS, ...headers };
  const args = ["-sS", "-w", "\n__CURL_STATUS__%{http_code}", "-X", method];
  for (const [key, value] of Object.entries(reqHeaders)) {
    args.push("-H", `${key}: ${value}`);
  }
  args.push(url);
  const raw = execFileSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
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

function requestViaHttps(method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqHeaders = { ...BASE_HEADERS, ...headers };
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
    req.end();
  });
}

async function request(method, url, headers = {}) {
  const resp = await requestViaHttps(method, url, headers);
  if (resp.status === 429 || resp.status === 401) {
    try {
      return requestViaCurl(method, url, headers);
    } catch {
      return resp;
    }
  }
  return resp;
}

function isRateLimitStatus(status) {
  return status === 429 || status === 401 || status === 403;
}

function isSchemaError(status, json) {
  if (status !== 400) return false;
  const msg = String(json?.message || "");
  return /schema|asset:\/\/laser\.provider/i.test(msg);
}

async function requestWithRetry(label, fn, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fn();
    const rateLimited = isRateLimitStatus(resp.status);
    const schemaError = isSchemaError(resp.status, resp.json);
    // Schema 400s are often persistent for specific business profiles — retry once, then bail.
    const canRetry =
      (rateLimited && attempt < maxAttempts) ||
      (schemaError && attempt < 2);
    if (canRetry) {
      const waitMs = schemaError ? 3000 : attempt * 4000;
      console.warn(
        `${label}: Instagram HTTP ${resp.status}${
          resp.json?.message ? ` (${resp.json.message})` : ""
        } — retry in ${waitMs}ms`
      );
      await sleep(waitMs);
      continue;
    }
    return resp;
  }
  return { status: 429, json: null };
}

async function fetchProfile(handle) {
  const url = `${IG_PROFILE_API}?username=${encodeURIComponent(handle)}`;
  return requestWithRetry(handle, () =>
    request("GET", url, { Referer: `https://www.instagram.com/${handle}/` })
  );
}

async function fetchHandle(handle) {
  const resp = await fetchProfile(handle);
  if (resp.status !== 200 || !resp.json?.data?.user) {
    return {
      handle,
      ok: false,
      status: resp.status,
      error: resp.json?.message || null,
    };
  }

  const user = resp.json.data.user;
  const followers = user.edge_followed_by?.count ?? null;
  if (followers == null) {
    return { handle, ok: false, status: resp.status, error: "missing follower count" };
  }

  return {
    handle,
    ok: true,
    followers: Math.round(followers),
    source: "instagram-api",
  };
}

function recordResult(snapshot, notes, result) {
  if (result.ok) {
    snapshot[result.handle] = { followers: result.followers };
    notes.push(
      `${result.handle}: ${result.followers.toLocaleString()} followers (${result.source})`
    );
    return;
  }
  const detail = result.error ? ` — ${result.error}` : "";
  notes.push(
    `${result.handle}: fetch failed (HTTP ${result.status ?? "error"})${detail}`
  );
}

async function main() {
  const runDate = hktDateStr();
  const configs = loadAccountConfig();
  const snapshot = {};
  const notes = [];
  const failed = [];

  for (const cfg of configs) {
    const result = await fetchHandle(cfg.handle);
    if (result.ok) {
      recordResult(snapshot, notes, result);
    } else {
      failed.push(cfg.handle);
      recordResult(snapshot, notes, result);
    }
    await sleep(ACCOUNT_DELAY_MS);
  }

  // Second pass for transient failures — schema 400s often persist, but rate limits may clear.
  if (failed.length) {
    console.warn(
      `Retrying ${failed.length} failed handle(s) after cooldown: ${failed.join(", ")}`
    );
    await sleep(10000);
    for (const handle of failed) {
      const result = await fetchHandle(handle);
      if (result.ok) {
        const idx = notes.findIndex((n) => n.startsWith(`${handle}:`));
        if (idx >= 0) notes.splice(idx, 1);
        recordResult(snapshot, notes, result);
      } else {
        console.warn(
          `${handle}: still failing after retry (HTTP ${result.status ?? "error"})`
        );
      }
      await sleep(ACCOUNT_DELAY_MS);
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ capturedAt: runDate, notes, accounts: snapshot }, null, 2) + "\n",
    "utf8"
  );

  const count = Object.keys(snapshot).length;
  console.log(`Wrote ${outPath} (${count}/${configs.length} accounts from Instagram API)`);
  if (count < configs.length) {
    const missing = configs.map((c) => c.handle).filter((h) => !snapshot[h]);
    console.warn(
      `Missing handles (${missing.join(", ")}) will use manual snapshot or prior counts — check for stale data.`
    );
  }
  if (!count) process.exit(1);
}

main();
