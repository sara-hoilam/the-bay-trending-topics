#!/usr/bin/env node
/**
 * Refresh happenings-events.json from all Lifestyle source links.
 * Attempts every domain in source-links-data.json (category Lifestyle).
 * On fetch/parse failure, keeps existing events for that domain (pruned).
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

/** Listing pages that work better than the homepage URL in source-links-data.json */
const LISTING_URL_OVERRIDES = {
  "timeout.com": "https://www.timeout.com/hong-kong/things-to-do",
  "lifestyleasia.com": "https://www.lifestyleasia.com/hk/things-to-do/",
  "shenzhenmuseum.com": "https://www.shenzhenmuseum.com/en/exhibition",
  "westk.hk": "https://www.westk.hk/en/whats-on",
};

const UA = "GBA-Pulse-Bot/1.0 (+https://github.com/sara-hoilam/the-bay-trending-topics)";

function loadLifestyleFetchSources() {
  if (!fs.existsSync(sourceLinksPath)) return [];
  const sl = JSON.parse(fs.readFileSync(sourceLinksPath, "utf8"));
  return (sl.sources ?? [])
    .filter((s) => s.category === "Lifestyle")
    .map((s) => ({
      domain: s.domain,
      url: LISTING_URL_OVERRIDES[s.domain] ?? s.url,
      displayName: s.displayName,
    }));
}

function decodeHtml(s) {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return hktDateStr(dt);
}

