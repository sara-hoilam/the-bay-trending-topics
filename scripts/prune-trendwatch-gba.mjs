#!/usr/bin/env node
/**
 * GBA-focused Trend Watch: keep Google HK/MO, Baidu, Weibo only.
 * Strips US/GB/JP/SG/IN Google geos and x_twitter; recomputes topicCandidates.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetArg = process.argv[2];
const fragPath = targetArg
  ? path.resolve(root, targetArg)
  : path.join(root, "orchestration/fragments/trendwatch.html");
const isFragment = fragPath.endsWith(".html");

const DROP_GOOGLE_GEOS = new Set(["US", "GB", "JP", "SG", "IN"]);
const GBA_GOOGLE_GEOS = new Set(["HK", "MO"]);

function parseVolume(label) {
  if (!label || label === "—") return 0;
  const s = String(label);
  const m = s.match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = (m[2] || "").toUpperCase();
  if (u === "K") n *= 1000;
  if (u === "M") n *= 1_000_000;
  if (s.includes("万")) n *= 10_000;
  if (s.includes("亿")) n *= 100_000_000;
  return Math.round(n);
}

function rankVelocity(rank) {
  return ({ 1: 100, 2: 80, 3: 65, 4: 50, 5: 40 }[rank] ?? 30);
}

function crossPlatformScore(hits) {
  const families = new Set(hits.map((h) => h.platform));
  let score = Math.min(100, 25 * families.size);
  const googleGeos = hits.filter((h) => h.platform === "google_trends").map((h) => h.geo);
  if (googleGeos.some((g) => GBA_GOOGLE_GEOS.has(g))) score = Math.min(100, score + 10);
  if (families.has("google_trends") && families.has("baidu")) score = Math.min(100, score + 10);
  if (families.has("baidu") && families.has("weibo")) score = Math.min(100, score + 5);
  if (googleGeos.filter((g) => GBA_GOOGLE_GEOS.has(g)).length >= 2) score = Math.min(100, score + 5);
  return score;
}

function slugify(title) {
  return String(title)
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "") || "topic";
}

function pruneData(data) {
  data.sections = (data.sections || []).filter((s) => s.id !== "x_twitter");

  const google = data.sections.find((s) => s.id === "google_trends");
  if (google) {
    google.subtitle = "GBA · Hong Kong & Macao";
    google.locations = (google.locations || []).filter((loc) => !DROP_GOOGLE_GEOS.has(loc.id));
    const items = google.itemsByLocation || {};
    for (const geo of DROP_GOOGLE_GEOS) delete items[geo];
    google.itemsByLocation = items;
    if (!google.defaultLocationId || DROP_GOOGLE_GEOS.has(google.defaultLocationId)) {
      google.defaultLocationId = "HK";
    }
  }

  // Preserve editorial flags from pre-prune topicCandidates before recomputing.
  const priorCandidates = data.topicCandidates || [];
  const priorByTitle = new Map();
  for (const c of priorCandidates) {
    priorByTitle.set(String(c.displayTitle || "").trim().toLowerCase(), c);
  }

  const rows = [];
  if (google) {
    for (const [geo, items] of Object.entries(google.itemsByLocation || {})) {
      for (const it of items || []) {
        if (!it.title || it.title === "—") continue;
        rows.push({
          platform: "google_trends",
          geo,
          rank: it.rank,
          title: it.title,
          searchVolume: it.searchVolume,
          volumeEstimate: it.volumeEstimate ?? parseVolume(it.searchVolume),
          growthPercent: it.growthPercent ?? 0,
        });
      }
    }
  }
  for (const id of ["baidu", "weibo"]) {
    const sec = data.sections.find((s) => s.id === id);
    if (!sec) continue;
    const pool = [...(sec.items || [])];
    if (id === "weibo") {
      for (const boardRows of Object.values(sec.itemsByBoard || {})) {
        pool.push(...(boardRows || []));
      }
    }
    for (const it of pool) {
      if (!it.title || it.title === "—") continue;
      rows.push({
        platform: id,
        rank: it.rank,
        title: it.title,
        searchVolume: it.searchVolume,
        volumeEstimate: it.volumeEstimate ?? parseVolume(it.searchVolume),
        growthPercent: 0,
      });
    }
  }

  function clusterKey(title) {
    const t = String(title).trim().toLowerCase();
    if (/许家印|許家印/.test(t)) return "cluster:hui-ka-yan";
    if (/鬥牛梗|狗咬死人|打鼓嶺|格鬥犬/.test(t)) return "cluster:ta-kwu-ling-dog";
    if (/英超|arsenal|兵工廠|epl|科芬特里|coventry/i.test(t)) return "cluster:epl-opener";
    if (/長江存储|长江存储|长存控股/.test(t)) return "cluster:ymtc-ipo";
    if (/deepseek/i.test(t)) return "cluster:deepseek-v4";
    if (/召回|门把手/.test(t)) return "cluster:auto-recall";
    if (/中际旭创/.test(t)) return "cluster:zhongji-inchon";
    if (/微信|按住转文字/.test(t)) return "cluster:wechat-stt";
    if (/12\.4万亿|民生资金|育儿补贴/.test(t)) return "cluster:minsheng-124";
    if (/台湾海峡|美军机过航/.test(t)) return "cluster:taiwan-strait";
    if (/占座放零食|席位使用权/.test(t)) return "cluster:train-seat";
    if (/雷暴|風暴|风暴|热带气旋|热带低压|熱帶/.test(t)) return "cluster:hk-storm";
    if (/癌症疫苗|肿瘤疫苗|治疗性癌症疫苗|moderna|mrna癌症/i.test(t)) return "cluster:cancer-vaccine";
    if (/华为pura|pura x view|阔直板/i.test(t)) return "cluster:huawei-pura-x-view";
    if (/诺基亚/.test(t)) return "cluster:nokia-china";
    if (/大数据杀熟/.test(t)) return "cluster:price-discrimination";
    if (/樊振东/.test(t)) return "cluster:fan-zhendong";
    if (/阿里/.test(t)) return "cluster:alibaba-earnings";
    if (/肖戰|肖战/.test(t)) return "cluster:xiao-zhan";
    if (/气候异常|秋裤/.test(t)) return "cluster:china-climate";
    if (/宇树/.test(t)) return "cluster:unitree";
    if (/医院能办结婚证/.test(t)) return "cluster:hospital-marriage";
    if (/瑜伽垫/.test(t)) return "cluster:yoga-mat-hpv";
    if (/中国铁路/.test(t)) return "cluster:china-railway-ai";
    if (/智界rx|享界g9|余承东|鸿蒙智行/i.test(t)) return "cluster:huawei-auto";
    return t;
  }

  const byTitle = new Map();
  for (const r of rows) {
    const key = clusterKey(r.title);
    if (!byTitle.has(key)) byTitle.set(key, { title: r.title, hits: [] });
    byTitle.get(key).hits.push(r);
  }
  for (const cluster of byTitle.values()) {
    const gHit = cluster.hits.find((h) => h.platform === "google_trends");
    if (gHit) {
      cluster.title = gHit.title;
      continue;
    }
    cluster.hits.sort((a, b) => (b.volumeEstimate || 0) - (a.volumeEstimate || 0));
    cluster.title = cluster.hits[0].title;
  }

  const candidates = [];
  for (const [, { title, hits }] of byTitle) {
    const bestVol = Math.max(...hits.map((h) => h.volumeEstimate || 0));
    candidates.push({ title, hits, bestVol });
  }

  const maxVol = Math.max(1, ...candidates.map((c) => c.bestVol));

  const topicCandidates = candidates.map(({ title, hits, bestVol }) => {
    const volumeScore = Math.round(
      (100 * Math.log10(1 + bestVol)) / Math.log10(1 + maxVol),
    );
    let velocityScore = 0;
    for (const h of hits) {
      const gp = h.growthPercent || 0;
      const fromGrowth = gp ? Math.min(100, Math.round(gp / 10)) : 0;
      const fromRank = rankVelocity(h.rank);
      velocityScore = Math.max(velocityScore, fromGrowth || fromRank);
    }
    const cpScore = crossPlatformScore(hits);
    const families = new Set(hits.map((h) => h.platform));
    const compositeScore = Math.round(
      0.35 * volumeScore + 0.35 * velocityScore + 0.3 * cpScore,
    );
    const hasGbaGoogle = hits.some(
      (h) => h.platform === "google_trends" && GBA_GOOGLE_GEOS.has(h.geo),
    );
    const gbaRelevance =
      hasGbaGoogle || hits.some((h) => h.platform === "baidu" || h.platform === "weibo")
        ? "high"
        : "medium";

    return {
      id: slugify(title),
      displayTitle: title,
      gbaRelevance,
      platformHits: hits,
      volumeScore,
      velocityScore,
      crossPlatformScore: cpScore,
      compositeScore,
      platformCount: families.size,
    };
  });

  topicCandidates.sort((a, b) => b.compositeScore - a.compositeScore);

  const editorialTitles = new Set();
  for (const sec of data.sections || []) {
    const rows =
      sec.id === "google_trends"
        ? Object.values(sec.itemsByLocation || {}).flat()
        : [...(sec.items || []), ...Object.values(sec.itemsByBoard || {}).flat()];
    for (const it of rows) {
      if (!it?.title || it.title === "—") continue;
      if (it.isGossip === true || it.isNewsworthy === false) continue;
      if (sec.id === "google_trends" || it.isGbaRelevant === true) {
        editorialTitles.add(String(it.title).trim().toLowerCase());
      }
    }
  }
  const whyByTitle = new Map();
  for (const sec of data.sections || []) {
    const rows =
      sec.id === "google_trends"
        ? Object.values(sec.itemsByLocation || {}).flat()
        : [...(sec.items || []), ...Object.values(sec.itemsByBoard || {}).flat()];
    for (const it of rows) {
      const k = String(it.title || "").trim().toLowerCase();
      if (it.whyTrending && !whyByTitle.has(k)) whyByTitle.set(k, it.whyTrending);
      if (it.titleEn && !whyByTitle.has(k + "::en")) whyByTitle.set(k + "::en", it.titleEn);
      if (it.isGossip) whyByTitle.set(k + "::gossip", true);
    }
  }
  for (const c of topicCandidates) {
    const keys = [c.displayTitle, ...(c.platformHits || []).map((h) => h.title)].map((t) =>
      String(t || "").trim().toLowerCase(),
    );
    for (const k of keys) {
      if (!c.whyTrending && whyByTitle.get(k)) c.whyTrending = whyByTitle.get(k);
      if (!c.titleEn && whyByTitle.get(k + "::en")) c.titleEn = whyByTitle.get(k + "::en");
      if (whyByTitle.get(k + "::gossip")) c.isGossip = true;
    }
  }
  const head = [];
  const restEditorial = [];
  for (const c of topicCandidates) {
    const titles = [c.displayTitle, ...(c.platformHits || []).map((h) => h.title)].map((t) =>
      String(t).trim().toLowerCase(),
    );
    const editorial = titles.some((t) => editorialTitles.has(t));
    if (head.length < 20) head.push(c);
    else if (editorial) restEditorial.push(c);
  }
  const GBA_PLACE = /香港|澳门|广州|深圳|珠海|佛山|东莞|富士康|横琴|前海|南沙|jupas|百 佳|雷暴|許家印|许家印/i;
  restEditorial.sort((a, b) => {
    const aLoc = GBA_PLACE.test(a.displayTitle + a.platformHits.map((h) => h.title).join()) ? 1 : 0;
    const bLoc = GBA_PLACE.test(b.displayTitle + b.platformHits.map((h) => h.title).join()) ? 1 : 0;
    if (aLoc !== bLoc) return bLoc - aLoc;
    return b.compositeScore - a.compositeScore;
  });
  data.topicCandidates = [...head, ...restEditorial].slice(0, 40);

  for (const secId of ["baidu", "weibo"]) {
    const sec = data.sections.find((s) => s.id === secId);
    if (!sec) continue;
    for (const it of sec.items || []) {
      const key = String(it.title || "").trim().toLowerCase();
      const prior = priorByTitle.get(key);
      const live = data.topicCandidates.find(
        (c) => String(c.displayTitle || "").trim().toLowerCase() === key,
      );
      const c = prior || live;
      if (!c) continue;
      if (c.gbaRelevance === "low") it.isGbaRelevant = false;
      else if (it.isGbaRelevant !== false && (c.gbaRelevance === "high" || c.gbaRelevance === "medium")) {
        it.isGbaRelevant = true;
      }
      if (c.whyTrending && !it.whyTrending) it.whyTrending = c.whyTrending;
      if (c.titleEn && !it.titleEn) it.titleEn = c.titleEn;
    }
  }

  return data;
}

function main() {
  if (!isFragment) {
    const data = JSON.parse(fs.readFileSync(fragPath, "utf8"));
    pruneData(data);
    fs.writeFileSync(fragPath, JSON.stringify(data, null, 2) + "\n");
    console.log("Pruned", fragPath);
    return;
  }
  const html = fs.readFileSync(fragPath, "utf8");
  const m = html.match(
    /(<script type="application\/json" id="trend-watch-data">\s*)([\s\S]*?)(\s*<\/script>)/,
  );
  if (!m) throw new Error("Missing trend-watch-data in fragment");
  const data = JSON.parse(m[2]);
  pruneData(data);
  const out =
    m[1] + JSON.stringify(data, null, 2) + m[3];
  fs.writeFileSync(fragPath, html.replace(m[0], out));
  console.log(
    "Pruned trendwatch.html — Google geos:",
    data.sections.find((s) => s.id === "google_trends")?.locations?.map((l) => l.id).join(", "),
  );
  console.log("Sections:", data.sections.map((s) => s.id).join(", "));
  console.log("topicCandidates:", data.topicCandidates.length);
}

main();
