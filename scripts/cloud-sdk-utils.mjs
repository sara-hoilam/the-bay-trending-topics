import {
  CursorAgentError,
  IntegrationNotConnectedError,
} from "@cursor/sdk";

export const TARGET_REPO =
  "https://github.com/sara-hoilam/the-bay-trending-topics";

export function normalizeRepoUrl(url) {
  return String(url)
    .trim()
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function logSdkError(err, label = "SDK error") {
  console.error(`\n${label}:`);
  if (err instanceof CursorAgentError) {
    console.error(`  message: ${err.message}`);
    if (err.code) console.error(`  code: ${err.code}`);
    if (err.status != null) console.error(`  status: ${err.status}`);
    if (err.operation) console.error(`  operation: ${err.operation}`);
    if (err.endpoint) console.error(`  endpoint: ${err.endpoint}`);
    if (err.requestId) console.error(`  requestId: ${err.requestId}`);
    console.error(`  retryable: ${err.isRetryable}`);
    if (typeof err.toJSON === "function") {
      console.error("  details:", JSON.stringify(err.toJSON(), null, 2));
    }
    if (err instanceof IntegrationNotConnectedError) {
      console.error(`  provider: ${err.provider}`);
      console.error(`  fix: connect SCM at ${err.helpUrl}`);
    }
  } else {
    console.error(`  ${err?.message ?? err}`);
  }
  if (err?.cause) {
    const c = err.cause;
    if (c && typeof c === "object" && "message" in c) {
      console.error(`  cause.message: ${c.message}`);
      if (c.code) console.error(`  cause.code: ${c.code}`);
      if (c.rawMessage) console.error(`  cause.rawMessage: ${c.rawMessage}`);
    } else {
      console.error(`  cause:`, c);
    }
  }
}

export function isRateLimitError(err) {
  if (!err) return false;
  const code = String(err.code ?? "").toLowerCase();
  const name = String(err.name ?? "");
  const status = err.status;
  return (
    status === 429 ||
    code === "resource_exhausted" ||
    name === "RateLimitError" ||
    /resource_exhausted|rate.?limit/i.test(String(err.message ?? ""))
  );
}

export function printRateLimitHelp() {
  console.error(`
This is a Cursor rate / quota limit (HTTP 429 resource_exhausted) — not an
invalid API key, and not a missing GitHub connection (preflight already passed).

Check:
  1. https://cursor.com/dashboard → Usage
     - "Cursor Models" (Composer/Grok) may still show headroom while cloud
       agent creation is blocked by another limit (on-demand spend, Other
       Models pool, or short-window rate limit on POST /v1/agents).
  2. If "Other Models" is at 100% and on-demand spend is off/capped, enable
     or raise on-demand spend, or wait for the billing period to reset.
  3. Avoid launching extra cloud agents while the daily job runs.
  4. Re-run: gh workflow run daily-gba-pulse.yml
`);
}

export function printIntegrationHelp(err) {
  if (isRateLimitError(err)) {
    printRateLimitHelp();
    return;
  }
  console.error(`
Most cloud startup failures are one of:

  1. GitHub not linked in Cursor (IntegrationNotConnected)
     → https://cursor.com/dashboard → connect GitHub
     → grant access to sara-hoilam/the-bay-trending-topics

  2. Invalid or expired CURSOR_API_KEY
     → https://cursor.com/dashboard/integrations → create User API key
     → paste with no extra spaces/newlines

  3. Repo URL not in your connected-repo list
     → run: npm run daily:diagnose

  4. Cloud agents disabled on your plan / team
     → check Cursor dashboard → Cloud agents

  5. Rate / quota limit (HTTP 429 resource_exhausted)
     → https://cursor.com/dashboard → Usage (Cursor Models vs Other Models /
       on-demand spend). Preflight can still pass when agent create is blocked.
`);
}
