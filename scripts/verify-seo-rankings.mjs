#!/usr/bin/env node
/** Sanity-checks seo-rankings-data.json before it is committed. Exit 1 on failure. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "seo-rankings-data.json");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "references", "seo-keywords.json"), "utf8"));
const errors = [];
const warn = [];
const fail = (m) => errors.push(m);

let d;
try {
  d = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error("✗ seo-rankings-data.json missing or invalid:", e.message);
  process.exit(1);
}

if (d.sample) warn.push("data is still flagged sample:true");
if (!/^\d{4}-\d{2}-\d{2}$/.test(d.gsc?.dataThrough || "")) fail("gsc.dataThrough missing");
const marketIds = (d.markets || []).map((m) => m.id);
for (const kw of cfg.keywords) {
  const k = (d.keywords || []).find((x) => x.keyword === kw.keyword);
  if (!k) { fail(`keyword missing: ${kw.keyword}`); continue; }
  for (const m of marketIds) {
    const mb = k.markets?.[m];
    if (!mb) { fail(`${kw.keyword}/${m}: market block missing`); continue; }
    const h = mb.history || [];
    for (let i = 1; i < h.length; i++) if (h[i].date <= h[i - 1].date) { fail(`${kw.keyword}/${m}: history not ascending at ${h[i].date}`); break; }
    for (const p of h) if (p.position != null && !(p.position >= 1 && p.position <= 200)) { fail(`${kw.keyword}/${m}: bad position ${p.position} on ${p.date}`); break; }
    for (const pg of mb.pages || []) if (!/^https?:\/\//.test(pg.url)) fail(`${kw.keyword}/${m}: bad page url ${pg.url}`);
    for (const c of mb.competitors?.list || []) {
      if (!/^https?:\/\//.test(c.url)) fail(`${kw.keyword}/${m}: bad competitor url ${c.url}`);
      if (!(c.position >= 1 && c.position <= 20)) fail(`${kw.keyword}/${m}: bad competitor rank ${c.position}`);
    }
    if (mb.competitors?.checkedAt) {
      const age = (Date.now() - Date.parse(mb.competitors.checkedAt)) / 86400000;
      if (age > 14) warn.push(`${kw.keyword}/${m}: competitor data is ${Math.round(age)} days old`);
    }
  }
}
warn.forEach((w) => console.warn("⚠", w));
if (errors.length) {
  errors.forEach((e) => console.error("✗", e));
  process.exit(1);
}
console.log(`✓ seo-rankings-data.json OK (${d.keywords.length} keywords × ${marketIds.length} markets, data to ${d.gsc.dataThrough})`);
