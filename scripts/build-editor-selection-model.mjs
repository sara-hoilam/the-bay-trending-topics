#!/usr/bin/env node
/**
 * Roll up parsed editor comparisons → weights JSON + digest/latest.md
 *
 * Usage:
 *   node scripts/build-editor-selection-model.mjs
 *   node scripts/build-editor-selection-model.mjs --days=14
 */
import fs from "fs";
import path from "path";
import {
  ensureDirs,
  listParsedJson,
  paths,
  TAG_WEIGHTS,
  SELECTION_BONUSES,
  normalizeSelectionTag,
  tagWeight,
  hostFromUrl,
  normalizeHeadline,
  SECTION_NAMES,
} from "./editor-comparison-utils.mjs";

const DEFAULT_DAYS = 14;

function parseArgs() {
  let days = DEFAULT_DAYS;
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--days=(\d+)$/);
    if (m) days = parseInt(m[1], 10);
  }
  return { days };
}

function loadParsedWithinDays(days) {
  const files = listParsedJson();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const loaded = [];

  for (const f of files) {
    const full = path.join(paths.parsed, f);
    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    const edition = new Date(`${data.editionDate}T12:00:00Z`).getTime();
    if (edition >= cutoff) loaded.push(data);
  }
  return loaded.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
}

function inferStoryType(headline, section) {
  const h = headline.toLowerCase();
  if (/hzmb|bridge|transport|mtr|lrt|flight|rail|road|traffic|vehicle|southbound/.test(h)) return "transport";
  if (/rainstorm|weather|observatory|typhoon|flood|black rain/.test(h)) return "weather";
  if (/mbridge|remittance|digital currency|economy|trade|export|gdp|bank/.test(h)) return "economy";
  if (/legco|national security|police|ordinance|government|policy|bureau/.test(h)) return "policy";
  if (/dragon boat|sport|rugby|championship|race/.test(h)) return "sport";
  if (/macao|hengqin|gba|guangdong|shenzhen|guangzhou/.test(h) || section === "GBA News") return "gba_integration";
  if (section === "Macao") return "macao";
  if (section === "Hong Kong") return "hong_kong";
  return "society";
}

function keywordPatterns(headlines) {
  const counts = new Map();
  const stop = new Set(["hong", "kong", "macao", "china", "guangdong", "shenzhen", "after", "first", "said"]);
  for (const h of headlines) {
    for (const w of normalizeHeadline(h).toLowerCase().split(/\W+/)) {
      if (w.length < 4 || stop.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word, count]) => ({ word, count }));
}

