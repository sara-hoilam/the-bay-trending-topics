#!/usr/bin/env node
/**
 * Convert THE BAY Daily Brief markdown → GBA Pulse overall panel HTML fragment.
 *
 * Usage:
 *   node scripts/daily-brief-to-html.mjs
 *   node scripts/daily-brief-to-html.mjs --input="Training Data/2026-06-03-daily-brief.md"
 *   node scripts/daily-brief-to-html.mjs --merge   # also splice into index.html
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import {
  resolveDailyBriefInput,
  root as repoRoot,
} from "./daily-brief-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = repoRoot;

const DOMAIN_LABELS = {
  "info.newsgd.com": "NewsGD",
  "news.southcn.com": "Southern Net",
  "gzdaily.dayoo.com": "Guangzhou Daily",
  "news.tvb.com": "TVB News",
  "stheadline.com": "Headline Daily",
  "tdm.com.mo": "TDM",
  "macaubusiness.com": "Macao Business",
  "gov.mo": "Macao SAR Government",
  "scmp.com": "SCMP",
  "modaily.cn": "Macao Daily",
  "macaudailytimes.com.mo": "Macao Daily Times",
  "thestandard.com.hk": "The Standard",
  "info.gov.hk": "Hong Kong Government",
  "hongkongfp.com": "Hong Kong Free Press",
  "news.rthk.hk": "RTHK",
  "chinadaily.com.cn": "China Daily",
  "hengqin.gov.cn": "Hengqin authority",
  "sznews.com": "Shenzhen News",
  "sztqb.sznews.com": "Shenzhen Special Zone Daily",
  "gba.net.cn": "GBA.net",
  "news.cgtn.com": "CGTN",
  "epaper.nfnews.com": "NF News",
};

function defaultBriefInput() {
  return resolveDailyBriefInput(null) ?? path.join(root, "Training Data", "2026-06-03-daily-brief.md");
}

function parseArgs(argv) {
  let explicitInput = null;
  const out = {
    input: null,
    output: path.join(root, "orchestration/fragments/overall.html"),
    merge: false,
  };
  for (const a of argv) {
    if (a === "--merge") out.merge = true;
    else {
      const m = a.match(/^--(\w+)=(.+)$/);
      if (m) {
        if (m[1] === "input") explicitInput = path.resolve(root, m[2]);
        else out[m[1]] = path.resolve(root, m[2]);
      }
    }
  }
  out.input = resolveDailyBriefInput(explicitInput);
  if (!out.input || !fs.existsSync(out.input)) {
    console.error("No daily brief markdown found under Training Data/");
    process.exit(1);
  }
  return out;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSummary(text) {
  const parts = text.split(/==([^=]+)==/g);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? `<mark class="brief-highlight">${escapeHtml(part)}</mark>`
        : escapeHtml(part),
    )
    .join("")
    .replace(/'/g, "&apos;");
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function labelForUrl(url) {
  const host = hostFromUrl(url);
  if (DOMAIN_LABELS[host]) return DOMAIN_LABELS[host];
  const parts = host.split(".");
  const base = parts.length >= 2 ? parts.slice(-2).join(".") : host;
  if (DOMAIN_LABELS[base]) return DOMAIN_LABELS[base];
  return host
    .split(".")
    .slice(0, -1)
    .join(".")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || host;
}

function postedDateFromUrl(url, fallback) {
  const patterns = [
    /\/(\d{4})-(\d{2})\/(\d{2})\//,
    /\/(\d{4})(\d{2})\/(\d{2})\//,
    /-(\d{8})\.htm/,
    /content\/(\d{4})-(\d{2})\/(\d{2})\//,
    /html\/(\d{6})\/(\d{2})\//,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (!m) continue;
    if (m[0].includes("html/")) {
      const y = m[1].slice(0, 4);
      const mo = m[1].slice(4, 6);
      const d = m[2];
      return `${y}-${mo}-${d}`;
    }
    if (m[1].length === 8) {
      const s = m[1];
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return fallback;
}

function parseBrief(md, editionDate) {
  const withoutAudit = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutAudit.split(/\r?\n/);
  const sections = [];
  let currentSection = null;
  let currentArticle = null;

  function flushArticle() {
    if (currentArticle) {
      currentSection?.articles.push(currentArticle);
      currentArticle = null;
    }
  }

  function flushSection() {
    flushArticle();
    if (currentSection?.articles?.length) sections.push(currentSection);
    currentSection = null;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("<!--") || line.startsWith("THE BAY:")) continue;
    if (line.startsWith("Date:")) continue;

    const sectionMatch = line.match(/^(.+?)\s*\(\d+\):\s*$/);
    if (sectionMatch) {
      flushSection();
      currentSection = { name: sectionMatch[1], articles: [] };
      continue;
    }

    const articleMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/);
    if (articleMatch) {
      flushArticle();
      currentArticle = {
        rank: parseInt(articleMatch[1], 10),
        title: articleMatch[2],
        attribution: articleMatch[3] || null,
        urls: [],
        summary: "",
      };
      continue;
    }

    if (/^https?:\/\//i.test(line) || /^(Video|Background):\s*https?:\/\//i.test(line)) {
      if (!currentArticle) continue;
      const url = line.replace(/^(Video|Background):\s*/i, "").trim();
      currentArticle.urls.push({ url, prefix: /^Video:/i.test(line) ? "Video" : /^Background:/i.test(line) ? "Background" : null });
      continue;
    }

    if (currentArticle && line && !line.startsWith("http")) {
      currentArticle.summary += (currentArticle.summary ? " " : "") + line;
    }
  }
  flushSection();
  return { editionDate, sections };
}

