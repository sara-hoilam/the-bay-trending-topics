/**
 * Per-source fetch handlers for generate-new-hotels-data.mjs.
 */
import {
  NEW_HOTELS_SOURCES,
  OPENING_LIST_SUPABASE,
} from "./new-hotels-config.mjs";
import {
  parseOpeningPhrase,
  parseFromYearMonth,
  inferHotelGroup,
  inferLocationRegion,
  inferCountry,
  inferStars,
  normalizeWebsiteUrl,
  formatCityCountry,
  statusFromSort,
} from "./new-hotels-date-utils.mjs";
import { hktDateStr } from "./hkt-date.mjs";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function decodeHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s) {
  return decodeHtml(String(s || "").replace(/<[^>]+>/g, " "));
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: opts.accept || "text/html,application/json",
      ...(opts.headers || {}),
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function hotelRecord({
  name,
  location,
  hotelGroup,
  openMeta,
  sourceDomain,
  sourceUrl,
  sourceName,
  status,
  today,
  sourceRegion = null,
  websiteUrl = null,
  category = null,
  description = null,
  stars = undefined,
}) {
  const sort = openMeta?.openDateSort || openMeta?.openDate || null;
  const country = inferCountry(location, sourceRegion, name);
  const loc = formatCityCountry(location, country, name);
  const group = hotelGroup || inferHotelGroup(name);
  const resolvedStars =
    stars === undefined
      ? inferStars({
          name,
          hotelGroup: group,
          category: category || "",
          description: description || "",
        })
      : stars;
  return {
    name: name.trim(),
    location: loc,
    country: country || null,
    region: inferLocationRegion(loc, sourceRegion, name),
    hotelGroup: group,
    stars: resolvedStars == null ? null : resolvedStars,
    websiteUrl: normalizeWebsiteUrl(websiteUrl),
    openDate: openMeta?.openDate || null,
    openDateLabel: openMeta?.openDateLabel || null,
    openDatePrecision: openMeta?.openDatePrecision || null,
    openDateSort: sort,
    status: status || statusFromSort(sort, today),
    sourceDomain,
    sourceUrl,
    sourceName,
  };
}

/** The Opening List — public Supabase hotels table (opening soon + recent). */
export async function fetchOpeningList(today) {
  const cfg = NEW_HOTELS_SOURCES["theopeninglist.com"];
  const base = `${OPENING_LIST_SUPABASE.url}/rest/v1/hotels`;
  const headers = {
    apikey: OPENING_LIST_SUPABASE.anonKey,
    Authorization: `Bearer ${OPENING_LIST_SUPABASE.anonKey}`,
  };
  const select =
    "name,location,country,region,category,opening_year,opening_month,is_opened,collection,slug,booking_url,description";

  const [soon, opened] = await Promise.all([
    fetchJson(
      `${base}?select=${select}&is_opened=eq.false&order=opening_year.asc,opening_month.asc.nullslast&limit=500`,
      headers,
    ),
    fetchJson(
      `${base}?select=${select}&is_opened=eq.true&opening_year=gte.2025&order=opening_year.desc,opening_month.desc.nullslast&limit=500`,
      headers,
    ),
  ]);

  const rows = [...(soon || []), ...(opened || [])];
  return rows.map((row) => {
    const openMeta = parseFromYearMonth(row.opening_year, row.opening_month);
    const loc = [row.location, row.country].filter(Boolean).join(", ");
    const groupFromCollection = Array.isArray(row.collection)
      ? row.collection[0]
      : null;
    const sourceUrl = row.slug
      ? `https://theopeninglist.com/hotels/${row.slug}`
      : cfg.listingUrl;
    return hotelRecord({
      name: row.name,
      location: loc,
      hotelGroup: inferHotelGroup(row.name, groupFromCollection || null),
      openMeta,
      sourceDomain: "theopeninglist.com",
      sourceUrl,
      sourceName: cfg.displayName,
      status: row.is_opened ? "opened" : statusFromSort(openMeta?.openDateSort, today),
      today,
      sourceRegion: row.region || null,
      websiteUrl: row.booking_url || null,
      category: row.category || null,
      description: row.description || null,
    });
  });
}

/** Marriott openings page — __NEXT_DATA__ cardvertical cards. */
export async function fetchMarriott(today) {
  const cfg = NEW_HOTELS_SOURCES["marriott.com"];
  const html = await fetchText(cfg.listingUrl);
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error("Marriott __NEXT_DATA__ not found");
  const data = JSON.parse(m[1]);

  const cards = [];
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const v of obj) walk(v);
      return;
    }
    const header = obj.header;
    const desc = obj.description || "";
    if (
      typeof header === "string" &&
      typeof desc === "string" &&
      /Opening/i.test(desc)
    ) {
      cards.push(obj);
    }
    for (const v of Object.values(obj)) walk(v);
  }
  walk(data);

  const seen = new Set();
  const out = [];
  for (const card of cards) {
    const name = stripTags(card.header);
    if (!name || name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const desc = stripTags(card.description);
    const openMeta = parseOpeningPhrase(desc);
    const location = stripTags(card.eyebrow || card.location || "");
    out.push(
      hotelRecord({
        name,
        location,
        hotelGroup: inferHotelGroup(name, "Marriott"),
        openMeta,
        sourceDomain: "marriott.com",
        sourceUrl: cfg.listingUrl,
        sourceName: cfg.displayName,
        today,
      }),
    );
  }
  return out;
}

