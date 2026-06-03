#!/usr/bin/env node
/**
 * Warn/fail when Baidu or Weibo would render fewer than 5 filled cards.
 * Mirrors trend-watch-panel.js filter pipeline (keep in sync).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const frag = fs.readFileSync(
  path.join(root, "orchestration/fragments/trendwatch.html"),
  "utf8",
);
const m = frag.match(
  /<script type="application\/json" id="trend-watch-data">\s*([\s\S]*?)\s*<\/script>/,
);
if (!m) {
  console.error("Missing trend-watch-data JSON");
  process.exit(1);
}
const data = JSON.parse(m[1]);
const RANK_SLOTS = 5;

const GBA_LOCAL =
  /香港|Hong Kong|Macau|Macao|澳门|大湾区|粤港澳|广东|Guangdong|广州|深圳|珠海|佛山|惠州|东莞|中山|江门|肇庆|比亚迪|BYD|白云|横琴|前海|南沙/i;
const MAJOR_NATIONAL =
  /国台办|中美|高考|1290万|民生|公积金|育儿|两军|夏威夷|6G|获批|黄仁勋|Trump|特朗普/i;
const NEWSWORTHY =
  /政策|外交|芯片|电动车|AI|台风|预警|国台办|高考|公积金|民生/i;
const LOCAL_VIRAL = /光伏板|崩溃痛哭|灵魂摆渡|瘦腿|综艺|抄袭|老宅|偷装/i;
const GOSSIP = /恋情|绯闻|浪姐|抄袭|秘嫁|综艺.*导演/i;

function blob(it) {
  return [it.title, it.titleEn, it.whyTrending].filter(Boolean).join(" ");
}

function gbaAuto(b) {
  return GBA_LOCAL.test(b) || MAJOR_NATIONAL.test(b);
}

function isGba(it) {
  if (it.isGbaRelevant === true) return true;
  if (gbaAuto(blob(it))) return true;
  if (it.isGbaRelevant === false) return false;
  return false;
}

function isNews(it) {
  if (it.isGossip === true) return false;
  const b = blob(it);
  if (LOCAL_VIRAL.test(b) || GOSSIP.test(b)) return false;
  if (it.isNewsworthy === true) return true;
  if (NEWSWORTHY.test(b) || gbaAuto(b)) return true;
  if (it.isNewsworthy === false) return false;
  return false;
}

function getWeiboItems(sec) {
  const pool = [...(sec.items || [])];
  for (const rows of Object.values(sec.itemsByBoard || {})) pool.push(...rows);
  return pool;
}

function countFilled(secId) {
  const sec = data.sections.find((s) => s.id === secId);
  if (!sec) return 0;
  const raw = secId === "weibo" ? getWeiboItems(sec) : sec.items || [];
  const seen = new Set();
  const pool = [];
  for (const it of raw.sort((a, b) => (a.rank || 999) - (b.rank || 999))) {
    if (!it?.title || seen.has(it.title)) continue;
    if (!isNews(it) || !isGba(it)) continue;
    seen.add(it.title);
    pool.push(it);
    if (pool.length >= RANK_SLOTS) break;
  }
  return pool.length;
}

const failOnShort = process.argv.includes("--strict");
let failed = false;
for (const id of ["baidu", "weibo"]) {
  const n = countFilled(id);
  const msg = `${id}: ${n}/${RANK_SLOTS} cards after filters`;
  if (n < RANK_SLOTS) {
    console.warn(`WARN ${msg}`);
    if (failOnShort) failed = true;
  } else {
    console.log(`OK ${msg}`);
  }
}
process.exit(failed ? 1 : 0);
