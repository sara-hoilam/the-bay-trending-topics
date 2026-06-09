#!/usr/bin/env node
/**
 * Compare AI daily brief vs editor-selected stories from comparison doc.
 *
 * Usage:
 *   node scripts/compare-daily-brief.mjs
 *   node scripts/compare-daily-brief.mjs --date=2026-06-09
 */
import fs from "fs";
import path from "path";
import { hktDateStr } from "./hkt-date.mjs";
import { briefPathForDate } from "./daily-brief-utils.mjs";
import {
  ensureDirs,
  paths,
  headlineSimilarity,
  extractUrls,
  normalizeHeadline,
} from "./editor-comparison-utils.mjs";

function parseArgs() {
  let date = hktDateStr();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--date=(\d{4}-\d{2}-\d{2})$/);
    if (m) date = m[1];
  }
  return { date };
}

function parseAiBrief(md) {
  const withoutAudit = md.replace(/<!--[\s\S]*?-->/g, "");
  const articles = [];
  let currentSection = null;
  let current = null;

  for (const raw of withoutAudit.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("THE BAY:") || line.startsWith("Date:")) continue;

    const sec = line.match(/^(.+?)\s*\(\d+\):\s*$/);
    if (sec) {
      currentSection = sec[1];
      continue;
    }

    const art = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);
    if (art) {
      if (current) articles.push(current);
      current = {
        rank: parseInt(art[1], 10),
        headline: art[2],
        section: currentSection,
        urls: [],
      };
      continue;
    }

    if (/^https?:\/\//i.test(line) && current) {
      current.urls.push(line.replace(/^(Video|Background):\s*/i, "").trim());
    }
  }
  if (current) articles.push(current);
  return articles;
}

function matchStory(editorStory, aiArticles) {
  for (const ai of aiArticles) {
    const sim = headlineSimilarity(editorStory.headline, ai.headline);
    if (sim >= 0.6) return { ai, matchType: "headline", score: sim };
    for (const eu of editorStory.urls ?? []) {
      for (const au of ai.urls ?? []) {
        if (eu === au || eu.replace(/\/$/, "") === au.replace(/\/$/, "")) {
          return { ai, matchType: "url", score: 1 };
        }
      }
    }
  }
  return null;
}

function main() {
  ensureDirs();
  const { date } = parseArgs();
  const briefPath = briefPathForDate(date);
  const parsedPath = path.join(paths.parsed, `${date}.json`);

  if (!fs.existsSync(briefPath)) {
    console.warn(`No AI brief: ${briefPath}`);
    return;
  }
  if (!fs.existsSync(parsedPath)) {
    console.warn(`No editor comparison for ${date} — skip report.`);
    return;
  }

  const aiArticles = parseAiBrief(fs.readFileSync(briefPath, "utf8"));
  const parsed = JSON.parse(fs.readFileSync(parsedPath, "utf8"));
  const editorPicks = parsed.selectedStories ?? [];

  const matched = [];
  const missed = [];
  const matchedAiRanks = new Set();

  for (const ed of editorPicks) {
    const m = matchStory(ed, aiArticles);
    if (m) {
      matched.push({ editor: ed, ai: m.ai, matchType: m.matchType, score: m.score });
      matchedAiRanks.add(m.ai.rank);
    } else {
      missed.push(ed);
    }
  }

  const aiOnly = aiArticles.filter((a) => !matchedAiRanks.has(a.rank));
  const recall = editorPicks.length ? matched.length / editorPicks.length : 0;
  const precision = aiArticles.length ? matched.length / aiArticles.length : 0;

  const lines = [
    `# Daily Brief comparison report — ${date}`,
    "",
    `AI articles: ${aiArticles.length} · Editor selected: ${editorPicks.length}`,
    `Overlap: ${matched.length} · Recall@editor: ${(recall * 100).toFixed(0)}% · Precision vs AI set: ${(precision * 100).toFixed(0)}%`,
    "",
    "## Matched stories",
    "",
  ];

  if (matched.length) {
    for (const m of matched) {
      lines.push(
        `- [${m.editor.selectionTag}] **${m.editor.headline}** ↔ AI #${m.ai.rank} (${m.matchType}, ${(m.score * 100).toFixed(0)}%)`,
      );
    }
  } else {
    lines.push("- None");
  }

  lines.push("", "## Editor picks missed by AI", "");
  if (missed.length) {
    for (const ed of missed) {
      lines.push(`- [${ed.selectionTag}] ${ed.section}: ${ed.headline}`);
      for (const u of ed.urls ?? []) lines.push(`  - ${u}`);
    }
  } else {
    lines.push("- None");
  }

  lines.push("", "## AI-only stories (not editor-tagged)", "");
  if (aiOnly.length) {
    for (const a of aiOnly.slice(0, 15)) {
      lines.push(`- #${a.rank} ${a.section}: ${a.headline}`);
    }
    if (aiOnly.length > 15) lines.push(`- … and ${aiOnly.length - 15} more`);
  } else {
    lines.push("- None");
  }

  const outPath = path.join(paths.reports, `${date}.md`);
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`Wrote ${outPath} (recall ${(recall * 100).toFixed(0)}%)`);
}

main();
