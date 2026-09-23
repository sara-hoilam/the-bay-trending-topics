import test from "node:test";
import assert from "node:assert/strict";
import { igCaptureArgsFromSnapshot } from "./ig-leaderboard-utils.mjs";

test("reuses same-day snapshot with live handles", () => {
  const decision = igCaptureArgsFromSnapshot(
    {
      capturedAt: "2026-09-23",
      accounts: { scmpnews: { followers: 700000 }, thebayasia: { followers: 49000 } },
    },
    "2026-09-23",
    "orchestration/ig-leaderboard-snapshot.json"
  );
  assert.equal(decision.reuse, true);
  assert.equal(decision.liveCount, 2);
  assert.deepEqual(decision.args, [
    "--snapshot=orchestration/ig-leaderboard-snapshot.json",
  ]);
});

test("refreshes when snapshot is from a previous day", () => {
  const decision = igCaptureArgsFromSnapshot(
    { capturedAt: "2026-09-22", accounts: { scmpnews: { followers: 700000 } } },
    "2026-09-23"
  );
  assert.equal(decision.reuse, false);
  assert.deepEqual(decision.args, ["--refresh"]);
});

test("refreshes when snapshot has no live handles", () => {
  const decision = igCaptureArgsFromSnapshot(
    { capturedAt: "2026-09-23", accounts: {} },
    "2026-09-23"
  );
  assert.equal(decision.reuse, false);
  assert.deepEqual(decision.args, ["--refresh"]);
});