const ACCOR_NAME_HINT =
  /Hotel|Resort|Raffles|Fairmont|Sofitel|Pullman|Novotel|Mercure|ibis|Mövenpick|Movenpick|Swissôtel|Swissotel|MGallery|Mama Shelter|Orient Express|Rixos|Hyde|Mondrian|Delano|Handwritten|Emblems|greet|SO\/|Mantis|Villas|Collection|Residences/i;

/**
 * Accor openings — prefer press release HTML (richer dates), fall back to
 * group.accor.com RSC page bold titles.
 */
export async function fetchAccor(today) {
  const cfg = NEW_HOTELS_SOURCES["group.accor.com"];
  const urls = [cfg.pressUrl, cfg.listingUrl].filter(Boolean);
  let html = "";
  let usedUrl = cfg.listingUrl;
  for (const url of urls) {
    try {
      html = await fetchText(url);
      usedUrl = url;
      if (html.length > 5000) break;
    } catch (err) {
      console.warn(`  Accor fetch skip ${url}: ${err.message}`);
    }
  }
  if (!html) throw new Error("Accor pages unreachable");

  const hotels = [];
  const seen = new Set();

  function push(name, openPhrase, locationHint = null) {
    let clean = name
      .replace(/\s+/g, " ")
      .replace(/,\s*$/, "")
      .replace(/\s*\((?:Early|Mid|Late|Q[1-4]|H[12])[^)]*20\d{2}\)\s*$/i, "")
      .trim();
    if (!clean || clean.length < 5) return;
    const inferred = inferHotelGroup(clean, null);
    if (!ACCOR_NAME_HINT.test(clean) && inferred === "Independent") return;
    if (
      /^(opening|additional|our hotel|hotel development|formerly|located|alongside|the opening)/i.test(
        clean,
      )
    ) {
      return;
    }
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const openMeta = parseOpeningPhrase(openPhrase || clean) ||
      parseOpeningPhrase("H1 2026");
    hotels.push(
      hotelRecord({
        name: clean,
        location: locationHint,
        hotelGroup: inferHotelGroup(clean, "Accor"),
        openMeta,
        sourceDomain: "group.accor.com",
        sourceUrl: usedUrl,
        sourceName: cfg.displayName,
        today,
      }),
    );
  }

  // Primary: <strong>Hotel Name</strong> then nearby "Opening …" phrase
  const strongMatches = [...html.matchAll(/<strong[^>]*>\s*([\s\S]*?)\s*<\/strong>/gi)];

  for (const match of strongMatches) {
    const title = stripTags(match[1]);
    if (!title || title.length < 5 || title.length > 140) continue;
    if (!ACCOR_NAME_HINT.test(title) && !/20\d{2}/.test(title)) continue;
    if (/^ADDITIONAL|^HOTEL DEVELOPMENT|^OUR HOTEL/i.test(title)) continue;

    let openPhrase = /20\d{2}/.test(title) ? title : null;
    // Search HTML after this strong tag for the next Opening line
    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 2500);
    const afterText = stripTags(after);
    if (!openPhrase) {
      const openM = afterText.match(
        /Opening\s+((?:early|mid|late|Q[1-4]|H[12]|January|February|March|April|May|June|July|August|September|October|November|December)[^.]{0,24}20\d{2}|\w+\s+20\d{2}|20\d{2})/i,
      );
      if (openM) openPhrase = openM[0];
    }

    let location = null;
    const paraLoc = afterText.match(
      new RegExp(
        `${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,\\s*([A-Z][^.]{2,40}?)\\s+will\\b`,
        "i",
      ),
    );
    if (paraLoc) location = paraLoc[1].replace(/,\s*$/, "").trim();

    // Default Mid-2026 when press lists under 2026 openings without a phrase
    push(title, openPhrase || "Mid 2026", location);
  }

  // Fallback: RSC bold titles with embedded (Early 2026)
  if (hotels.length < 5) {
    const text = stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " "),
    );
    for (const m of text.matchAll(
      /([A-ZÀ-ÖØ-Þ][^()]{4,90}?)\s*\((Early|Mid|Late|Q[1-4]|H[12])[^)]*20\d{2}\)/g,
    )) {
      if (ACCOR_NAME_HINT.test(m[1])) push(m[1], m[0]);
    }
  }

  return hotels.filter((h) => h.openDateLabel);
}

