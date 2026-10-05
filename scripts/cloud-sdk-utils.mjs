import {
  CursorAgentError,
  IntegrationNotConnectedError,
} from "@cursor/sdk";
export {
  isRateLimitError,
  isTransientCloudStartupError,
  printIntegrationHelp,
  printNetworkHelp,
  printRateLimitHelp,
} from "./cloud-sdk-errors.mjs";

export const TARGET_REPO =
  "https://github.com/sara-hoilam/the-bay-trending-topics";

/**
 * Preferred cloud models from the Cursor Models pool (Grok / Composer).
 * Avoid Claude/GPT "Other Models" so a drained Other Models quota cannot block
 * the daily job. Prefer latest Grok, then older Grok, then Composer.
 *
 * Override with env CURSOR_CLOUD_MODEL (exact model id).
 */
export const CURSOR_MODELS_POOL_PREFERENCE = [
  "grok-4.6",
  "grok-4.5",
  "composer-2.5",
];

export const DEFAULT_CLOUD_MODEL_ID = CURSOR_MODELS_POOL_PREFERENCE[0];

export function requestedCloudModelId() {
  const fromEnv = process.env.CURSOR_CLOUD_MODEL?.trim();
  return fromEnv || DEFAULT_CLOUD_MODEL_ID;
}

export function listModelIds(models) {
  return (models ?? []).map((m) => m.id ?? m.model?.id).filter(Boolean);
}

/**
 * Pick a Cursor Models–pool id. If CURSOR_CLOUD_MODEL is set, use it when listed
 * (or keep it with a warning). Otherwise walk the preference list.
 */
export function resolveCloudModelId(availableIds, preferred = requestedCloudModelId()) {
  const ids = availableIds ?? [];
  const set = new Set(ids);
  if (preferred && set.has(preferred)) {
    return { modelId: preferred, source: preferred === process.env.CURSOR_CLOUD_MODEL?.trim() ? "env" : "default", available: ids };
  }
  for (const id of CURSOR_MODELS_POOL_PREFERENCE) {
    if (set.has(id)) {
      return {
        modelId: id,
        source: preferred && preferred !== id ? `fallback (wanted ${preferred})` : "preference",
        available: ids,
      };
    }
  }
  if (preferred) {
    return { modelId: preferred, source: "forced-unlisted", available: ids };
  }
  return { modelId: DEFAULT_CLOUD_MODEL_ID, source: "default-unlisted", available: ids };
}

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

