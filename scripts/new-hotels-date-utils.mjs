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

/** Country matchers for Asia + Portugal (order matters — more specific first). */
const COUNTRY_RULES = [
  { country: "Portugal", region: "portugal", re: /\bportugal\b|\blisbon\b|\bporto\b|\bcomporta\b|\bmelides\b|\balgarve\b|\bcascais\b|\bsintra\b|\bmadeira\b|\bazores\b/i },
  { country: "Hong Kong", region: "asia", re: /\bhong kong\b|\bhk\b/i },
  { country: "Macao", region: "asia", re: /\bmacao\b|\bmacau\b/i },
  { country: "South Korea", region: "asia", re: /\bsouth korea\b|\bkorea\b|\bseoul\b|\bbusan\b|\bincheon\b|\bjeju\b|\banyang\b/i },
  { country: "North Korea", region: "asia", re: /\bnorth korea\b/i },
  { country: "China", region: "asia", re: /\bchina\b|\bshanghai\b|\bbeijing\b|\bshenzhen\b|\bguangzhou\b|\bchengdu\b|\bjilin\b|\bhongqiao\b|\bdalian\b/i },
  { country: "Taiwan", region: "asia", re: /\btaiwan\b|\btaipei\b/i },
  { country: "Japan", region: "asia", re: /\bjapan\b|\bkyoto\b|\btokyo\b|\bosaka\b|\bokinawa\b|\bhokkaido\b|\bniseko\b|\bhiroshima\b|\bkobe\b|\byokohama\b|\bmatsumoto\b|\bmyoko\b/i },
  { country: "Thailand", region: "asia", re: /\bthailand\b|\bbangkok\b|\bphuket\b|\bkrabi\b|\bchiang mai\b|\bao nang\b/i },
  { country: "Vietnam", region: "asia", re: /\bvietnam\b|\bhanoi\b|\bho chi minh\b|\bsaigon\b|\bdanang\b|\bda nang\b|\bphu quoc\b|\bhoi an\b/i },
  { country: "Singapore", region: "asia", re: /\bsingapore\b/i },
  { country: "Malaysia", region: "asia", re: /\bmalaysia\b|\bkuala lumpur\b|\bpenang\b|\bsubang\b|\bkota kinabalu\b|\bjohor\b/i },
  { country: "Indonesia", region: "asia", re: /\bindonesia\b|\bbali\b|\bjakarta\b|\bubud\b|\bmanado\b|\bbandung\b|\bmedan\b|\bbatam\b/i },
  { country: "Philippines", region: "asia", re: /\bphilippines\b|\bmanila\b|\bboracay\b/i },
  { country: "India", region: "asia", re: /\bindia\b|\bmumbai\b|\bdelhi\b|\bgoa\b|\bkerala\b|\budai?pur\b|\bghaziabad\b|\bhopal\b|\bamritsar\b|\branthambore\b|\bnathdwara\b/i },
  { country: "Sri Lanka", region: "asia", re: /\bsri lanka\b|\bcolombo\b/i },
  { country: "Maldives", region: "asia", re: /\bmaldives\b|\bmirihi\b/i },
  { country: "Nepal", region: "asia", re: /\bnepal\b|\bkathmandu\b/i },
  { country: "Bhutan", region: "asia", re: /\bbhutan\b/i },
  { country: "Bangladesh", region: "asia", re: /\bbangladesh\b|\bdhaka\b|\bchittagong\b/i },
  { country: "Pakistan", region: "asia", re: /\bpakistan\b/i },
  { country: "Myanmar", region: "asia", re: /\bmyanmar\b|\byangon\b/i },
  { country: "Laos", region: "asia", re: /\blaos\b|\bluang prabang\b/i },
  { country: "Cambodia", region: "asia", re: /\bcambodia\b|\bphnom penh\b|\bsiem reap\b/i },
  { country: "Mongolia", region: "asia", re: /\bmongolia\b|\bulan bator\b|\bulaanbaatar\b/i },
  { country: "Uzbekistan", region: "asia", re: /\buzbekistan\b/i },
  { country: "Kazakhstan", region: "asia", re: /\bkazakhstan\b/i },
];

/**
 * Infer ISO-style display country for Asia / Portugal hotels.
 * Returns null when country cannot be determined.
 */
export function inferCountry(location, sourceRegion = null, name = "") {
  const blob = `${location || ""} ${sourceRegion || ""} ${name || ""}`;
  if (!blob.trim()) return null;

  // Prefer explicit country after the last comma: "Kyoto, Japan"
  const loc = String(location || "").trim();
  if (loc) {
    const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
    const tail = parts.length >= 2 ? parts[parts.length - 1] : parts[0];
    if (tail) {
      for (const rule of COUNTRY_RULES) {
        if (rule.re.test(tail) || rule.country.toLowerCase() === tail.toLowerCase()) {
          return rule.country;
        }
      }
    }
  }

  for (const rule of COUNTRY_RULES) {
    if (rule.re.test(blob)) return rule.country;
  }
  return null;
}

