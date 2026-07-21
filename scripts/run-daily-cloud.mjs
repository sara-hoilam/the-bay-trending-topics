#!/usr/bin/env node
/**
 * Daily GBA Pulse — four cloud Composer 2.5 runs (Trend Watch, Daily Brief, Happenings, IG Leaderboard).
 *
 * Env:
 *   CURSOR_API_KEY — required
 *   GITHUB_TOKEN   — optional; passed to cloud agent for git push
 *
 * Usage:
 *   node scripts/run-daily-cloud.mjs
 *   node scripts/run-daily-cloud.mjs --run 1|2|3   # single step
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
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

const RUN_PROMPTS = {
  1: { file: "gba-pulse-cloud-run1-trendwatch.md", label: "Trend Watch" },
  2: { file: "gba-pulse-cloud-run2-daily-brief.md", label: "Daily Brief" },
  3: { file: "gba-pulse-cloud-run3-happenings.md", label: "Happenings" },
  4: { file: "gba-pulse-cloud-run4-ig-leaderboard.md", label: "IG Leaderboard" },
};

async function runStep(step, apiKey, { optional = false, retries = 0 } = {}) {
  const cfg = RUN_PROMPTS[step];
  if (!cfg) throw new Error(`Unknown run step: ${step}`);
  const prompt = readPrompt(cfg.file);
  const label = cfg.label;

  console.log(`\n=== Cloud Run ${step}: ${label}${optional ? " (optional)" : ""} ===`);
  console.log(`Repo: ${REPO_URL}`);
  console.log(`Model: ${MODEL_ID}\n`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const waitSec = 30;
      console.warn(`Cloud Run ${step} retry ${attempt}/${retries} in ${waitSec}s…`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }

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
        if (optional && attempt < retries) continue;
        if (optional) {
          console.warn(
            `Cloud Run ${step} skipped — post-pipeline will refresh IG via scripts/run-daily-post.mjs`
          );
          return false;
        }
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
      if (attempt < retries) continue;
      if (optional) {
        console.warn(
          `Cloud Run ${step} failed after ${retries + 1} attempt(s) — post-pipeline will refresh IG via capture-ig-leaderboard.mjs --refresh`
        );
        return false;
      }
      process.exit(2);
    }
    if (result.result) {
      const tail = result.result.slice(-500);
      console.log("\n--- Agent tail ---\n", tail);
    }
    return true;
  }
  return false;
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
  // Happenings: optional — Cursor sometimes returns status:error in ~5–10s while the
  // agent is still running (or after a transient abort). Do not retry (avoids a second
  // agent racing the first). Post-pipeline regenerates happenings-events.json via
  // generate-happenings-data.mjs either way.
  if (only === 3 || only == null) {
    await runStep(3, apiKey, { optional: true, retries: 0 });
  }
  if (only === 4 || only == null) {
    await runStep(4, apiKey, { optional: true, retries: 1 });
  }

  console.log("\nDone. Pull main and open index.html, or wait for GitHub Pages.");
}

main();
