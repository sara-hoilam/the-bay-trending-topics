#!/usr/bin/env node
/**
 * Scrape top Ticketflap listings (HK + Macao) via headless Chrome.
 * Writes references/ticketflap-events-cache.json for generate-happenings-data.mjs.
 *
 * Ticketflap uses bot protection — run on a local machine (e.g. Surface) when
 * cloud fetch returns empty. Falls back to references/ticketflap-top-events.json.
 *
 * Usage: node scripts/fetch-ticketflap-events.mjs
 */
import fs from "fs";
import { hktDateStr } from "./hkt-date.mjs";
import {
  TICKETFLAP_CACHE_PATH,
  TICKETFLAP_LOCATION_PAGES,
  inferTicketflapDates,
  loadTicketflapPool,
  selectTicketflapEvents,
} from "./ticketflap-events-utils.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROME_PATHS = [
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function chromePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function loadPuppeteer() {
  try {
    return await import("puppeteer-core");
  } catch {
    return null;
  }
}

async function waitForContent(page, maxPolls = 12, intervalMs = 2000) {
  for (let i = 0; i < maxPolls; i++) {
    const len = await page.evaluate(() => (document.body?.innerText || "").length);
    if (len > 400) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function scrapeLocationPage(page, cfg, today) {
  for (const url of cfg.urls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      const ready = await waitForContent(page);
      if (!ready) continue;

      const raw = await page.evaluate(() => {
        const skip = new Set([
          "pages", "admin", "api", "cart", "checkout", "list-an-event-with-us-now",
          "locale", "logout", "static", "media", "password", "reports", "settings",
          "user", "voucher", "vouchers", "events", "location", "zh-hant", "zh-hans", "en",
        ]);
        const out = [];
        const seen = new Set();
        for (const a of document.querySelectorAll('a[href*="ticketflap.com/"]')) {
          let slug;
          try {
            const u = new URL(a.href);
            slug = u.pathname.replace(/^\/+/, "").split("/")[0];
            if (!slug || skip.has(slug.toLowerCase()) || slug.includes(".")) continue;
          } catch {
            continue;
          }
          const title = (a.textContent || "").replace(/\s+/g, " ").trim();
          if (title.length < 4 || seen.has(title.toLowerCase())) continue;
          const card = a.closest("article, li, [class*='event'], [class*='card']") || a.parentElement;
          const blob = (card?.textContent || title).replace(/\s+/g, " ").trim();
          seen.add(title.toLowerCase());
          out.push({ title, url: a.href.split("?")[0], blob });
        }
        return out;
      });

      if (raw.length) {
        return raw.map((hit) => {
          const dates = inferTicketflapDates(hit.blob, today);
          return {
            title: hit.title,
            start: dates.start,
            end: dates.end,
            region: cfg.region,
            location: cfg.location,
            url: hit.url,
            sourceDomain: "ticketflap.com",
            ...(dates.dateNote ? { dateNote: dates.dateNote } : {}),
          };
        });
      }
    } catch (err) {
      console.warn(`  Skip ${url}: ${err.message}`);
    }
  }
  return [];
}

async function scrapeTicketflap(today) {
  const puppeteer = await loadPuppeteer();
  const executablePath = chromePath();
  if (!puppeteer || !executablePath) {
    console.warn("Puppeteer or Chrome not available — using curated fallback.");
    return [];
  }

  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const scraped = [];

  try {
    for (const cfg of TICKETFLAP_LOCATION_PAGES) {
      console.log(`Scraping Ticketflap ${cfg.label}…`);
      const events = await scrapeLocationPage(page, cfg, today);
      console.log(`  ${events.length} raw hits for ${cfg.label}`);
      scraped.push(...events.slice(0, cfg.maxTop));
    }
  } finally {
    await browser.close();
  }

  return scraped;
}

async function main() {
  const today = hktDateStr();
  let pool = await scrapeTicketflap(today);
  let source = "scrape";

  if (!pool.length) {
    const fallback = loadTicketflapPool(today);
    pool = fallback.events;
    source = fallback.from;
    console.warn(`Scrape empty — using ${source} (${pool.length} events).`);
  }

  const events = selectTicketflapEvents(pool, today);
  const payload = {
    updatedAt: today,
    source,
    events,
  };

  fs.writeFileSync(TICKETFLAP_CACHE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${TICKETFLAP_CACHE_PATH} (${events.length} selected events, source=${source})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