function buildModel(parsedFiles, windowDays) {
  const allStories = parsedFiles.flatMap((p) =>
    (p.selectedStories ?? []).map((s) => ({ ...s, editionDate: p.editionDate })),
  );

  const sectionCounts = Object.fromEntries(SECTION_NAMES.map((s) => [s, 0]));
  const tagCounts = { selected: 0 };
  const domainCounts = new Map();
  const storyTypeCounts = new Map();
  const examples = [];

  for (const s of allStories) {
    if (s.section && sectionCounts[s.section] != null) sectionCounts[s.section]++;
    const tag = normalizeSelectionTag(s.selectionTag);
    if (tag === "selected") tagCounts.selected++;
    for (const u of s.urls ?? []) {
      const host = hostFromUrl(u);
      if (host) domainCounts.set(host, (domainCounts.get(host) ?? 0) + 1);
    }
    const st = inferStoryType(s.headline, s.section);
    storyTypeCounts.set(st, (storyTypeCounts.get(st) ?? 0) + 1);
    if (examples.length < 12) {
      examples.push({
        editionDate: s.editionDate,
        headline: s.headline,
        section: s.section,
        selectionTag: normalizeSelectionTag(s.selectionTag),
        weight: tagWeight(s.selectionTag),
      });
    }
  }

  const sectionFloors = {};
  for (const [name, count] of Object.entries(sectionCounts)) {
    if (count > 0) sectionFloors[name] = Math.max(1, Math.floor(count / Math.max(parsedFiles.length, 1)));
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    editionsIncluded: parsedFiles.map((p) => p.editionDate),
    totalSelectedStories: allStories.length,
    tagWeights: TAG_WEIGHTS,
    tagCounts,
    sectionCounts,
    sectionFloors,
    storyTypeCounts: Object.fromEntries(storyTypeCounts),
    urlDomainFrequency: Object.fromEntries(
      [...domainCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
    ),
    repeatHeadlinePatterns: keywordPatterns(allStories.map((s) => s.headline)),
    calibrationExamples: examples,
    selectionRules: {
      preferEditorTaggedPatterns: true,
      weightMultipliers: TAG_WEIGHTS,
      urlMatchBonus: SELECTION_BONUSES.urlMatch,
      headlineSimilarityBonus: SELECTION_BONUSES.headlineSimilarity,
      storyTypeBonus: SELECTION_BONUSES.storyType,
    },
  };
}

function buildDigest(model, parsedFiles) {
  const lines = [
    "# Editor selection calibration digest",
    "",
    `Generated: ${model.generatedAt}`,
    `Editions in window: ${model.editionsIncluded.length ? model.editionsIncluded.join(", ") : "none yet"}`,
    `Total editor-selected stories: ${model.totalSelectedStories}`,
    "",
    "## Weighting (apply at Step 3 — Cluster & rank)",
    "",
    "| Tag | Multiplier |",
    "|-----|------------|",
    `| [selected] | ${TAG_WEIGHTS.selected}× |`,
    "",
    "Legacy tags `[News selected]` and `[IG selected]` in older comparison docs count the same as `[selected]`.",
    "",
    `Additional bonuses: same URL in past editor picks (+${SELECTION_BONUSES.urlMatch}), similar headline (+${SELECTION_BONUSES.headlineSimilarity}), matching story-type pattern (+${SELECTION_BONUSES.storyType}).`,
    "",
    "## Section floors (observed editor picks)",
    "",
  ];

  if (Object.keys(model.sectionFloors).length) {
    for (const [sec, floor] of Object.entries(model.sectionFloors)) {
      if (model.sectionCounts[sec] > 0) lines.push(`- **${sec}**: at least ${floor} when material exists (${model.sectionCounts[sec]} historical picks)`);
    }
  } else {
    lines.push("- No parsed comparison data yet — use default section balance from training rules.");
  }

  lines.push("", "## Story types editors favor", "");
  const types = Object.entries(model.storyTypeCounts).sort((a, b) => b[1] - a[1]);
  if (types.length) {
    for (const [t, n] of types) lines.push(`- ${t.replace(/_/g, " ")}: ${n} picks`);
  } else {
    lines.push("- (pending comparison uploads)");
  }

  lines.push("", "## Top outlet domains in editor picks", "");
  const domains = Object.entries(model.urlDomainFrequency).slice(0, 10);
  if (domains.length) {
    for (const [d, n] of domains) lines.push(`- ${d}: ${n}`);
  } else {
    lines.push("- (no URLs in parsed selections yet)");
  }

  lines.push("", "## Keywords in selected headlines", "");
  for (const { word, count } of model.repeatHeadlinePatterns.slice(0, 15)) {
    lines.push(`- ${word} (${count}×)`);
  }

  lines.push("", "## Annotated examples (selection only — do not copy prose)", "");
  if (model.calibrationExamples.length) {
    for (const ex of model.calibrationExamples) {
      lines.push(
        `- **${ex.editionDate}** [selected] ${ex.section}: ${ex.headline}`,
      );
    }
  } else {
    lines.push("- Upload comparison docx to `Training Data/editor-comparisons/raw/` and run parse + build.");
  }

  lines.push(
    "",
    "## Rules for the agent",
    "",
    "1. Prefer stories that match editor-selected patterns above (topic, section, outlet).",
    "2. Apply the `[selected]` weight when a candidate resembles a past managing-editor pick.",
    "3. Do **not** imitate manual summary wording — mirror **what** editors select, not **how** they write.",
    "4. When in doubt between two corroborated stories, pick the one closer to historical editor picks.",
    "",
    `Source: Google Drive comparison folder — see Training Data/editor-comparisons/README.md`,
  );

  return lines.join("\n");
}

function main() {
  ensureDirs();
  const { days } = parseArgs();
  const parsedFiles = loadParsedWithinDays(days);
  const model = buildModel(parsedFiles, days);

  fs.writeFileSync(paths.weights, JSON.stringify(model, null, 2));
  const digest = buildDigest(model, parsedFiles);
  fs.writeFileSync(path.join(paths.digest, "latest.md"), digest);

  console.log(`Wrote ${paths.weights}`);
  console.log(`Wrote ${path.join(paths.digest, "latest.md")} (${parsedFiles.length} editions, ${model.totalSelectedStories} picks)`);
}

main();