/**
 * IHG new hotels — live page is often bot-blocked; try live then Wayback.
 * Cards typically read: Hotel Name → Location → "Now Open" | "Opening Soon".
 */
export async function fetchIhg(today) {
  const cfg = NEW_HOTELS_SOURCES["ihg.com"];
  const urls = [cfg.listingUrl, cfg.archiveUrl].filter(Boolean);
  let html = "";
  let usedUrl = cfg.listingUrl;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        console.warn(`  IHG HTTP ${res.status} for ${url}`);
        continue;
      }
      html = await res.text();
      if (/Access Denied/i.test(html) && html.length < 2000) {
        console.warn(`  IHG access denied for ${url}`);
        continue;
      }
      usedUrl = url.includes("web.archive.org") ? cfg.listingUrl : url;
      if (html.length > 5000) break;
    } catch (err) {
      console.warn(`  IHG fetch skip ${url}: ${err.message}`);
    }
  }
  if (!html || html.length < 1000) {
    throw new Error("IHG page unreachable (bot protection)");
  }

  const brands = [
    "Kimpton",
    "InterContinental",
    "Crowne Plaza",
    "Holiday Inn Express",
    "Holiday Inn",
    "Hotel Indigo",
    "voco",
    "Six Senses",
    "Regent",
    "HUALUXE",
    "Even Hotels",
    "Avid Hotels",
    "Atwell Suites",
    "Staybridge Suites",
  ];
  const brandRe = new RegExp(`^(?:${brands.join("|")})\\b`, "i");
  const year = +hktDateStr().slice(0, 4);

  // Preserve line breaks so Name / Location / Status cards stay aligned.
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|td|th|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
  const lines = plain
    .split(/\n+/)
    .map((l) =>
      decodeHtml(l)
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  const seen = new Set();
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i]
      .replace(/\s+(Now Open|Opening Soon|Book Now|BOOK NOW|FIND OUT MORE)$/i, "")
      .trim();
    if (!brandRe.test(name) || name.length < 8 || name.length > 90) continue;
    // Skip marketing sentences that start with a brand name
    if (/\b(makes|is|are|will|offers|features|debut)\b/i.test(name)) continue;
    if (/^selecting will|^©|Hotels & Resorts website|Hotels Group/i.test(name)) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    const next1 = lines[i + 1] || "";
    const next2 = lines[i + 2] || "";
    const next3 = lines[i + 3] || "";
    const window = [next1, next2, next3].join(" | ");
    if (!/Now Open|Opening Soon/i.test(window)) continue;

    const isOpen = /Now Open/i.test(window);
    const location =
      next1 &&
      !/^(Now Open|Opening Soon|Book Now|BOOK NOW|FIND OUT MORE|Africa|India|Middle East|Nepal)/i.test(
        next1,
      )
        ? next1
        : null;

    seen.add(key);
    // Now Open ≈ recent half; Opening Soon ≈ upcoming half of current year
    const openMeta = parseOpeningPhrase(isOpen ? `H1 ${year}` : `H2 ${year}`);
    out.push(
      hotelRecord({
        name,
        location,
        hotelGroup: inferHotelGroup(name, "IHG"),
        openMeta,
        sourceDomain: "ihg.com",
        sourceUrl: usedUrl,
        sourceName: cfg.displayName,
        status: isOpen ? "opened" : "upcoming",
        today,
      }),
    );
  }

  return out;
}

export async function fetchHotelsForSource(source, today) {
  const domain = source.domain;
  const method =
    source.newHotelsFetch?.method ||
    NEW_HOTELS_SOURCES[domain]?.method ||
    "html";

  switch (method) {
    case "opening-list-api":
      return fetchOpeningList(today);
    case "marriott-next-data":
      return fetchMarriott(today);
    case "accor-html":
      return fetchAccor(today);
    case "ihg-html":
      return fetchIhg(today);
    default:
      throw new Error(`Unknown new-hotels method: ${method}`);
  }
}
