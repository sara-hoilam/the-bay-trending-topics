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
    for (const it of sec.items || []) {
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

  const byTitle = new Map();
  for (const r of rows) {
    const key = r.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, { title: r.title, hits: [] });
    byTitle.get(key).hits.push(r);
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
  data.topicCandidates = topicCandidates.slice(0, 25);

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
      else if (c.gbaRelevance === "high" || c.gbaRelevance === "medium") it.isGbaRelevant = true;
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