/**
 * Map free-text location / source region into filter buckets.
 * Returns "portugal" | "asia" | "other" | null.
 */
export function inferLocationRegion(location, sourceRegion = null, name = "") {
  const country = inferCountry(location, sourceRegion, name);
  if (country === "Portugal") return "portugal";
  if (country) return "asia";

  const blob = `${location || ""} ${sourceRegion || ""} ${name || ""}`.toLowerCase();
  if (!blob.trim()) return null;
  if (/\basia\b/.test(String(sourceRegion || "").toLowerCase())) return "asia";
  return "other";
}

/** Keep only Asia + Portugal hotels on the New Hotels page. */
export function isAsiaOrPortugal(hotel) {
  const region =
    hotel.region ||
    inferLocationRegion(hotel.location, null, hotel.name);
  return region === "asia" || region === "portugal";
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

/**
 * Prefer a direct hotel website URL. Skip affiliate booking wrappers
 * (stay22, etc.) — those are not the hotel's own site.
 */
export function normalizeWebsiteUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (
      host.includes("stay22.com") ||
      host.includes("booking.com") ||
      host.includes("expedia.") ||
      host.includes("hotels.com") ||
      host.includes("agoda.com")
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed;
}

/**
 * Infer star rating (1–5) from explicit text or well-known brand positioning.
 * Returns null when not applicable / unknown (UI shows "—").
 */
export function inferStars({ name = "", hotelGroup = "", category = "", description = "" } = {}) {
  const blob = `${description} ${name} ${category}`;
  const explicit = blob.match(/\b([1-5])\s*[-–]?\s*stars?\b/i);
  if (explicit) return Number(explicit[1]);

  const n = String(name || "");
  const group = String(hotelGroup || "");

  // More specific brand needles first
  const brandStars = [
    [/\bRitz[- ]Carlton\b/i, 5],
    [/\bSt\.?\s*Regis\b/i, 5],
    [/\bJW Marriott\b/i, 5],
    [/\bFour Seasons\b/i, 5],
    [/\bMandarin Oriental\b/i, 5],
    [/\bPeninsula\b/i, 5],
    [/\bRosewood\b/i, 5],
    [/\bAman\b/i, 5],
    [/\bCapella\b/i, 5],
    [/\bBulgari\b/i, 5],
    [/\bWaldorf Astoria\b/i, 5],
    [/\bConrad\b/i, 5],
    [/\bShangri-?La\b/i, 5],
    [/\bPark Hyatt\b/i, 5],
    [/\bGrand Hyatt\b/i, 5],
    [/\bRaffles\b/i, 5],
    [/\bFairmont\b/i, 5],
    [/\bSofitel\b/i, 5],
    [/\bOrient Express\b/i, 5],
    [/\bSix Senses\b/i, 5],
    [/\bRegent\b/i, 5],
    [/\bInterContinental\b/i, 5],
    [/\bEmblems\b/i, 5],
    [/\bDelano\b/i, 5],
    [/\bW Hotel|\bW \b/i, 5],
    [/\bPullman\b/i, 4],
    [/\bSheraton\b/i, 4],
    [/\bWestin\b/i, 4],
    [/\bSwiss[oô]tel\b/i, 4],
    [/\bM[öo]venpick\b/i, 4],
    [/\bMGallery\b/i, 4],
    [/\bCrowne Plaza\b/i, 4],
    [/\bHotel Indigo\b/i, 4],
    [/\bKimpton\b/i, 4],
    [/\bvoco\b/i, 4],
    [/\bHyde\b/i, 4],
    [/\bMondrian\b/i, 4],
    [/\bSO\//i, 4],
    [/\bRixos\b/i, 4],
    [/\bNovotel\b/i, 4],
    [/\bAC Hotel\b/i, 4],
    [/\bAutograph\b/i, 4],
    [/\bTribute Portfolio\b/i, 4],
    [/\bHUALUXE\b/i, 4],
    [/\bCourtyard\b/i, 3],
    [/\bFour Points\b/i, 3],
    [/\bHoliday Inn(?!\s+Express)\b/i, 3],
    [/\bMercure\b/i, 3],
    [/\bMama Shelter\b/i, 3],
    [/\bAloft\b/i, 3],
    [/\bElement\b/i, 3],
    [/\bEven Hotels\b/i, 3],
    [/\bFairfield\b/i, 3],
    [/\bHoliday Inn Express\b/i, 2],
    [/\bMoxy\b/i, 2],
    [/\bibis\b/i, 2],
    [/\bgreet\b/i, 2],
  ];
  for (const [re, stars] of brandStars) {
    if (re.test(n) || re.test(group)) return stars;
  }

  // Opening List category hint when brand is unknown
  if (/^luxury$/i.test(category)) return 5;
  if (/^boutique$/i.test(category)) return 4;

  return null;
}
