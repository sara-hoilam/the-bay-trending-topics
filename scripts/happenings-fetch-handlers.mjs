/**
 * Per-source fetch handlers for generate-happenings-data.mjs.
 * Dispatch is driven by source-links-data.json → happeningsFetch.method.
 */
import { HKTDC_PHR_EVENT_API, hktdcFiltersFromListingUrl, HAPPENINGS_FETCH_BY_DOMAIN } from "./happenings-fetch-config.mjs";
import { hktDateStr } from "./hkt-date.mjs";

export const UA = "GBA-Pulse-Bot/1.0 (+https://github.com/sara-hoilam/the-bay-trending-topics)";

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

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return hktDateStr(dt);
}

function truncateTitle(title, max = 90) {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title;
}

function isoDateHkt(iso) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  function get(type) {
    const p = parts.find((x) => x.type === type);
    return p ? p.value : "";
  }
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hktMidnightIso(dateStr) {
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
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

function defaultRegionForSource(source) {
  const cfg = HAPPENINGS_FETCH_BY_DOMAIN[source.domain];
  if (cfg?.defaultRegion) return cfg.defaultRegion;
  return { region: "hk", location: "Hong Kong" };
}

function applyDefaultRegion(events, source) {
  const defaults = defaultRegionForSource(source);
  return events.map((ev) => {
    if (!ev.region) {
      return { ...ev, region: defaults.region, location: ev.location ?? defaults.location };
    }
    return ev;
  });
}

function monthIndex(name) {
  const m = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8,
    sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
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

  return { start: postedIso, end: addDays(postedIso, /exhibition|fair|museum|series/i.test(text) ? 60 : 14) };
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

function parseJsonLdEvents(html, sourceDomain, listUrl) {
  const events = [];
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
  return events;
}

const HTML_PARSERS = {
  eyeshenzhen: parseEyeshenzhen,
  generic: (html, sourceDomain, listUrl) => parseJsonLdEvents(html, sourceDomain, listUrl),
};

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

function matchesHktdcListingFilters(hit, filters) {
  if (filters.eventFormat && !(hit.eventFormats ?? []).includes(filters.eventFormat)) {
    return false;
  }
  if (filters.location === "hk" && hit.eventIsOutsideHK !== false) return false;
  if (filters.location === "outsidehk" && hit.eventIsOutsideHK !== true) return false;
  if (hit.eventOrganizerCode) {
    const allowed = (filters.organizers ?? "hktdc")
      .split(/[,+]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(hit.eventOrganizerCode.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function parseHktdcPhrResponse(data, source, listUrl) {
  const filters = hktdcFiltersFromListingUrl(listUrl);
  const defaults = defaultRegionForSource(source);
  return (data.hits ?? [])
    .filter((hit) => matchesHktdcListingFilters(hit, filters))
    .map((hit) => ({
      title: truncateTitle(hit.title),
      start: isoDateHkt(hit.eventStartDate),
      end: isoDateHkt(hit.eventEndDate),
      region: defaults.region,
      location: hit.displayCityForDisplay || defaults.location,
      url: hit.landingUrl || listUrl,
      sourceDomain: source.domain,
    }));
}

async function fetchHktdcPhrApi(source, today) {
  const cfg = HAPPENINGS_FETCH_BY_DOMAIN[source.domain] ?? {};
  const listUrl = source.url;
  const filters = hktdcFiltersFromListingUrl(listUrl);
  const origin = new URL(listUrl).origin;

  const params = new URLSearchParams({
    organizers: cfg.apiOrganizers ?? filters.organizers ?? "hktdc",
    fromEventEndDate: hktMidnightIso(today),
    language: "en",
    offset: "1",
    sort: "eventStartDate",
    limit: "100",
  });

  const res = await fetch(`${HKTDC_PHR_EVENT_API}?${params}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Origin: origin,
      Referer: listUrl,
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for HKTDC event API`);
  const data = await res.json();
  return parseHktdcPhrResponse(data, source, listUrl);
}

async function fetchHtmlSource(source) {
  const html = await fetchText(source.url);
  const parserId = source.happeningsFetch?.parser ?? "generic";
  const parser = HTML_PARSERS[parserId] ?? HTML_PARSERS.generic;
  return parser(html, source.domain, source.url);
}

/** Fetch events for one Lifestyle row from source-links-data.json. */
export async function fetchEventsForSource(source, today) {
  const method = source.happeningsFetch?.method ?? "html";
  let events;
  switch (method) {
    case "hktdc-phr-api":
      events = await fetchHktdcPhrApi(source, today);
      break;
    case "html":
      events = await fetchHtmlSource(source);
      break;
    default:
      throw new Error(`Unknown happeningsFetch.method: ${method}`);
  }
  return applyDefaultRegion(events, source);
}