function renderSourceLine(entry, editionDate) {
  const { url, prefix } = entry;
  const label = prefix ? `${prefix}: ${labelForUrl(url)}` : labelForUrl(url);
  const posted = postedDateFromUrl(url, editionDate);
  return (
    `      <span><span class="icon">📰</span> Source: ` +
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` +
    ` · Posted: ${escapeHtml(posted)}</span>`
  );
}

function renderBriefHtml({ editionDate, sections, articleCount }) {
  const parts = [
    `<!-- THE BAY Daily Brief → GBA Pulse Trending News panel`,
    `     Edition: ${editionDate} · ${articleCount} articles`,
    `     Generated by scripts/daily-brief-to-html.mjs -->`,
    "",
    `<div class="section-head" style="border-top:none;padding-top:8px">`,
    `  <div class="section-head-text">`,
    `    <h2>THE BAY: Daily Brief · ${editionDate}</h2>`,
    `  </div>`,
    `</div>`,
    "",
  ];

  let delay = 0.05;
  for (const section of sections) {
    parts.push(
      `<div class="section-head">`,
      `  <div class="section-head-text">`,
      `    <h2>${escapeHtml(section.name)}</h2>`,
      `  </div>`,
      `</div>`,
      "",
    );
    for (const art of section.articles) {
      const summary = renderSummary(art.summary);
      const sourceLines = art.urls.map((u) => renderSourceLine(u, editionDate)).join("\n");
      parts.push(
        `<div class="topic brief-article" style="animation-delay:${delay.toFixed(2)}s">`,
        `  <div class="topic-rank">${art.rank}</div>`,
        `  <div class="topic-body">`,
        `    <div class="topic-cat">${escapeHtml(section.name)}</div>`,
        `    <h2 class="topic-title">${escapeHtml(art.title)}</h2>`,
        `    <p class="topic-summary">${summary}</p>`,
        `    <div class="topic-meta">`,
        sourceLines,
        `    </div>`,
        `  </div>`,
        `</div>`,
        "",
      );
      delay += 0.05;
    }
  }
  return parts.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const md = fs.readFileSync(args.input, "utf8");
const dateMatch = md.match(/Date:\s*(\d{1,2}\s+\w+\s+\d{4})/);
const isoMatch = path.basename(args.input).match(/^(\d{4}-\d{2}-\d{2})/);
const editionDate = isoMatch?.[1] ?? "2026-06-03";
const countMatch = md.match(/·\s*(\d+)\s+articles/);
const articleCount = countMatch ? parseInt(countMatch[1], 10) : null;

const parsed = parseBrief(md, editionDate);
const html = renderBriefHtml({
  editionDate,
  sections: parsed.sections,
  articleCount: articleCount ?? parsed.sections.reduce((n, s) => n + s.articles.length, 0),
});

fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, html);
console.log(`Wrote ${args.output} (${parsed.sections.reduce((n, s) => n + s.articles.length, 0)} articles)`);

if (args.merge) {
  execFileSync(process.execPath, [path.join(__dirname, "merge-briefing-panels.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
}
