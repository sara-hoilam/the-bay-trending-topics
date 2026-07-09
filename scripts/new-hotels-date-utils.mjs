/**
 * Opening-date parsing and ±6-month window helpers for New Hotels.
 */
import { hktDateStr, hktAddDays } from "./hkt-date.mjs";

const MONTH_INDEX = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Mid-month ISO for year+month (day 15). */
export function isoFromYearMonth(year, month) {
  if (!year || !month) return null;
  return `${year}-${pad2(month)}-15`;
}

/** First day of a quarter — use mid-quarter for window sorting. */
export function isoFromQuarter(year, quarter) {
  const midMonth = (quarter - 1) * 3 + 2; // Feb / May / Aug / Nov
  return `${year}-${pad2(midMonth)}-15`;
}

/** Mid-point of a half-year for window sorting. */
export function isoFromHalf(year, half) {
  return half === 1 ? `${year}-04-01` : `${year}-10-01`;
}

/**
 * Normalize a free-text opening phrase into:
 * { openDate, openDateLabel, openDatePrecision, openDateSort }
 *
 * Labels prefer exact dates, else "Q3 2026" / "H2 2026" / "2026".
 */
export function parseOpeningPhrase(raw, fallbackYear = null) {
  if (!raw) return null;
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;

  // Exact: 2026-07-09 or 09/07/2026 or July 9, 2026 / 9 July 2026
  let m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const openDate = `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
    return {
      openDate,
      openDateLabel: openDate,
      openDatePrecision: "day",
      openDateSort: openDate,
    };
  }

  m = text.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(20\d{2})\b/i,
  );
  if (m) {
    const month = MONTH_INDEX[m[2].toLowerCase()];
    const openDate = `${m[3]}-${pad2(month)}-${pad2(+m[1])}`;
    return {
      openDate,
      openDateLabel: openDate,
      openDatePrecision: "day",
      openDateSort: openDate,
    };
  }

  m = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*,?\s*(20\d{2})\b/i,
  );
  if (m) {
    const month = MONTH_INDEX[m[1].toLowerCase()];
    const openDate = `${m[3]}-${pad2(month)}-${pad2(+m[2])}`;
    return {
      openDate,
      openDateLabel: openDate,
      openDatePrecision: "day",
      openDateSort: openDate,
    };
  }

  // Month + year: July 2026 / Jul 2026
  m = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*,?\s*(20\d{2})\b/i,
  );
  if (m) {
    const month = MONTH_INDEX[m[1].toLowerCase()];
    const year = +m[2];
    const label = `Q${Math.ceil(month / 3)} ${year}`;
    const sort = isoFromYearMonth(year, month);
    return {
      openDate: null,
      openDateLabel: label,
      openDatePrecision: "month",
      openDateSort: sort,
      openYear: year,
      openMonth: month,
    };
  }

  // Early / Mid / Late 2026 → quarters (mid-quarter sort)
  m = text.match(/\b(Early|Mid|Late)\s*-?\s*(20\d{2})\b/i);
  if (m) {
    const year = +m[2];
    const phase = m[1].toLowerCase();
    const quarter = phase === "early" ? 1 : phase === "mid" ? 3 : 4;
    const label = `Q${quarter} ${year}`;
    return {
      openDate: null,
      openDateLabel: label,
      openDatePrecision: "quarter",
      openDateSort: isoFromQuarter(year, quarter),
      openYear: year,
      openQuarter: quarter,
    };
  }

  // Q1 2026 / Q1, 2026
  m = text.match(/\bQ([1-4])\s*,?\s*(20\d{2})\b/i);
  if (m) {
    const quarter = +m[1];
    const year = +m[2];
    const label = `Q${quarter} ${year}`;
    return {
      openDate: null,
      openDateLabel: label,
      openDatePrecision: "quarter",
      openDateSort: isoFromQuarter(year, quarter),
      openYear: year,
      openQuarter: quarter,
    };
  }

  // H1 / H2 2026
  m = text.match(/\bH([12])\s*,?\s*(20\d{2})\b/i);
  if (m) {
    const half = +m[1];
    const year = +m[2];
    const label = `H${half} ${year}`;
    return {
      openDate: null,
      openDateLabel: label,
      openDatePrecision: "half",
      openDateSort: isoFromHalf(year, half),
      openYear: year,
      openHalf: half,
    };
  }

  // Year only
  m = text.match(/\b(20\d{2})\b/);
  if (m) {
    const year = +m[1];
    return {
      openDate: null,
      openDateLabel: String(year),
      openDatePrecision: "year",
      openDateSort: `${year}-07-01`,
      openYear: year,
    };
  }

  if (fallbackYear) {
    return {
      openDate: null,
      openDateLabel: String(fallbackYear),
      openDatePrecision: "year",
      openDateSort: `${fallbackYear}-07-01`,
      openYear: fallbackYear,
    };
  }

  return null;
}

export function parseFromYearMonth(year, month) {
  if (!year) return null;
  if (month && month >= 1 && month <= 12) {
    const label = `Q${Math.ceil(month / 3)} ${year}`;
    return {
      openDate: null,
      openDateLabel: label,
      openDatePrecision: "month",
      openDateSort: isoFromYearMonth(year, month),
      openYear: year,
      openMonth: month,
    };
  }
  return {
    openDate: null,
    openDateLabel: String(year),
    openDatePrecision: "year",
    openDateSort: `${year}-07-01`,
    openYear: year,
  };
}

/** Inclusive ±months window around today (HKT calendar). */
export function windowBounds(today = hktDateStr(), months = 6) {
  const days = Math.round(months * 30.44);
  return {
    start: hktAddDays(today, -days),
    end: hktAddDays(today, days),
    today,
  };
}

/**
 * Keep hotels whose sort date falls within [start, end].
 * Year-only precision is kept only if the year overlaps the window years.
 */
export function inOpenWindow(hotel, bounds) {
  const sort = hotel.openDateSort || hotel.openDate;
  if (!sort) return false;
  if (hotel.openDatePrecision === "year" && hotel.openYear) {
    const startY = +bounds.start.slice(0, 4);
    const endY = +bounds.end.slice(0, 4);
    return hotel.openYear >= startY && hotel.openYear <= endY;
  }
  return sort >= bounds.start && sort <= bounds.end;
}

export function statusFromSort(sort, today) {
  if (!sort) return "upcoming";
  return sort < today ? "opened" : "upcoming";
}

/**
 * Map free-text location / source region into filter buckets.
 * Returns "portugal" | "asia" | "other" | null.
 */
export function inferLocationRegion(location, sourceRegion = null, name = "") {
  const blob = `${location || ""} ${sourceRegion || ""} ${name || ""}`.toLowerCase();
  if (!blob.trim()) return null;

  if (
    /\bportugal\b|\blisbon\b|\bporto\b|\bcomporta\b|\bmelides\b|\balgarve\b|\bcascais\b|\bsintra\b|\bmadeira\b|\bazores\b|\bportugal\b/.test(
      blob,
    )
  ) {
    return "portugal";
  }

  // Prefer explicit Asia region labels from Opening List / similar
  if (/\basia\b/.test(String(sourceRegion || "").toLowerCase())) {
    return "asia";
  }

  if (
    /\bjapan\b|\bchina\b|\bhong kong\b|\bmacao\b|\bmacau\b|\btaiwan\b|\bkorea\b|\bseoul\b|\bbusan\b|\bincheon\b|\bthailand\b|\bbangkok\b|\bphuket\b|\bvietnam\b|\bhanoi\b|\bho chi minh\b|\bsaigon\b|\bdanang\b|\bsingapore\b|\bmalaysia\b|\bkuala lumpur\b|\bpenang\b|\bindonesia\b|\bbali\b|\bjakarta\b|\bphilippines\b|\bmanila\b|\bboracay\b|\bindia\b|\bmumbai\b|\bdelhi\b|\bgoa\b|\bkerala\b|\budai?pur\b|\blaos\b|\bcambodia\b|\bmyanmar\b|\byangon\b|\bmongolia\b|\bsri lanka\b|\bmaldives\b|\bnepal\b|\bbhutan\b|\bbangladesh\b|\bpakistan\b|\buzbekistan\b|\bkazakhstan\b|\bkyoto\b|\btokyo\b|\bosaka\b|\bokinawa\b|\bshanghai\b|\bbeijing\b|\bshenzhen\b|\bguangzhou\b|\bchengdu\b|\bjilin\b/.test(
      blob,
    )
  ) {
    return "asia";
  }

  return "other";
}

/** Infer brand/group from hotel name when source doesn't provide one. */
export function inferHotelGroup(name, fallback = null) {
  if (fallback) return fallback;
  const n = String(name || "");
  const brands = [
    ["JW Marriott", "Marriott"],
    ["Marriott", "Marriott"],
    ["Sheraton", "Marriott"],
    ["Westin", "Marriott"],
    ["Ritz-Carlton", "Marriott"],
    ["Ritz Carlton", "Marriott"],
    ["St. Regis", "Marriott"],
    ["St Regis", "Marriott"],
    ["W Hotel", "Marriott"],
    ["W ", "Marriott"],
    ["Moxy", "Marriott"],
    ["Courtyard", "Marriott"],
    ["Fairfield", "Marriott"],
    ["AC Hotel", "Marriott"],
    ["Tribute Portfolio", "Marriott"],
    ["Autograph", "Marriott"],
    ["Design Hotels", "Marriott"],
    ["Four Points", "Marriott"],
    ["Aloft", "Marriott"],
    ["Element", "Marriott"],
    ["Raffles", "Accor"],
    ["Fairmont", "Accor"],
    ["Sofitel", "Accor"],
    ["Pullman", "Accor"],
    ["Novotel", "Accor"],
    ["Mercure", "Accor"],
    ["ibis", "Accor"],
    ["Mövenpick", "Accor"],
    ["Movenpick", "Accor"],
    ["Swissôtel", "Accor"],
    ["Swissotel", "Accor"],
    ["MGallery", "Accor"],
    ["Mama Shelter", "Accor"],
    ["Orient Express", "Accor"],
    ["Rixos", "Accor"],
    ["greet", "Accor"],
    ["Hyde", "Accor"],
    ["Mondrian", "Accor"],
    ["Delano", "Accor"],
    ["Handwritten", "Accor"],
    ["Emblems", "Accor"],
    ["Mantis", "Accor"],
    ["SO/", "Accor"],
    ["InterContinental", "IHG"],
    ["Crowne Plaza", "IHG"],
    ["Holiday Inn", "IHG"],
    ["Hotel Indigo", "IHG"],
    ["Kimpton", "IHG"],
    ["voco", "IHG"],
    ["Six Senses", "IHG"],
    ["Regent", "IHG"],
    ["HUALUXE", "IHG"],
    ["Even Hotels", "IHG"],
  ];
  for (const [needle, group] of brands) {
    if (n.toLowerCase().includes(needle.toLowerCase())) return group;
  }
  return fallback || "Independent";
}
