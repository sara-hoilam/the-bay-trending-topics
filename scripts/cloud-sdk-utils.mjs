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

export function printIntegrationHelp() {
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
`);
}