function truncateTitle(title, max = 90) {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

function inferRegion(text) {
  const loc = text.toLowerCase();
  if (/hong kong|\bhk\b|westk|kowloon/.test(loc)) return { region: "hk", location: "Hong Kong" };
  if (/macao|macau|澳门|澳門|grand lisboa/.test(loc)) return { region: "macao", location: "Macao" };
  if (/shenzhen|深圳|pingshan|nanshan|longhua/.test(loc)) return { region: "shenzhen", location: "Shenzhen" };
  if (/france|paris|viva tech|international|europe|japan|tokyo|singapore/.test(loc)) {
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

function defaultRegionForDomain(domain) {
  if (domain === "timeout.com" || domain === "event.hktdc.com" || domain === "westk.hk") {
    return { region: "hk", location: "Hong Kong" };
  }
  if (domain === "macauonjourney.com") return { region: "macao", location: "Macao" };
  if (domain === "10times.com" || domain === "eyeshenzhen.com" || domain === "shenzhenmuseum.com") {
    return { region: "shenzhen", location: "Shenzhen" };
  }
  return { region: "hk", location: "Hong Kong" };
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
  const [py] = postedIso.split("-").map(Number);
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
  return `${ev.sourceDomain}|${ev.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim()}`;
}

function postedFromUrl(url) {
  const m = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseEyeshenzhen(html, sourceDomain) {
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
      title: truncateTitle(title),
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

function parseMacauonjourney(html, sourceDomain) {
  const events = [];
  const today = hktDateStr();
  const cutoff = addDays(today, -90);
  const articleRe = /<article[^>]*hentry[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRe.exec(html)) !== null) {
    const block = match[1];
    const url = block.match(/entry-title"><a href="([^"]+)"/)?.[1];
    const rawTitle = block.match(/entry-title"><a href="[^"]+"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    if (!url || !rawTitle) continue;

    const title = decodeHtml(rawTitle);
    const datetime = block.match(/datetime="([^"]+)"/)?.[1];
    const posted =
      (datetime && /^\d{4}-\d{2}-\d{2}/.test(datetime) ? datetime.slice(0, 10) : null) ??
      postedFromUrl(url);
    if (!posted || posted < cutoff) continue;

    const blob = `${title} ${block}`;
    const { region, location } = inferRegion(blob);
    const { start, end } = extractDateRange(blob, posted);

    events.push({
      title: truncateTitle(title),
      start,
      end,
      region,
      location,
      url,
      sourceDomain,
    });
    if (events.length >= 10) break;
  }
  return events;
}

function parseTimeout(html, sourceDomain, listUrl) {
  const events = [];
  const today = hktDateStr();
  const seen = new Set();
  const tileRe = /<article class="tile _article_wkzyo_1"[\s\S]*?<\/article>/g;
  let match;

  while ((match = tileRe.exec(html)) !== null) {
    const block = match[0];
    const path = block.match(/href="(\/hong-kong\/[^"]+)"/)?.[1];
    const title = block.match(/<h3[^>]*>([^<]+)<\/h3>/)?.[1];
    if (!path || !title || path.includes("/on-video")) continue;
    if (seen.has(path)) continue;
    seen.add(path);

    const blob = decodeHtml(title);
    const { start, end } = extractDateRange(blob, today);
    events.push({
      title: truncateTitle(blob),
      start,
      end,
      region: "hk",
      location: "Hong Kong",
      url: `https://www.timeout.com${path}`,
      sourceDomain,
    });
    if (events.length >= 10) break;
  }

  if (!events.length) {
    const linkRe = /href="(\/hong-kong\/things-to-do\/[^"#?]+)"/g;
    while ((match = linkRe.exec(html)) !== null) {
      const path = match[1];
      if (path.includes("/on-video") || seen.has(path)) continue;
      seen.add(path);
      const slug = path.split("/").pop() ?? "event";
      const title = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      events.push({
        title: truncateTitle(title),
        start: today,
        end: addDays(today, 30),
        region: "hk",
        location: "Hong Kong",
        url: `https://www.timeout.com${path}`,
        sourceDomain,
      });
      if (events.length >= 8) break;
    }
  }

  if (!events.length && listUrl) {
    events.push({
      title: "Time Out Hong Kong — things to do",
      start: today,
      end: addDays(today, 30),
      region: "hk",
      location: "Hong Kong",
      url: listUrl,
      sourceDomain,
    });
  }
  return events;
}

function parseJsonLdEvents(html, sourceDomain, listUrl) {
  const events = [];
  const today = hktDateStr();
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;

  while ((match = re.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (node["@type"] !== "Event") continue;
      const start = node.startDate?.slice(0, 10);
      if (!start || !node.name) continue;
      const end = node.endDate?.slice(0, 10) ?? addDays(start, 7);
      const blob = `${node.name} ${node.location?.name ?? ""}`;
      const { region, location } = inferRegion(blob);
      events.push({
        title: truncateTitle(decodeHtml(node.name)),
        start,
        end,
        region,
        location: node.location?.name ?? location,
        url: node.url ?? listUrl,
        sourceDomain,
      });
    }
  }

  if (!events.length) return [];
  return events;
}

function parseGeneric(html, sourceDomain, listUrl) {
  const jsonLd = parseJsonLdEvents(html, sourceDomain, listUrl);
  if (jsonLd.length) return jsonLd;
  return [];
}

const DOMAIN_PARSERS = {
  "eyeshenzhen.com": parseEyeshenzhen,
  "macauonjourney.com": parseMacauonjourney,
  "timeout.com": parseTimeout,
};

function parseSource(html, sourceDomain, listUrl) {
  const parser = DOMAIN_PARSERS[sourceDomain] ?? parseGeneric;
  const events = parser(html, sourceDomain, listUrl);
  return events.map((ev) => {
    if (!ev.region) {
      const defaults = defaultRegionForDomain(sourceDomain);
      return { ...ev, region: defaults.region, location: ev.location ?? defaults.location };
    }
    return ev;
  });
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (/cloudflare|attention required|why have i been blocked/i.test(text.slice(0, 2000))) {
    throw new Error("Blocked by site protection");
  }
  return text;
}

function loadExisting() {
  if (!fs.existsSync(outPath)) return { events: [] };
  return JSON.parse(fs.readFileSync(outPath, "utf8"));
}

function prunePast(events, today) {
  const cutoff = addDays(today, -14);
  return events.filter((ev) => !ev.end || ev.end >= cutoff);
}

function groupByDomain(events) {
  const map = new Map();
  for (const ev of events) {
    const domain = ev.sourceDomain ?? "unknown";
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain).push(ev);
  }
  return map;
}

async function main() {
  const today = hktDateStr();
  const sources = loadLifestyleFetchSources();
  if (!sources.length) {
    console.error("No Lifestyle sources in source-links-data.json");
    process.exit(1);
  }

  const existing = loadExisting();
  const existingByDomain = groupByDomain(existing.events ?? []);

  const fetched = [];
  const kept = [];

  for (const src of sources) {
    console.log(`Fetching ${src.domain} (${src.url})`);
    let domainEvents = [];
    try {
      const html = await fetchText(src.url);
      domainEvents = parseSource(html, src.domain, src.url);
      console.log(`  ${domainEvents.length} events from ${src.domain}`);
    } catch (err) {
      console.warn(`  Skip ${src.domain}: ${err.message}`);
    }

    if (domainEvents.length > 0) {
      fetched.push(...domainEvents);
    } else {
      const fallback = prunePast(existingByDomain.get(src.domain) ?? [], today);
      if (fallback.length) {
        console.log(`  Keeping ${fallback.length} cached event(s) for ${src.domain}`);
        kept.push(...fallback);
      } else {
        console.log(`  No events for ${src.domain}`);
      }
    }
  }

  const merged = new Map();
  for (const ev of kept) merged.set(normalizeKey(ev), ev);
  for (const ev of fetched) merged.set(normalizeKey(ev), ev);

  const events = [...merged.values()].sort((a, b) => a.start.localeCompare(b.start));

  const payload = {
    generatedFrom: `Lifestyle source links (${sources.length} domains) · automated fetch with cache fallback`,
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
