/**
 * Per-source fetch handlers for generate-hotel-press-data.mjs.
 */
import { matchHotelPressListing } from "./hotel-press-config.mjs";
import {
  parseWynnNewsroomHtml,
  parseSandsPressHtml,
  parseGalaxyPressHtml,
  parseMelcoPressHtml,
  parseMgmPressHtml,
  parseSjmPressHtml,
  parseMandarinPressHtml,
  parseFourSeasonsPressHtml,
  parseShangriArticlesJson,
  stripTags,
  decodeHtml,
} from "./hotel-press-parse.mjs";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchTextWithFallback(urls) {
  let lastErr;
  for (const url of urls.filter(Boolean)) {
    try {
      return { html: await fetchText(url), url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("No listing URLs");
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
  if (/\.pdf(?:[?#]|$)/i.test(item.url)) {
    return {
      ...item,
      summary: item.summary || `${item.hotelGroup || "Hotel"} press: ${item.title}.`,
    };
  }
  try {
    const html = await fetchText(item.url);
    const summary = firstLede(html, item.title);
    if (summary) return { ...item, summary };
  } catch {
    // listing-only fallback
  }
  return {
    ...item,
    summary: item.summary || `${item.hotelGroup || "Hotel"} press: ${item.title}.`,
  };
}

function listingContext(source, cfg) {
  return {
    ...source,
    hotelGroup: cfg.hotelGroup || source.hotelPressFetch?.hotelGroup,
    displayName: source.displayName || cfg.displayName,
    url: source.url || cfg.listingUrl,
    domain: source.domain || cfg.domain,
  };
}

function parseListingHtml(method, html, ctx) {
  switch (method) {
    case "wynn-newsroom":
      return parseWynnNewsroomHtml(html, ctx);
    case "sands-press":
      return parseSandsPressHtml(html, ctx);
    case "galaxy-press":
      return parseGalaxyPressHtml(html, ctx);
    case "melco-press":
      return parseMelcoPressHtml(html, ctx);
    case "mgm-press":
      return parseMgmPressHtml(html, ctx);
    case "sjm-press":
      return parseSjmPressHtml(html, ctx);
    case "mandarin-press":
      return parseMandarinPressHtml(html, ctx);
    case "fourseasons-press":
      return parseFourSeasonsPressHtml(html, ctx);
    default:
      throw new Error(`Unknown hotelPressFetch.method: ${method}`);
  }
}

async function fetchShangriArticles(ctx) {
  const res = await fetch("https://www.shangri-la.com/group/data/loadArticles", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.shangri-la.com",
      Referer: "https://www.shangri-la.com/group/media/",
    },
    body: JSON.stringify({
      type: "PressReleases",
      year: "*",
      category: "*",
      search: "",
      page: 1,
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for Shangri-La loadArticles`);
  const payload = await res.json();
  return parseShangriArticlesJson(payload, ctx);
}

export async function fetchHotelPressForSource(source) {
  const cfg =
    matchHotelPressListing({
      domain: source.domain,
      url: source.url,
      displayName: source.displayName,
    }) || {};
  const method = source.hotelPressFetch?.method || cfg.method || "html";
  const ctx = listingContext(source, cfg);
  if (method === "shangri-articles") {
    return fetchShangriArticles(ctx);
  }
  const urls = [source.url || cfg.listingUrl, ...(cfg.fallbackUrls || [])];
  const { html } = await fetchTextWithFallback(urls);
  return parseListingHtml(method, html, ctx);
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
