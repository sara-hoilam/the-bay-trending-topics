/**
 * Score lifestyle calendar events for the Happenings "Highlighted Events" row.
 * Major fairs, festivals, concerts, and crowd-pulling exhibitions score higher.
 */

const MARQUEE_PATTERNS = [
  /clockenflap/i,
  /comic\s*con/i,
  /comicon/i,
  /art\s*basel/i,
  /book\s*fair/i,
  /marathon/i,
  /dragon\s*boat\s*(festival|races)/i,
  /f1|formula\s*1|grand\s*prix/i,
  /rugby\s*sevens/i,
  /cantopop|mandopop/i,
  /world\s*tour/i,
  /music\s*festival/i,
  /arts?\s*festival/i,
  /film\s*festival/i,
  /food\s*(and\s*)?wine/i,
  /wine\s*to\s*asia/i,
];

const CROWD_KEYWORDS = [
  { re: /\bfestival\b/i, score: 18 },
  { re: /\bexpo\b/i, score: 16 },
  { re: /\bfair\b/i, score: 14 },
  { re: /\bconcert\b/i, score: 12 },
  { re: /\bcarnival\b/i, score: 12 },
  { re: /\bchampionship\b/i, score: 10 },
  { re: /\binternational\b/i, score: 10 },
  { re: /\bshopping\b/i, score: 8 },
  { re: /\bexhibition\b/i, score: 6 },
];

const MAJOR_VENUES = [
  /asiaworld[- ]expo/i,
  /hkcec|hong kong convention/i,
  /west kowloon|m\+/i,
  /palace museum/i,
  /macao cultural centre/i,
  /sands (theatre|macao)/i,
  /shenzhen world/i,
];

export const HIGHLIGHT_SCORE_THRESHOLD = 24;

function eventSpanDays(ev) {
  if (!ev.start || !ev.end) return 1;
  const [sy, sm, sd] = ev.start.split("-").map(Number);
  const [ey, em, ed] = ev.end.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

/** @returns {number} highlight score (higher = more likely crowd-pulling) */
export function highlightScore(ev) {
  const title = ev.title || "";
  const blob = `${title} ${ev.location || ""}`;
  let score = 0;

  if (ev.featured) score += 40;

  for (const re of MARQUEE_PATTERNS) {
    if (re.test(blob)) score += 28;
  }

  for (const { re, score: pts } of CROWD_KEYWORDS) {
    if (re.test(blob)) score += pts;
  }

  for (const re of MAJOR_VENUES) {
    if (re.test(blob)) score += 8;
  }

  const span = eventSpanDays(ev);
  if (span >= 14) score += 12;
  else if (span >= 7) score += 8;
  else if (span >= 3) score += 4;

  if (/tour in (macau|macao|hong kong|hk)/i.test(blob)) score += 10;

  return score;
}

export function isHighlightedEvent(ev) {
  return highlightScore(ev) >= HIGHLIGHT_SCORE_THRESHOLD;
}

export function annotateHighlight(ev) {
  const score = highlightScore(ev);
  return {
    ...ev,
    highlightScore: score,
    highlighted: score >= HIGHLIGHT_SCORE_THRESHOLD,
  };
}
