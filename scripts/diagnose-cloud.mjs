#!/usr/bin/env node
/**
 * Preflight for daily cloud runs — auth, models, connected GitHub repos.
 *
 *   export CURSOR_API_KEY="cursor_..."
 *   node scripts/diagnose-cloud.mjs
 */
import { Cursor } from "@cursor/sdk";
import {
  logSdkError,
  normalizeRepoUrl,
  printIntegrationHelp,
  TARGET_REPO,
} from "./cloud-sdk-utils.mjs";

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing CURSOR_API_KEY");
  process.exit(1);
}

const opts = { apiKey };
const target = normalizeRepoUrl(TARGET_REPO);

async function section(title, fn) {
  console.log(`\n── ${title} ──`);
  try {
    await fn();
  } catch (err) {
    logSdkError(err, title);
    printIntegrationHelp(err);
    process.exit(1);
  }
}

await section("API key / account", async () => {
  const me = await Cursor.me(opts);
  console.log(`  user: ${me.userEmail ?? me.userId ?? "(unknown)"}`);
  if (me.createdAt) console.log(`  key created: ${me.createdAt}`);
});

await section("Models (composer-2.5)", async () => {
  const models = await Cursor.models.list(opts);
  const ids = models.map((m) => m.id ?? m.model?.id).filter(Boolean);
  const has = ids.some((id) => id === "composer-2.5");
  console.log(`  available: ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? "…" : ""}`);
  if (!has) {
    console.warn("  ⚠ composer-2.5 not listed — cloud run may fail; try model id from list above");
  } else {
    console.log("  ✓ composer-2.5");
  }
});

await section("Connected GitHub repos", async () => {
  const repos = await Cursor.repositories.list(opts);
  if (!repos.length) {
    console.error("  ✗ No repos returned — connect GitHub in Cursor dashboard");
    printIntegrationHelp();
    process.exit(1);
  }
  const normalized = repos.map((r) => normalizeRepoUrl(r.url));
  const match = normalized.includes(target);
  console.log(`  connected (${repos.length}):`);
  for (const r of repos.slice(0, 15)) {
    const mark = normalizeRepoUrl(r.url) === target ? " ← TARGET" : "";
    console.log(`    ${r.url}${mark}`);
  }
  if (repos.length > 15) console.log(`    … and ${repos.length - 15} more`);
  if (!match) {
    console.error(`\n  ✗ TARGET not connected: ${TARGET_REPO}`);
    console.error("    Open Cursor → Settings → GitHub → enable this repository.");
    printIntegrationHelp();
    process.exit(1);
  }
  console.log(`\n  ✓ Target repo is connected`);
});

console.log("\nPreflight OK. Run: npm run daily:cloud\n");
