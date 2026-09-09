/**
 * Pure parsers and filters for Hotel Press listings (14-day awards / good news).
 */
const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export const AWARD_RE =
  /\b(award|awards|honou?rs?|honou?red|recognized|recognised|certif(?:y|ied|ication|ies)|ranked?|ranking|debut|wins?\b|won\b|winner|named|earns?|earned|great place to work|green hotel|50 best|stella|forbes|michelin|iso\s*\d+|share award|employee experience|best hotel|world'?s\s+\d+|gold award|platinum|five-star|five star)\b/i;

export const GOOD_NEWS_RE =
  /\b(donat(?:e|es|ed|ion)|relief|community|cares|team members?|anniversary|first in|launches?|launching)\b/i;

export const DROP_RE =
  /\b(earnings|unaudited|financial results|q[1-4]\s+20\d{2}|ticket(?:s)?\s+(?:for|to go on sale)|shopping carnival kicks off|exhibition to nov|menu to highlight|stand-?up comedy)\b/i;

export function decodeHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&hellip;/gi, "…")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTags(s) {
  return decodeHtml(String(s || "").replace(/<[^>]+>/g, " "));
}

export function isoFromParts(year, month, day) {
  if (!year || !month || !day) return null;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseMonthName(name) {
  if (!name) return null;
  return MONTHS[name.toLowerCase().replace(/\./g, "")] ?? null;
}

/** Parse "03 Sep 2026", "Sep.3", "Aug.23 2026", "July.27". */
export function parseLooseDate(text, fallbackYear = null) {
  const s = stripTags(text);
  const dmy = s.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
  );
  if (dmy) {
    return isoFromParts(dmy[3], parseMonthName(dmy[2]), dmy[1]);
  }
  const mdy = s.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/i,
  );
  if (mdy) {
    return isoFromParts(mdy[3] || fallbackYear, parseMonthName(mdy[1]), mdy[2]);
  }
  return null;
}

export function parseDateFromUrl(url) {
  const u = String(url || "");
  const iso = u.match(/\/(20\d{2})-(\d{2})-(\d{2})\//);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const sand = u.match(/\/(20\d{2})\/(\d{2})-(\d{2})-/);
  if (sand) return `${sand[1]}-${sand[2]}-${sand[3]}`;
  const year = u.match(/\/(20\d{2})\//);
  return year ? year[1] : null;
}

export function classifyHeadline(title) {
  const t = String(title || "");
  const award = AWARD_RE.test(t);
  const good = GOOD_NEWS_RE.test(t);
  const drop = DROP_RE.test(t);
  if (drop && !award) return null;
  if (award) return "award";
  if (good) return "good-news";
  return null;
}

export function inWindow(posted, start, end) {
  if (!posted || posted.length !== 10) return false;
  return posted >= start && posted <= end;
}

export function windowBounds(today, days) {
  const [y, m, d] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d - days));
  const start = utc.toISOString().slice(0, 10);
  return { start, end: today };
}

export function absUrl(href, base) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

export function parseWynnNewsroomHtml(html, source) {
  const items = [];
  const blocks = html.split(/class="[^"]*news-list-item[^"]*"/i).slice(1);
  for (const block of blocks) {
    const hrefMatch = block.match(
      /class="[^"]*news-desc[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!hrefMatch) continue;
    const url = absUrl(hrefMatch[1], "https://www.newsroom.wynnresorts.com/");
    const title = stripTags(hrefMatch[2]);
    const logMatch = block.match(/class="[^"]*news-log[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/i);
    const posted =
      parseLooseDate(logMatch ? logMatch[1] : "") || parseDateFromUrl(url);
    if (!title || !url) continue;
    items.push({ title, url, posted, rawDate: stripTags(logMatch?.[1] || "") });
  }
  return decorateItems(items, source);
}

export function parseSandsPressHtml(html, source) {
  const items = [];
  const re =
    /<li>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absUrl(m[1], "https://en.sandsresortsmacao.com/");
    const rawTitle = stripTags(m[2]);
    if (!url || !rawTitle) continue;
    if (!/\/press-release\//i.test(url)) continue;
    const yearFromUrl = parseDateFromUrl(url);
    const year = typeof yearFromUrl === "string" && yearFromUrl.length === 10
      ? yearFromUrl.slice(0, 4)
      : typeof yearFromUrl === "string"
        ? yearFromUrl
        : null;
    const posted =
      (typeof yearFromUrl === "string" && yearFromUrl.length === 10
        ? yearFromUrl
        : null) || parseLooseDate(rawTitle, year);
    const title = rawTitle
      .replace(
        /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*\d{1,2}\s+/i,
        "",
      )
      .trim();
    items.push({ title, url, posted, rawDate: rawTitle });
  }
  return decorateItems(items, source);
}

function decorateItems(items, source) {
  return items.map((it) => ({
    ...it,
    hotelGroup: source.hotelGroup || source.hotelPressFetch?.hotelGroup || null,
    sourceName: source.displayName || source.domain,
    sourceDomain: source.domain,
    sourceUrl: source.url,
  }));
}

export function selectHotelPressArticles(items, { start, end }) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!inWindow(it.posted, start, end)) continue;
    const kind = classifyHeadline(it.title);
    if (!kind) continue;
    const key = `${(it.title || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim()}|${it.sourceDomain || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...it, kind });
  }
  return out.sort((a, b) => {
    if (a.posted !== b.posted) return b.posted.localeCompare(a.posted);
    return String(a.title).localeCompare(String(b.title));
  });
}

export function formatBriefDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

export function articlesToBriefMarkdown(articles, today) {
  const groups = new Map();
  for (const art of articles) {
    const name = art.hotelGroup || art.sourceName || "Hotels";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(art);
  }
  const parts = [
    "THE BAY: Hotel Press",
    `Date: ${formatBriefDate(today)} · ${articles.length} articles · method: hotel-press-agent-prompt (14-day awards & good news)`,
    "",
  ];
  let rank = 1;
  for (const [name, rows] of groups) {
    parts.push(`${name} (${rows.length}):`, "");
    for (const art of rows) {
      parts.push(`${rank}. **${art.title}** — ${art.sourceName}`);
      parts.push(art.url);
      parts.push(art.summary || `${art.hotelGroup || "Hotel"} press: ${art.title}.`);
      parts.push("");
      rank += 1;
    }
  }
  return parts.join("\n");
}
