#!/usr/bin/env node
/**
 * SEO Rank Tracker — builds seo-rankings-data.json for the "SEO Ranks" tab.
 *
 *  1. Google Search Console (Search Analytics API, service account):
 *     per keyword × market → daily position history, last-7-day and prior-7-day
 *     position, and every thebay.mo page ranking for the keyword.
 *  2. Competitors (Cursor cloud agent, read-only prompt):
 *     top organic results per keyword for markets with "competitors": true.
 *     Every URL the agent returns is checked live; dead links are dropped.
 *
 * Env:
 *   GSC_CREDENTIALS        — service account JSON with access to the GSC property
 *                            (falls back to GOOGLE_SHEETS_CREDENTIALS / GOOGLE_DRIVE_CREDENTIALS)
 *   GSC_SITE_URL           — optional; defaults to references/seo-keywords.json "site"
 *                            (use "sc-domain:thebay.mo" for a Domain property)
 *   GSC_HISTORY_DAYS       — optional; days of history to keep (default 480, GSC keeps ~16 months)
 *   CURSOR_API_KEY         — required for the competitor step
 *   CURSOR_CLOUD_MODEL     — optional model id override (same as the daily pipeline)
 *   SEO_URL_CHECK          — "off" skips live link checks (local debugging only)
 *   SEO_COMPETITORS        — auto (default: Mondays HKT, or if last check > 6 days old) | always | never
 *   SUPABASE_URL           — optional; skip history store when unset
 *   SUPABASE_SERVICE_ROLE_KEY — optional service-role key. A failed write does not block the JSON.
 *   SEO_MOCK=1             — local test only: mocked Search Console and Supabase, no Cursor run
 *
 * Usage:
 *   node scripts/capture-seo-rankings.mjs
 *   node scripts/capture-seo-rankings.mjs --competitors=always
 *   node scripts/capture-seo-rankings.mjs --dry-run      # print summary, do not write
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hktDateStr, hktIsoDateTime } from "./hkt-date.mjs";
import {
  buildSupabasePayload,
  createSupabaseWriter,
  summarisePayload,
  writeSupabasePayload,
} from "./seo-supabase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const CONFIG_PATH = path.join(root, "references", "seo-keywords.json");
const OUT_PATH = path.join(root, "seo-rankings-data.json");
const PROMPT_PATH = path.join(root, "prompts", "gba-pulse-seo-competitors.md");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const dryRun = Boolean(args["dry-run"]);
const competitorMode = String(args.competitors || process.env.SEO_COMPETITORS || "auto").toLowerCase();
const TOP_N = 20;
const TYPES = new Set(["government", "encyclopedia", "news", "consultancy", "data", "business", "travel", "academic", "video", "social", "other"]);

/* ───────────────────────── dates ───────────────────────── */
// Search Console reports in Pacific Time; final data lands ~2–3 days later.
function ptDateStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dateRange(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ───────────────────────── Search Console ───────────────────────── */
function gscCredentials() {
  const raw =
    process.env.GSC_CREDENTIALS?.trim() ||
    process.env.GOOGLE_SHEETS_CREDENTIALS?.trim() ||
    process.env.GOOGLE_DRIVE_CREDENTIALS?.trim() ||
    "";
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GSC_CREDENTIALS is not valid JSON");
  }
}

