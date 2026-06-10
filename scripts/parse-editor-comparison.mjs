#!/usr/bin/env node
/**
 * Parse editor comparison .docx → Training Data/editor-comparisons/parsed/YYYY-MM-DD.json
 *
 * Usage:
 *   node scripts/parse-editor-comparison.mjs
 *   node scripts/parse-editor-comparison.mjs --file="Training Data/editor-comparisons/raw/2026-06-09-comparison.docx"
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import {
  ensureDirs,
  extractDateFromFilename,
  listRawDocx,
  paths,
  parseSelectionTag,
  tagWeight,
  normalizeHeadline,
  detectSection,
  detectSourceSide,
  extractUrls,
  SELECTION_TAG_RE,
  RED_COLOR_VALUES,
} from "./editor-comparison-utils.mjs";

function parseArgs() {
  const out = { file: null, force: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--force") out.force = true;
    const m = a.match(/^--file=(.+)$/);
    if (m) out.file = path.resolve(m[1]);
  }
  return out;
}

function isRedRun(rPrXml) {
  if (!rPrXml) return false;
  const color = rPrXml.match(/<w:color[^>]*w:val="([^"]+)"/i);
  if (color && RED_COLOR_VALUES.has(color[1].toUpperCase())) return true;
  const highlight = rPrXml.match(/<w:highlight[^>]*w:val="([^"]+)"/i);
  if (highlight && /red/i.test(highlight[1])) return true;
  return false;
}

function decodeXmlText(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractParagraphs(documentXml) {
  const paragraphs = [];
  const pBlocks = documentXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/gi) ?? [];

  for (const pXml of pBlocks) {
    const runs = [];
    const rBlocks = pXml.match(/<w:r[\s>][\s\S]*?<\/w:r>/gi) ?? [];
    for (const rXml of rBlocks) {
      const rPr = rXml.match(/<w:rPr[\s\S]*?<\/w:rPr>/i)?.[0] ?? "";
      const texts = [...rXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)].map((m) =>
        decodeXmlText(m[1]),
      );
      const text = texts.join("");
      if (!text) continue;
      runs.push({ text, isRed: isRedRun(rPr) });
    }

    if (!runs.length) {
      const plain = [...pXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)]
        .map((m) => decodeXmlText(m[1]))
        .join("");
      if (plain.trim()) paragraphs.push({ text: plain, hasRed: false, hasTag: false, tag: null });
      continue;
    }

    const text = runs.map((r) => r.text).join("");
    const hasRed = runs.some((r) => r.isRed);
    const tag = parseSelectionTag(text);
    const redTag =
      runs.some((r) => r.isRed && parseSelectionTag(r.text)) ||
      runs.some((r) => r.isRed && /selected/i.test(r.text));
    paragraphs.push({
      text,
      hasRed: hasRed || redTag,
      hasTag: Boolean(tag),
      tag,
    });
  }

  return paragraphs;
}

function isHeadlineLine(text) {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return false;
  if (SELECTION_TAG_RE.test(t) && t.length < 80) return false;
  if (/^\d+\.\s+\S/.test(t)) return true;
  if (t.length >= 20 && t.length <= 200 && !t.includes("http") && /^[A-Z]/.test(t)) return true;
  return false;
}

function makeBlock(section, sourceSide, headline, urls = []) {
  return {
    section,
    sourceSide,
    headline,
    urls: [...urls],
    selectionTag: null,
    selected: false,
    weight: 0,
  };
}

function applySelection(block, tag) {
  if (!block || !tag) return;
  block.selectionTag = tag;
  block.selected = true;
  block.weight = tagWeight(tag);
}

function buildStoriesFromParagraphs(paragraphs) {
  let currentSection = null;
  let currentSide = "unknown";
  let current = null;
  const allBlocks = [];

  function flushCurrent() {
    if (!current?.headline && !current?.urls?.length) {
      current = null;
      return;
    }
    allBlocks.push(current);
    current = null;
  }

  function ensureCurrent() {
    if (!current) current = makeBlock(currentSection, currentSide, null);
    current.section = currentSection;
    current.sourceSide = currentSide;
    return current;
  }

  for (const para of paragraphs) {
    const text = para.text.trim();
    if (!text) continue;

    const tag = para.tag ?? (para.hasRed ? parseSelectionTag(text) : null);
    const isMarker =
      Boolean(tag) ||
      para.hasTag ||
      (para.hasRed && /selected/i.test(text)) ||
      SELECTION_TAG_RE.test(text);

    if (isMarker && tag) {
      const target = current?.headline ? current : allBlocks.at(-1) ?? null;
      if (target?.headline) {
        applySelection(target, tag);
        if (current && current === target) flushCurrent();
      } else {
        const headline = normalizeHeadline(text);
        if (headline.length > 5) {
          allBlocks.push({
            ...makeBlock(currentSection, currentSide, headline, extractUrls(text)),
            selectionTag: tag,
            selected: true,
            weight: tagWeight(tag),
          });
        }
      }
      continue;
    }

    const side = detectSourceSide(text);
    if (side && text.length < 120) {
      flushCurrent();
      currentSide = side;
      continue;
    }

    const section = detectSection(text);
    if (section) {
      flushCurrent();
      currentSection = section;
      continue;
    }

    const urls = extractUrls(text);
    if (urls.length) {
      const block = ensureCurrent();
      block.urls.push(...urls);
      continue;
    }

    if (isHeadlineLine(text)) {
      flushCurrent();
      current = makeBlock(currentSection, currentSide, normalizeHeadline(text));
      continue;
    }

    if (para.hasRed && !isMarker) {
      const headline = normalizeHeadline(text);
      if (headline.length > 10) {
        flushCurrent();
        allBlocks.push({
          ...makeBlock(currentSection, currentSide, headline),
          selectionTag: "selected",
          selected: true,
          weight: tagWeight("selected"),
        });
      }
    }
  }
  flushCurrent();

  return allBlocks.filter((b) => b.selected && b.headline);
}

async function parseDocx(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error(`No word/document.xml in ${path.basename(filePath)}`);

  const paragraphs = extractParagraphs(docXml);
  const selectedStories = buildStoriesFromParagraphs(paragraphs);

  const stats = { selectedCount: 0, totalSelected: 0 };
  for (const s of selectedStories) {
    stats.totalSelected++;
    if (s.selectionTag === "selected") stats.selectedCount++;
  }

  const editionDate = extractDateFromFilename(path.basename(filePath));
  if (!editionDate) throw new Error(`Cannot extract YYYY-MM-DD from filename: ${path.basename(filePath)}`);

  return {
    editionDate,
    sourceFile: path.basename(filePath),
    parsedAt: new Date().toISOString(),
    selectedStories,
    stats,
    paragraphCount: paragraphs.length,
  };
}

async function main() {
  ensureDirs();
  const args = parseArgs();
  const files = args.file ? [args.file] : listRawDocx().map((f) => path.join(paths.raw, f));

  if (!files.length) {
    console.log("No .docx files in Training Data/editor-comparisons/raw/ — skipping parse.");
    return;
  }

  let written = 0;
  for (const filePath of files) {
    const outPath = path.join(paths.parsed, `${extractDateFromFilename(path.basename(filePath))}.json`);
    if (!args.force && fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
      const srcMtime = fs.statSync(filePath).mtimeMs;
      const parsedAt = new Date(existing.parsedAt).getTime();
      if (parsedAt >= srcMtime) {
        console.log(`Skip (up to date): ${path.basename(filePath)}`);
        continue;
      }
    }

    try {
      const result = await parseDocx(filePath);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(
        `Wrote ${outPath} (${result.stats.totalSelected} selected stories from ${result.paragraphCount} paragraphs)`,
      );
      written++;
    } catch (err) {
      console.error(`Failed ${path.basename(filePath)}: ${err.message}`);
    }
  }

  if (!written) console.log("No comparison files parsed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
