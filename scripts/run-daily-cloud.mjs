#!/usr/bin/env node
/**
 * Daily GBA Pulse — two cloud Composer 2.5 runs, then optional local verify/merge fallback.
 *
 * Env:
 *   CURSOR_API_KEY — required
 *   GITHUB_TOKEN   — optional; passed to cloud agent for git push
 *
 * Usage:
 *   node scripts/run-daily-cloud.mjs
 *   node scripts/run-daily-cloud.mjs --run 1|2   # single step
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Agent, Cursor, CursorAgentError } from "@cursor/sdk";
import {
  logSdkError,
  normalizeRepoUrl,
  printIntegrationHelp,
  TARGET_REPO,
} from "./cloud-sdk-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const REPO_URL = TARGET_REPO;
const MODEL_ID = "composer-2.5";

function readPrompt(name) {
  return fs.readFileSync(path.join(root, "prompts", name), "utf8");
}

function cloudOptions() {
  const opts = {
    repos: [{ url: REPO_URL, startingRef: "main" }],
    autoCreatePR: false,
    skipReviewerRequest: true,
  };
  if (process.env.GITHUB_TOKEN) {
    opts.envVars = { GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  }
  return opts;
}

async function preflight(apiKey) {
  const target = normalizeRepoUrl(REPO_URL);
  try {
    await Cursor.me({ apiKey });
    const repos = await Cursor.repositories.list({ apiKey });
    if (!repos.some((r) => normalizeRepoUrl(r.url) === target)) {
      console.error(`Preflight failed: ${REPO_URL} is not in your Cursor-connected repos.`);
      console.error("Connected repos:");
      for (const r of repos.slice(0, 10)) console.error(`  - ${r.url}`);
      printIntegrationHelp();
      process.exit(1);
    }
  } catch (err) {
    logSdkError(err, "Preflight failed");
    printIntegrationHelp();
    process.exit(1);
  }
}

async function runStep(step, apiKey) {
  const promptFile =
    step === 1 ? "gba-pulse-cloud-run1-trendwatch.md" : "gba-pulse-cloud-run2-edition.md";
  const prompt = readPrompt(promptFile);
  const label = step === 1 ? "Trend Watch" : "Trending News edition";

  console.log(`\n=== Cloud Run ${step}: ${label} ===`);
  console.log(`Repo: ${REPO_URL}`);
  console.log(`Model: ${MODEL_ID}\n`);

  const started = Date.now();
  let result;
  try {
    result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: MODEL_ID },
      cloud: cloudOptions(),
    });
  } catch (err) {
    if (err instanceof CursorAgentError) {
      logSdkError(err, `Cloud Run ${step} startup failed`);
      printIntegrationHelp();
      console.error("\nRun: npm run daily:diagnose");
      process.exit(1);
    }
    throw err;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`Status: ${result.status} (${elapsed}s)`);
  if (result.durationMs != null) {
    console.log(`Duration (SDK): ${(result.durationMs / 1000).toFixed(0)}s`);
  }
  if (result.git?.branches?.length) {
    for (const b of result.git.branches) {
      console.log(`Git: ${b.repoUrl} branch=${b.branch ?? "—"} pr=${b.prUrl ?? "direct push"}`);
    }
  }
  if (result.status === "error") {
    console.error("Run failed. Check Cursor dashboard for run id:", result.id);
    process.exit(2);
  }
  if (result.result) {
    const tail = result.result.slice(-500);
    console.log("\n--- Agent tail ---\n", tail);
  }
}

async function main() {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing CURSOR_API_KEY");
    process.exit(1);
  }

  let only = null;
  const eq = process.argv.find((a) => a.startsWith("--run="));
  if (eq) only = Number(eq.split("=")[1]);
  const idx = process.argv.indexOf("--run");
  if (idx !== -1 && process.argv[idx + 1]) only = Number(process.argv[idx + 1]);

  const skipPreflight = process.argv.includes("--skip-preflight");
  if (!skipPreflight) {
    console.log("Preflight: API key + connected repos…");
    await preflight(apiKey);
    console.log("Preflight OK.\n");
  }

  if (only === 1 || only == null) await runStep(1, apiKey);
  if (only === 2 || only == null) await runStep(2, apiKey);

  console.log("\nDone. Pull main and open index.html, or wait for GitHub Pages.");
}

main();