async function gscClient() {
  const credentials = gscCredentials();
  if (!credentials) throw new Error("No Search Console credentials: set GSC_CREDENTIALS (service account JSON).");
  let google;
  try {
    ({ google } = await import("googleapis"));
  } catch {
    throw new Error("googleapis not installed. Run: npm install googleapis --no-save");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return google.searchconsole({ version: "v1", auth });
}

function filtersFor(keyword, marketId) {
  const filters = [{ dimension: "query", operator: "equals", expression: keyword }];
  if (marketId && marketId !== "all") filters.push({ dimension: "country", operator: "equals", expression: marketId });
  return [{ groupType: "and", filters }];
}

async function gscQuery(sc, siteUrl, body, attempt = 0) {
  try {
    const res = await sc.searchanalytics.query({ siteUrl, requestBody: { rowLimit: 25000, dataState: "final", ...body } });
    return res.data.rows || [];
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if ((code === 429 || code >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return gscQuery(sc, siteUrl, body, attempt + 1);
    }
    if (code === 403) {
      throw new Error(
        `Search Console returned 403 for ${siteUrl}. Add the service account email as a user on this property, and check GSC_SITE_URL matches the property exactly.`
      );
    }
    throw err;
  }
}

/** Page through Search Console. rowLimit max is 25,000; startRow is the next offset. */
async function gscQueryAll(sc, siteUrl, body) {
  const rowLimit = 25000;
  const rows = [];
  for (let startRow = 0; ; startRow += rowLimit) {
    const batch = await gscQuery(sc, siteUrl, { ...body, rowLimit, startRow });
    rows.push(...batch);
    if (batch.length < rowLimit) break;
  }
  return rows;
}

/** Impression-weighted mean position — equals GSC's own aggregate for the same filter. */
function aggregate(days) {
  const withImpr = days.filter((d) => d.impressions > 0 && d.position != null);
  const impressions = withImpr.reduce((a, d) => a + d.impressions, 0);
  const clicks = withImpr.reduce((a, d) => a + d.clicks, 0);
  if (!impressions) return { position: null, impressions: 0, clicks: 0, ctr: 0 };
  const position = withImpr.reduce((a, d) => a + d.position * d.impressions, 0) / impressions;
  return { position: +position.toFixed(1), impressions, clicks, ctr: +(clicks / impressions).toFixed(4) };
}

async function captureGsc(cfg, previous) {
  const sc = await gscClient();
  const siteUrl = process.env.GSC_SITE_URL?.trim() || cfg.site;
  const historyDays = Math.min(490, Math.max(28, parseInt(process.env.GSC_HISTORY_DAYS || "480", 10)));
  const end = ptDateStr(-3);
  const start = addDays(end, -(historyDays - 1));
  const cur7 = [addDays(end, -6), end];
  const prev7 = [addDays(end, -13), addDays(end, -7)];
  const allDates = dateRange(start, end);
  const titleCache = collectTitles(previous);

  console.log(`GSC ${siteUrl} · ${start} → ${end} (${historyDays} days)`);
  const keywords = [];
  const rankDaily = [];
  const pageDaily = [];
  for (const kw of cfg.keywords) {
    const markets = {};
    for (const m of cfg.markets) {
      const dimensionFilterGroups = filtersFor(kw.keyword, m.id);
      const rows = await gscQuery(sc, siteUrl, { startDate: start, endDate: end, dimensions: ["date"], dimensionFilterGroups });
      const byDate = new Map(rows.map((r) => [r.keys[0], r]));
      for (const [date, r] of byDate) {
        const impressions = r.impressions ?? 0;
        const clicks = r.clicks ?? 0;
        rankDaily.push({
          date,
          keyword: kw.keyword,
          market: m.id,
          position: r.position != null ? +Number(r.position).toFixed(1) : null,
          impressions,
          clicks,
          ctr: r.ctr != null ? +Number(r.ctr).toFixed(4) : impressions ? +(clicks / impressions).toFixed(4) : null,
        });
      }
      const history = allDates.map((date) => {
        const r = byDate.get(date);
        return r
          ? { date, position: +r.position.toFixed(1), impressions: r.impressions, clicks: r.clicks }
          : { date, position: null, impressions: 0, clicks: 0 };
      });
      const inRange = ([a, b]) => history.filter((h) => h.date >= a && h.date <= b);

      const pageBody = (range) => ({ startDate: range[0], endDate: range[1], dimensions: ["page"], dimensionFilterGroups });
      const [pNow, pPrev] = await Promise.all([gscQuery(sc, siteUrl, pageBody(cur7)), gscQuery(sc, siteUrl, pageBody(prev7))]);
      const prevPos = new Map(pPrev.map((r) => [r.keys[0], r.position]));
      const pages = [];
      for (const r of pNow) {
        const url = r.keys[0];
        const t = await pageTitle(url, titleCache);
        pages.push({
          url,
          title: t.title,
          ...(t.fromSlug ? { titleFromSlug: true } : {}),
          position: +r.position.toFixed(1),
          previousPosition: prevPos.has(url) ? +prevPos.get(url).toFixed(1) : null,
          impressions: r.impressions,
          clicks: r.clicks,
        });
      }
      pages.sort((a, b) => a.position - b.position);

      const titleByUrl = new Map(pages.map((p) => [p.url, p.title]));
      const dailyPages = await gscQueryAll(sc, siteUrl, {
        startDate: start,
        endDate: end,
        dimensions: ["date", "page"],
        dimensionFilterGroups,
      });
      for (const r of dailyPages) {
        const date = r.keys?.[0];
        const pageUrl = r.keys?.[1];
        if (!date || !pageUrl) continue;
        pageDaily.push({
          date,
          keyword: kw.keyword,
          market: m.id,
          page_url: pageUrl,
          position: r.position != null ? +Number(r.position).toFixed(1) : null,
          impressions: r.impressions ?? 0,
          clicks: r.clicks ?? 0,
          page_title: titleByUrl.get(pageUrl) || null,
        });
      }

      markets[m.id] = {
        current: aggregate(inRange(cur7)),
        previous: aggregate(inRange(prev7)),
        history: trimLeadingEmpty(history),
        pages,
      };
      const c = markets[m.id].current;
      console.log(`  ${kw.keyword.padEnd(24)} ${m.id}  pos ${c.position ?? "—"}  impr ${c.impressions}  pages ${pages.length}`);
    }
    keywords.push({ ...kw, markets });
  }
  return { keywords, rankDaily, pageDaily, gsc: { siteUrl, dataThrough: end, windowDays: 7, historyDays } };
}

/** Keep only days with impressions — the chart treats missing days as gaps. */
function trimLeadingEmpty(history) {
  return history.filter((h) => h.position != null);
}

/* ───────────────────────── page titles ───────────────────────── */
function collectTitles(previous) {
  const map = new Map();
  for (const kw of previous?.keywords || []) {
    for (const mb of Object.values(kw.markets || {})) {
      for (const p of mb.pages || []) if (p.url && p.title && !p.titleFromSlug) map.set(p.url, p.title);
    }
  }
  return map;
}

function titleFromSlug(url) {
  try {
    const u = new URL(url);
    if (u.pathname === "/" || !u.pathname) return "The Bay — homepage";
    const slug = u.pathname.split("/").filter(Boolean).pop();
    const t = slug.replace(/-/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  } catch {
    return url;
  }
}

async function pageTitle(url, cache) {
  if (cache.has(url)) return { title: cache.get(url), fromSlug: false };
  let title = null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; GBA-Pulse-SEO/1.0; +https://sara-hoilam.github.io/the-bay-trending-topics/)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (res.ok) {
      const html = (await res.text()).slice(0, 200000);
      const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const tt = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = decodeEntities((og?.[1] || tt?.[1] || "").trim()).replace(/\s*[•|–—-]\s*The Bay\s*$/i, "").trim() || null;
    }
  } catch {
    /* Cloudflare or timeout — fall back to slug */
  }
  if (title) cache.set(url, title);
  return { title: title || titleFromSlug(url), fromSlug: !title };
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/* ───────────────────────── competitors (Cursor) ───────────────────────── */
function competitorsDue(previous, marketId) {
  if (competitorMode === "always") return true;
  if (competitorMode === "never") return false;
  const last = previous?.keywords?.[0]?.markets?.[marketId]?.competitors?.checkedAt;
  if (!last) return true;
  const ageDays = (Date.parse(hktDateStr()) - Date.parse(last)) / 86400000;
  const isMondayHkt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", weekday: "short" }).format(new Date()) === "Mon";
  return isMondayHkt || ageDays > 6;
}

function buildPrompt(cfg, market) {
  const tpl = fs.readFileSync(PROMPT_PATH, "utf8");
  const list = cfg.keywords.map((k, i) => `${i + 1}. \`${k.keyword}\``).join("\n");
  return tpl
    .replaceAll("{{MARKET_LABEL}}", market.label)
    .replaceAll("{{MARKET_ID}}", market.id)
    .replaceAll("{{GL}}", market.gl || "hk")
    .replaceAll("{{TOP_N}}", String(TOP_N))
    .replaceAll("{{KEYWORDS}}", list);
}

function extractJson(text) {
  if (!text) return null;
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = blocks.length ? blocks.reverse() : [text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return null;
}

async function checkUrl(url) {
  if (process.env.SEO_URL_CHECK === "off") return 299; // local debugging only
  const opts = (method) => ({
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" },
  });
  try {
    let res = await fetch(url, opts("HEAD"));
    if (res.status === 405 || res.status === 501) res = await fetch(url, opts("GET"));
    return res.status;
  } catch {
    return 0; // DNS failure / timeout
  }
}

async function runCompetitors(cfg, market) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) throw new Error("CURSOR_API_KEY not set");
  const { Agent, Cursor } = await import("@cursor/sdk");
  const { resolveCloudModelId, listModelIds, DEFAULT_CLOUD_MODEL_ID, TARGET_REPO } = await import("./cloud-sdk-utils.mjs");

  let modelId = process.env.CURSOR_CLOUD_MODEL?.trim() || DEFAULT_CLOUD_MODEL_ID;
  try {
    modelId = resolveCloudModelId(listModelIds(await Cursor.models.list({ apiKey }))).modelId;
  } catch {
    /* keep default */
  }
  console.log(`Competitors · ${market.label} · model ${modelId}`);
  const result = await Agent.prompt(buildPrompt(cfg, market), {
    apiKey,
    model: { id: modelId },
    cloud: { repos: [{ url: TARGET_REPO, startingRef: "main" }], autoCreatePR: false, skipReviewerRequest: true },
  });
  if (result.status !== "finished") throw new Error(`Cursor run ${result.id} ended with status ${result.status}${result.error ? ": " + result.error.message : ""}`);
  const parsed = extractJson(result.result);
  if (!parsed || !Array.isArray(parsed.keywords)) throw new Error(`Cursor run ${result.id} returned no parsable JSON`);

  const checkedAt = hktDateStr();
  const out = {};
  for (const k of cfg.keywords) {
    const entry = parsed.keywords.find((e) => String(e.keyword || "").toLowerCase().trim() === k.keyword);
    const method = entry?.method === "google_serp" ? "google_serp" : "web_search_estimate";
    const list = [];
    const seen = new Set();
    for (const r of entry?.results || []) {
      const pos = parseInt(r.position, 10);
      if (!(pos >= 1 && pos <= TOP_N)) continue;
      let u;
      try {
        u = new URL(String(r.url));
      } catch {
        continue;
      }
      if (!/^https?:$/.test(u.protocol) || seen.has(u.href)) continue;
      seen.add(u.href);
      const status = await checkUrl(u.href);
      if (status === 0 || status === 404 || status === 410) {
        console.warn(`  drop ${u.href} (${status || "unreachable"}) — likely not a real result`);
        continue;
      }
      list.push({
        position: pos,
        title: String(r.title || u.hostname).slice(0, 180),
        url: u.href,
        domain: u.hostname.replace(/^www\./, ""),
        type: TYPES.has(r.type) ? r.type : "other",
        note: String(r.note || "").slice(0, 120),
        verified: status < 400 ? true : status === 401 || status === 403 || status === 429 ? null : false,
        httpStatus: status,
      });
    }
    list.sort((a, b) => a.position - b.position);
    out[k.keyword] = {
      checkedAt,
      market: market.id,
      method,
      source: method === "google_serp" ? "Cursor agent reading Google results" : "Cursor agent web search — order estimated",
      notes: String(entry?.notes || "").slice(0, 300),
      list,
    };
    console.log(`  ${k.keyword.padEnd(24)} ${list.length} results (${method})`);
  }
  return out;
}

/* ───────────────────────── mock (local tests only) ───────────────────────── */
function mockCapture(cfg) {
  const keyword = cfg.keywords[0]?.keyword || "greater bay area china";
  const market = cfg.markets.find((m) => m.competitors)?.id || cfg.markets[0]?.id || "hkg";
  const rankDaily = [
    { date: "2026-09-19", keyword, market, position: 36.1, impressions: 4, clicks: 0, ctr: 0 },
    { date: "2026-09-20", keyword, market, position: 35.8, impressions: 5, clicks: 1, ctr: 0.2 },
  ];
  const pageDaily = [
    {
      date: "2026-09-20",
      keyword,
      market,
      page_url: "https://thebay.mo/greater-bay-area",
      position: 12.4,
      impressions: 5,
      clicks: 1,
      page_title: "Greater Bay Area",
    },
  ];
  const keywords = [
    {
      keyword,
      markets: {
        [market]: {
          competitors: {
            checkedAt: "2026-09-22",
            method: "web_search_estimate",
            list: [
              {
                position: 1,
                url: "https://www.scmp.com/topics/greater-bay-area",
                domain: "scmp.com",
                title: "Greater Bay Area",
                type: "news",
                note: "Mock result",
                verified: null,
                httpStatus: 403,
              },
            ],
          },
        },
      },
    },
  ];
  return {
    keywords,
    rankDaily,
    pageDaily,
    gsc: { siteUrl: cfg.site, dataThrough: "2026-09-20", windowDays: 7, historyDays: 2 },
  };
}

/* ───────────────────────── main ───────────────────────── */
async function main() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const capturedAt = new Date().toISOString();

  if (process.env.SEO_MOCK === "1") {
    const mock = mockCapture(cfg);
    const payload = buildSupabasePayload({ ...mock, capturedAt });
    const calls = [];
    const client = {
      from(table) {
        return {
          upsert(rows, options) {
            calls.push({ table, onConflict: options?.onConflict, rows });
            return Promise.resolve({ error: null });
          },
        };
      },
    };
    await writeSupabasePayload(payload, client);
    console.log("SEO_MOCK: mocked Search Console and Supabase. No file written, no Cursor run.");
    console.log(summarisePayload(payload));
    console.log("\nUpsert calls:");
    for (const call of calls) {
      console.log(`${call.table} onConflict=${call.onConflict} rows=${call.rows.length}`);
      for (const row of call.rows) console.log(JSON.stringify(row));
    }
    return;
  }

  const previous = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, "utf8")) : null;
  const prevUsable = previous && !previous.sample ? previous : null;

  const { keywords, rankDaily, pageDaily, gsc } = await captureGsc(cfg, prevUsable);

  for (const m of cfg.markets.filter((x) => x.competitors)) {
    let fresh = null;
    if (competitorsDue(prevUsable, m.id)) {
      try {
        fresh = await runCompetitors(cfg, m);
      } catch (err) {
        console.warn(`⚠ Competitor check failed for ${m.label}: ${err.message} — keeping previous data`);
      }
    } else {
      console.log(`Competitors · ${m.label} · not due (mode ${competitorMode}) — keeping previous data`);
    }
    for (const kw of keywords) {
      const prevComp = prevUsable?.keywords?.find((k) => k.keyword === kw.keyword)?.markets?.[m.id]?.competitors;
      const comp = fresh?.[kw.keyword] || prevComp;
      if (comp) kw.markets[m.id].competitors = comp;
    }
  }

  const data = {
    sample: false,
    updatedAt: hktDateStr(),
    refreshedAt: hktIsoDateTime(),
    refreshedAtLabel: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()) + " HKT",
    site: gsc.siteUrl,
    ourDomain: cfg.ourDomain,
    gsc,
    markets: cfg.markets.map(({ id, label }) => ({ id, label })),
    keywords,
  };

  const payload = buildSupabasePayload({ keywords, rankDaily, pageDaily, capturedAt });

  if (dryRun) {
    console.log("\n--dry-run: not writing JSON or Supabase. Summary:");
    for (const k of keywords) console.log(k.keyword, JSON.stringify(k.markets.hkg?.current));
    console.log("\n" + summarisePayload(payload));
    return;
  }

  try {
    const client = await createSupabaseWriter();
    if (!client) {
      console.warn("⚠ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase history");
    } else {
      await writeSupabasePayload(payload, client);
      console.log("Supabase history upserted.");
    }
  } catch (err) {
    console.warn(`⚠ Supabase write failed (${err.message}) — JSON will still be saved`);
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(data));
  console.log(`\nWrote ${path.relative(root, OUT_PATH)} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
