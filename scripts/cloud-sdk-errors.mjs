/**
 * Classify Cursor SDK / Agent.prompt() startup failures without importing @cursor/sdk
 * so tests can run in environments that skip optionalDependencies.
 */

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

/**
 * Transient Agent.prompt() failures that should be retried.
 * Includes 429s and SDK NetworkError / fetch failed on POST /v1/agents.
 */
export function isTransientCloudStartupError(err) {
  if (!err) return false;
  if (isRateLimitError(err)) return true;
  if (err.isRetryable === true) return true;
  const name = String(err.name ?? "");
  const blob = `${err.message ?? ""} ${err.cause?.message ?? ""} ${err.cause?.code ?? ""}`;
  return (
    name === "NetworkError" ||
    /network request failed|fetch failed|econnreset|etimedout|econnrefused|socket hang up|undici/i.test(
      blob,
    )
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

export function printNetworkHelp() {
  console.error(`
This is a transient network failure talking to Cursor (POST /v1/agents) —
not an expired API key, and not a missing GitHub connection.

Typical shape:
  name: NetworkError
  message: Network request failed
  operation: agent.send
  retryable: true
  cause.message: fetch failed

Preflight and an earlier cloud run can succeed, then the next Agent.prompt()
fails if GitHub Actions loses the HTTPS connection for a moment.

The daily runner retries this a few times. If it still fails:
  1. Re-run the workflow (Actions → Daily GBA Pulse → Run workflow)
  2. Or run a single step: node scripts/run-daily-cloud.mjs --run=2
`);
}

export function printIntegrationHelp(err) {
  if (isRateLimitError(err)) {
    printRateLimitHelp();
    return;
  }
  if (isTransientCloudStartupError(err)) {
    printNetworkHelp();
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
