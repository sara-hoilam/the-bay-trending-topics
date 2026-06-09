/**
 * Select a small Ticketflap slice for Happenings: top 3 per HK/Macau listing
 * plus marquee crowd-pullers worth including.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr } from "./hkt-date.mjs";

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return hktDateStr(dt);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

export const TICKETFLAP_CACHE_PATH = path.join(root, "references/ticketflap-events-cache.json");
export const TICKETFLAP_CURATED_PATH = path.join(root, "references/ticketflap-top-events.json");

export const TICKETFLAP_LOCATION_PAGES = [
  {
    id: "hong-kong",
    label: "Hong Kong",
    urls: [
      "https://www.ticketflap.com/events/hong-kong-sar-china",
      "https://www.ticketflap.com/location/hong-kong",
      "https://www.ticketflap.com/events",
    ],
    region: "hk",
    location: "Hong Kong",
    maxTop: 3,
  },
  {
    id: "macao",
    label: "Macao",
    urls: [
      "https://www.ticketflap.com/events/macao-sar-china",
      "https://www.ticketflap.com/location/macao",
      "https://www.ticketflap.com/location/macau",
    ],
    region: "macao",
    location: "Macao",
    maxTop: 3,
  },
];

const WORTH_INCLUDING = [
  /clockenflap/i,
  /fuji\s*rock/i,
  /glow\s*festival/i,
  /prudential/i,
  /comic\s*con/i,
  /comicon/i,
  /art\s*basel/i,
  /book\s*fair/i,
  /marathon/i,
  /world\s*tour/i,
  /music\s*festival/i,
  /arts?\s*festival/i,
];

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8,
  sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

function normalizeKey(ev) {
  return `${(ev.title || "").toLowerCase()}|${ev.start || ""}`;
}

function isWorthIncluding(ev) {
  const blob = `${ev.title || ""} ${ev.location || ""}`;
  return WORTH_INCLUDING.some((re) => re.test(blob)) || ev.featured === true;
}

function isoFromParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse loose date hints from card text; fall back to today + horizon for TBD. */
export function inferTicketflapDates(text, today) {
  const [ty, tm, td] = today.split("-").map(Number);
  const year = ty;

  const range = text.match(
    /(\d{1,2})\s*(?:to|–|-|&)\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)/i,
  );
  if (range) {
    const mi = MONTHS[range[3].toLowerCase()];
    if (mi != null) {
      return {
        start: isoFromParts(year, mi, Number(range[1])),
        end: isoFromParts(year, mi, Number(range[2])),
      };
    }
  }

  const single = text.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(?:\s+(\d{4}))?/i,
  );
  if (single) {
    const mi = MONTHS[single[2].toLowerCase()];
    const y = single[3] ? Number(single[3]) : year;
    if (mi != null) {
      const start = isoFromParts(y, mi, Number(single[1]));
      return { start, end: start };
    }
  }

  if (/tbd|to be confirmed|stay tuned|dates?\s+to be/i.test(text)) {
    const start = addDays(today, 30);
    return { start, end: addDays(start, 60), dateNote: "Dates TBD" };
  }

  const start = addDays(today, 14);
  return { start, end: addDays(start, 7) };
}

export function selectTicketflapEvents(pool, today) {
  const byRegion = { hk: [], macao: [] };
  for (const ev of pool) {
    const region = ev.region === "macao" ? "macao" : ev.region === "hk" ? "hk" : null;
    if (region) byRegion[region].push(ev);
  }

  const selected = new Map();
  for (const region of ["hk", "macao"]) {
    const top = byRegion[region].slice(0, 3);
    for (const ev of top) selected.set(normalizeKey(ev), ev);
  }

  for (const ev of pool) {
    if (isWorthIncluding(ev)) selected.set(normalizeKey(ev), ev);
  }

  return [...selected.values()]
    .filter((ev) => !ev.end || ev.end >= addDays(today, -14))
    .map((ev) => ({
      title: ev.title,
      start: ev.start,
      end: ev.end || ev.start,
      region: ev.region,
      location: ev.location,
      url: ev.url,
      sourceDomain: "ticketflap.com",
      ...(ev.featured ? { featured: true } : {}),
      ...(ev.dateNote ? { dateNote: ev.dateNote } : {}),
    }));
}

export function loadTicketflapPool(today) {
  if (fs.existsSync(TICKETFLAP_CACHE_PATH)) {
    try {
      const cache = JSON.parse(fs.readFileSync(TICKETFLAP_CACHE_PATH, "utf8"));
      if ((cache.events ?? []).length && cache.updatedAt >= addDays(today, -7)) {
        return { events: cache.events, from: "cache" };
      }
    } catch {
      /* fall through */
    }
  }

  if (fs.existsSync(TICKETFLAP_CURATED_PATH)) {
    const curated = JSON.parse(fs.readFileSync(TICKETFLAP_CURATED_PATH, "utf8"));
    return { events: curated.events ?? [], from: "curated" };
  }

  return { events: [], from: "none" };
}
