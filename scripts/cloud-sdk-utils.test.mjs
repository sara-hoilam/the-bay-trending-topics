import test from "node:test";
import assert from "node:assert/strict";
import {
  isRateLimitError,
  isTransientCloudStartupError,
} from "./cloud-sdk-errors.mjs";

test("isRateLimitError matches 429 / resource_exhausted only", () => {
  assert.equal(isRateLimitError({ status: 429 }), true);
  assert.equal(isRateLimitError({ code: "resource_exhausted" }), true);
  assert.equal(isRateLimitError({ name: "RateLimitError" }), true);
  assert.equal(isRateLimitError({ name: "NetworkError", message: "Network request failed" }), false);
});

test("isTransientCloudStartupError retries SDK NetworkError / fetch failed", () => {
  const networkErr = {
    name: "NetworkError",
    message: "Network request failed",
    isRetryable: true,
    operation: "agent.send",
    endpoint: "POST /v1/agents",
    cause: { message: "fetch failed" },
  };
  assert.equal(isTransientCloudStartupError(networkErr), true);
  assert.equal(isRateLimitError(networkErr), false);
});

test("isTransientCloudStartupError honors isRetryable even without NetworkError name", () => {
  assert.equal(isTransientCloudStartupError({ isRetryable: true, message: "timeout" }), true);
  assert.equal(isTransientCloudStartupError({ isRetryable: false, message: "bad key" }), false);
});

test("isTransientCloudStartupError includes rate limits", () => {
  assert.equal(isTransientCloudStartupError({ status: 429 }), true);
});
