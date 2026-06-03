#!/usr/bin/env node
/**
 * Refresh happenings-events.json from lifestyle source listings.
 * Preserves curated non–eyeshenzhen events; replaces eyeshenzhen-derived rows each run.
 *
 * Usage: node scripts/generate-happenings-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "happenings-events.json");
const sourceLinksPath = path.join(root, "source-links-data.json");

const FETCH_SOURCES = [
  {
    domain: "eyeshenzhen.com",
    url: "https://www.eyeshenzhen.com/node_400950.htm",
  },
];

const MANUAL_DOMAINS = new Set([
  "event.hktdc.com",
  "westk.hk",
  "10times.com",
  "timeout.com",
  "lifestyleasia.com",
  "macauonjourney.com",
  "shenzhenmuseum.com",
]);

const UA = "GBA-Pulse-Bot/1.0 (+https://github.com/sara-hoilam/the-bay-trending-topics)";

function decodeHtml(s) {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return hktDateStr(dt);
}

function inferRegion(text) {
  const loc = text.toLowerCase();
  if (/hong kong|\bhk\b|westk|kowloon/.test(loc)) return { region: "hk", location: "Hong Kong" };
  if (/macao|macau|澳门|澳門|grand lisboa/.test(loc)) return { region: "macao", location: "Macao" };
  if (/shenzhen|深圳|pingshan|nanshan|longhua/.test(loc)) return { region: "shenzhen", location: "Shenzhen" };
  if (
    /france|paris|viva tech|international|europe|japan|tokyo|singapore/.test(loc)
  ) {
    return { region: "international", location: "International" };
  }
  if (
    /guangzhou|广州|廣州|foshan|佛山|dongguan|东莞|東莞|zhuhai|珠海|huizhou|惠州|jiangmen|江门|江門|zhaoqing|肇庆|肇慶|zhongshan|中山|hengqin|横琴/.test(
      loc,
    )
  ) {
    return { region: "gba", location: "GBA" };
  }
  return { region: "shenzhen", location: "Shenzhen" };
}

function monthIndex(name) {
  const m = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };
  return m[name.toLowerCase()] ?? null;
}

function isoFromParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateRange(text, postedIso) {
  const [py, pm, pd] = postedIso.split("-").map(Number);
  const year = py;

  const range = text.match(
    /(\d{1,2})\s*(?:to|–|-)\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i,
  );
  if (range) {
    const mi = monthIndex(range[3]);
    if (mi != null) {
      return {
        start: isoFromParts(year, mi, Number(range[1])),
        end: isoFromParts(year, mi, Number(range[2])),
      };
    }
  }

  const open = text.match(
    /(?:open(?:s|ing)?|from|between)\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+and\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec))?/i,
  );
  if (open) {
    const startMonth = monthIndex(open[2]);
    if (startMonth != null) {
      const start = isoFromParts(year, startMonth, Number(open[1]));
      if (open[4]) {
        const endMonth = monthIndex(open[4]);
        if (endMonth != null) {
          const lastDay = new Date(year, endMonth + 1, 0).getDate();
          return { start, end: isoFromParts(year, endMonth, Number(open[3]) || lastDay) };
        }
      }
      return { start, end: addDays(start, 30) };
    }
  }

  const single = text.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i,
  );
  if (single) {
    const mi = monthIndex(single[2]);
    if (mi != null) {
      const start = isoFromParts(year, mi, Number(single[1]));
      return { start, end: addDays(start, /exhibition|fair|museum|series|programme|program/i.test(text) ? 45 : 7) };
    }
  }

  if (/between\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jun|Jul)/i.test(text)) {
    const m = text.match(/between\s+(June|July|January|February|March|April|May|August|September|October|November|December)\s+and\s+(June|July|January|February|March|April|May|August|September|October|November|December)/i);
    if (m) {
      const a = monthIndex(m[1]);
      const b = monthIndex(m[2]);
      if (a != null && b != null) {
        return {
          start: isoFromParts(year, a, 1),
          end: isoFromParts(year, b, new Date(year, b + 1, 0).getDate()),
        };
      }
    }
  }

  return { start: postedIso, end: addDays(postedIso, /exhibition|fair|museum|series/i.test(text) ? 60 : 14) };
}

function normalizeKey(ev) {
  return `${ev.sourceDomain}|${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

function parseEyeshenzhen(html, sourceDomain, listUrl) {
  const events = [];
  const itemRe = /<a class="articlelist-item" href="([^"]+)">([\s\S]*?)<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const url = match[1];
    const block = match[2];
    const titleMatch = block.match(/articlelist-item-right-title">\s*([\s\S]*?)\s*<\/div>/);
    const contentMatch = block.match(/articlelist-item-right-content">\s*([\s\S]*?)\s*<\/div>/);
    const timeMatch = block.match(/articlelist-item-right-time">\s*(\d{4}-\d{2}-\d{2})\s*<\/div>/);
    if (!titleMatch || !timeMatch) continue;

    const title = decodeHtml(titleMatch[1]);
    const content = decodeHtml(contentMatch?.[1] ?? title);
    const posted = timeMatch[1];
    const blob = `${title} ${content}`;
    const { region, location } = inferRegion(blob);
    const { start, end } = extractDateRange(blob, posted);

    events.push({
      title: title.length > 90 ? `${title.slice(0, 87)}…` : title,
      start,
      end,
      region,
      location,
      url: url.startsWith("http") ? url : `https://www.eyeshenzhen.com${url}`,
      sourceDomain,
    });
  }
  return events;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function loadExisting() {
  if (!fs.existsSync(outPath)) return { events: [] };
  return JSON.parse(fs.readFileSync(outPath, "utf8"));
}

function prunePast(events, today) {
  const cutoff = addDays(today, -14);
  return events.filter((ev) => !ev.end || ev.end >= cutoff);
}

async function main() {
  const today = hktDateStr();
  const existing = loadExisting();
  const kept = prunePast(
    (existing.events ?? []).filter((ev) => MANUAL_DOMAINS.has(ev.sourceDomain)),
    today,
  );

  const fetched = [];
  for (const src of FETCH_SOURCES) {
    try {
      console.log(`Fetching ${src.url}`);
      const html = await fetchText(src.url);
      const parsed = parseEyeshenzhen(html, src.domain, src.url);
      console.log(`  ${parsed.length} events from ${src.domain}`);
      fetched.push(...parsed);
    } catch (err) {
      console.warn(`  Skip ${src.domain}: ${err.message}`);
    }
  }

  const merged = new Map();
  for (const ev of kept) merged.set(normalizeKey(ev), ev);
  for (const ev of fetched) merged.set(normalizeKey(ev), ev);

  const events = [...merged.values()].sort((a, b) => a.start.localeCompare(b.start));

  let lifestyleCount = 0;
  if (fs.existsSync(sourceLinksPath)) {
    const sl = JSON.parse(fs.readFileSync(sourceLinksPath, "utf8"));
    lifestyleCount = (sl.sources ?? []).filter((s) => s.category === "Lifestyle").length;
  }

  const payload = {
    generatedFrom: `Lifestyle source links (${lifestyleCount || 8} domains) · automated + curated`,
    updatedAt: today,
    events,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${outPath} (${events.length} events, updatedAt=${today})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
