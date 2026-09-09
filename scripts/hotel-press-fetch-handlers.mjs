/**
 * Per-source fetch handlers for generate-hotel-press-data.mjs.
 */
import { HOTEL_PRESS_SOURCES } from "./hotel-press-config.mjs";
import {
  parseWynnNewsroomHtml,
  parseSandsPressHtml,
  stripTags,
  decodeHtml,
} from "./hotel-press-parse.mjs";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function isJunkLede(t) {
  const s = t.trim();
  if (s.length < 80) return true;
  if (/^(pinterest|linkedin|e-mail|facebook|twitter|share this|follow us)\b/i.test(s)) return true;
  if (/cookie|subscribe|media cart|javascript/i.test(s)) return true;
  return false;
}

function firstLede(html, title) {
  const justified = [...html.matchAll(/<p[^>]*text-align:\s*justify[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => !isJunkLede(t));
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => !isJunkLede(t))
    .filter((t) => !title || t.toLowerCase() !== title.toLowerCase());
  const og = html.match(/property="og:description"\s+content="([^"]+)"/i);
  const meta = html.match(/name="description"\s+content="([^"]+)"/i);
  const candidates = [
    ...justified,
    ...paras,
    og ? decodeHtml(og[1]) : null,
    meta ? decodeHtml(meta[1]) : null,
  ].filter(Boolean);
  const dateline = candidates.find((t) =>
    /\b(macao|macau|hong kong|shenzhen|guangzhou)\b/i.test(t) &&
    /\b20\d{2}\b/.test(t),
  );
  const lede = dateline || candidates[0];
  if (!lede) return null;
  const clean = lede.replace(/^[（(]\s*/, "(").replace(/\s*[）)]\s*/, ") ");
  return clean.length > 420 ? `${clean.slice(0, 417).replace(/\s+\S*$/, "")}…` : clean;
}

async function enrichSummary(item) {
  if (!item.url) return item;
  try {
    const html = await fetchText(item.url);
    const summary = firstLede(html, item.title);
    if (summary) return { ...item, summary };
  } catch {
    // listing-only fallback
  }
  return {
    ...item,
    summary: `${item.hotelGroup || "Hotel"} press: ${item.title}.`,
  };
}

export async function fetchHotelPressForSource(source) {
  const cfg = HOTEL_PRESS_SOURCES[source.domain] || {};
  const method = source.hotelPressFetch?.method || cfg.method || "html";
  const listingUrl = source.url || cfg.listingUrl;
  const html = await fetchText(listingUrl);
  const ctx = {
    ...source,
    hotelGroup: cfg.hotelGroup || source.hotelPressFetch?.hotelGroup,
    displayName: source.displayName || cfg.displayName,
  };
  let items;
  switch (method) {
    case "wynn-newsroom":
      items = parseWynnNewsroomHtml(html, ctx);
      break;
    case "sands-press":
      items = parseSandsPressHtml(html, ctx);
      break;
    default:
      throw new Error(`Unknown hotelPressFetch.method: ${method}`);
  }
  return items;
}

export async function enrichHotelPressSummaries(articles, { max = 12 } = {}) {
  const out = [];
  for (const art of articles.slice(0, max)) {
    out.push(await enrichSummary(art));
  }
  if (articles.length > max) {
    out.push(
      ...articles.slice(max).map((art) => ({
        ...art,
        summary: art.summary || `${art.hotelGroup || "Hotel"} press: ${art.title}.`,
      })),
    );
  }
  return out;
}
