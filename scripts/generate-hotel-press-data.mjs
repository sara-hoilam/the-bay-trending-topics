#!/usr/bin/env node
/**
 * Refresh hotel-press-data.json from Hotels rows in source-links-data.json.
 *
 * Scrapes official hotel press listings, keeps awards / good news from the last
 * 14 days (HKT), writes Daily Brief-style markdown, and JSON for the Hotel Press tab.
 *
 * Usage: node scripts/generate-hotel-press-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr, hktIsoDateTime } from "./hkt-date.mjs";
import {
  HOTEL_PRESS_WINDOW_DAYS,
  matchHotelPressListing,
} from "./hotel-press-config.mjs";
import {
  windowBounds,
  selectHotelPressArticles,
  articlesToBriefMarkdown,
} from "./hotel-press-parse.mjs";
import {
  fetchHotelPressForSource,
  enrichHotelPressSummaries,
} from "./hotel-press-fetch-handlers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "hotel-press-data.json");
const sourceLinksPath = path.join(root, "source-links-data.json");

function loadHotelSources() {
  if (!fs.existsSync(sourceLinksPath)) return [];
  const sl = JSON.parse(fs.readFileSync(sourceLinksPath, "utf8"));
  return (sl.sources ?? [])
    .filter((s) => s.category === "Hotels")
    .map((s) => {
      const cfg = matchHotelPressListing(s);
      return {
        ...s,
        url: s.url || cfg?.listingUrl,
        hotelPressFetch: s.hotelPressFetch || {
          method: cfg?.method || "html",
          hotelGroup: cfg?.hotelGroup,
          listingId: cfg?.id,
        },
      };
    });
}

function loadExisting() {
  if (!fs.existsSync(outPath)) return { articles: [] };
  try {
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    return { articles: [] };
  }
}

function listingKey(src) {
  return src.url || src.domain || "unknown";
}

function groupByListing(articles) {
  const map = new Map();
  for (const a of articles) {
    const key = a.sourceUrl || a.sourceDomain || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  return map;
}

function rankArticles(articles) {
  return articles.map((a, i) => ({ ...a, rank: i + 1 }));
}

async function main() {
  const today = hktDateStr();
  const bounds = windowBounds(today, HOTEL_PRESS_WINDOW_DAYS);
  console.log(
    `Hotel Press refresh (HKT ${today}) · window ${bounds.start} → ${bounds.end}`,
  );

  const sources = loadHotelSources();
  if (!sources.length) {
    console.error("No Hotels sources in source-links-data.json");
    process.exit(1);
  }

  const existing = loadExisting();
  const existingByListing = groupByListing(existing.articles ?? []);
  const fetched = [];
  const kept = [];
  const sourceErrors = [];

  for (const src of sources) {
    const method = src.hotelPressFetch?.method ?? "html";
    const key = listingKey(src);
    console.log(`Fetching ${src.displayName || src.domain} [${method}] (${src.url})`);
    let listingItems = [];
    try {
      listingItems = await fetchHotelPressForSource(src);
      console.log(`  ${listingItems.length} raw items from ${src.displayName || src.domain}`);
    } catch (err) {
      console.warn(`  Skip ${src.displayName || src.domain}: ${err.message}`);
      sourceErrors.push({
        domain: src.domain,
        listingUrl: src.url,
        error: err.message,
      });
    }

    if (listingItems.length > 0) {
      fetched.push(...listingItems);
    } else {
      const fallback = existingByListing.get(key) ?? [];
      if (fallback.length) {
        console.log(
          `  Keeping ${fallback.length} cached item(s) for ${src.displayName || src.domain}`,
        );
        kept.push(...fallback);
      }
    }
  }

  const selected = selectHotelPressArticles([...kept, ...fetched], bounds);
  const enriched = await enrichHotelPressSummaries(selected);
  const articles = rankArticles(enriched);

  const payload = {
    generatedFrom: "source-links-data.json (Hotels)",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    windowDays: HOTEL_PRESS_WINDOW_DAYS,
    windowStart: bounds.start,
    windowEnd: bounds.end,
    count: articles.length,
    sourceErrors: sourceErrors.length ? sourceErrors : undefined,
    articles,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");

  const mdPath = path.join(root, "Training Data", `${today}-hotel-press.md`);
  fs.writeFileSync(mdPath, `${articlesToBriefMarkdown(articles, today)}\n`);

  console.log(
    `Wrote ${outPath} (${articles.length} awards/good-news in last ${HOTEL_PRESS_WINDOW_DAYS}d)`,
  );
  console.log(`Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
