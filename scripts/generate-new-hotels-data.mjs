#!/usr/bin/env node
/**
 * Refresh new-hotels-data.json from New Hotels rows in source-links-data.json.
 *
 * Scrapes each configured listing, merges with cached rows on fetch failure,
 * and keeps only hotels opening within ±6 months of today (HKT).
 *
 * Usage: node scripts/generate-new-hotels-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr, hktIsoDateTime } from "./hkt-date.mjs";
import { NEW_HOTELS_WINDOW_MONTHS, NEW_HOTELS_SOURCES } from "./new-hotels-config.mjs";
import { windowBounds, inOpenWindow } from "./new-hotels-date-utils.mjs";
import { fetchHotelsForSource } from "./new-hotels-fetch-handlers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "new-hotels-data.json");
const sourceLinksPath = path.join(root, "source-links-data.json");

function loadNewHotelSources() {
  if (!fs.existsSync(sourceLinksPath)) return [];
  const sl = JSON.parse(fs.readFileSync(sourceLinksPath, "utf8"));
  return (sl.sources ?? [])
    .filter((s) => s.category === "New Hotels")
    .map((s) => {
      const cfg = NEW_HOTELS_SOURCES[s.domain];
      return {
        ...s,
        url: s.url || cfg?.listingUrl,
        newHotelsFetch: {
          method: cfg?.method || "html",
        },
      };
    });
}

function normalizeKey(h) {
  return `${(h.name || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim()}|${(
    h.sourceDomain || ""
  ).toLowerCase()}`;
}

function loadExisting() {
  if (!fs.existsSync(outPath)) return { hotels: [] };
  try {
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch {
    return { hotels: [] };
  }
}

function groupByDomain(hotels) {
  const map = new Map();
  for (const h of hotels) {
    const domain = h.sourceDomain ?? "unknown";
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain).push(h);
  }
  return map;
}

function sortHotels(hotels) {
  return hotels.slice().sort((a, b) => {
    const as = a.openDateSort || "9999";
    const bs = b.openDateSort || "9999";
    if (as !== bs) return as.localeCompare(bs);
    return String(a.name).localeCompare(String(b.name));
  });
}

async function main() {
  const today = hktDateStr();
  const bounds = windowBounds(today, NEW_HOTELS_WINDOW_MONTHS);
  console.log(
    `New Hotels refresh (HKT ${today}) · window ${bounds.start} → ${bounds.end}`,
  );

  const sources = loadNewHotelSources();
  if (!sources.length) {
    console.error("No New Hotels sources in source-links-data.json");
    process.exit(1);
  }

  const existing = loadExisting();
  const existingByDomain = groupByDomain(existing.hotels ?? []);

  const fetched = [];
  const kept = [];
  const sourceErrors = [];

  for (const src of sources) {
    const method = src.newHotelsFetch?.method ?? "html";
    console.log(`Fetching ${src.domain} [${method}] (${src.url})`);
    let domainHotels = [];
    try {
      domainHotels = await fetchHotelsForSource(src, today);
      console.log(`  ${domainHotels.length} raw hotels from ${src.domain}`);
    } catch (err) {
      console.warn(`  Skip ${src.domain}: ${err.message}`);
      sourceErrors.push({ domain: src.domain, error: err.message });
    }

    if (domainHotels.length > 0) {
      fetched.push(...domainHotels);
    } else {
      const fallback = (existingByDomain.get(src.domain) ?? []).filter((h) =>
        inOpenWindow(h, bounds),
      );
      if (fallback.length) {
        console.log(`  Keeping ${fallback.length} cached hotel(s) for ${src.domain}`);
        kept.push(...fallback);
      } else {
        console.log(`  No hotels for ${src.domain}`);
      }
    }
  }

  const merged = new Map();
  for (const h of kept) merged.set(normalizeKey(h), h);
  for (const h of fetched) merged.set(normalizeKey(h), h);

  // Cross-source dedupe by hotel name (prefer more precise open date)
  const byName = new Map();
  for (const h of merged.values()) {
    if (!inOpenWindow(h, bounds)) continue;
    if (!h.name || !h.openDateLabel) continue;
    const key = h.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, h);
      continue;
    }
    const prec = { day: 4, month: 3, quarter: 2, half: 2, year: 1 };
    const a = prec[h.openDatePrecision] || 0;
    const b = prec[prev.openDatePrecision] || 0;
    if (a > b) byName.set(key, h);
  }

  const hotels = sortHotels([...byName.values()]);
  const payload = {
    generatedFrom: "source-links-data.json (New Hotels)",
    updatedAt: today,
    refreshedAt: hktIsoDateTime(),
    windowMonths: NEW_HOTELS_WINDOW_MONTHS,
    windowStart: bounds.start,
    windowEnd: bounds.end,
    count: hotels.length,
    sourceErrors: sourceErrors.length ? sourceErrors : undefined,
    hotels,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${outPath} (${hotels.length} hotels in ±${NEW_HOTELS_WINDOW_MONTHS}mo window)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
