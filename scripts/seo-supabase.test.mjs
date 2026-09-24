import test from "node:test";
import assert from "node:assert/strict";
import { buildSupabasePayload, writeSupabasePayload } from "./seo-supabase.mjs";

const capturedAt = "2026-09-23T01:00:00.000Z";

function fixture() {
  return buildSupabasePayload({
    capturedAt,
    rankDaily: [
      { date: "2026-09-20", keyword: "gba", market: "hkg", position: 18.2, impressions: 10, clicks: 1, ctr: 0.1 },
    ],
    pageDaily: [
      {
        date: "2026-09-20",
        keyword: "gba",
        market: "hkg",
        page_url: "https://thebay.mo/gba",
        position: 8.5,
        impressions: 10,
        clicks: 1,
        page_title: "GBA",
      },
    ],
    keywords: [
      {
        keyword: "gba",
        markets: {
          hkg: {
            competitors: {
              checkedAt: "2026-09-22",
              method: "web_search_estimate",
              list: [
                { position: 2, url: "https://example.com/a", domain: "example.com", title: "A", type: "other", note: "", verified: true, httpStatus: 200 },
                { position: 2, url: "https://example.com/dup", domain: "example.com", title: "Dup", type: "other", note: "", verified: true, httpStatus: 200 },
              ],
            },
          },
        },
      },
    ],
  });
}

test("payload matches primary keys and drops a duplicate competitor position", () => {
  const payload = fixture();
  assert.equal(payload.seo_rank_daily.length, 1);
  assert.equal(payload.seo_rank_daily[0].captured_at, capturedAt);
  assert.equal(payload.seo_page_rank_daily[0].page_url, "https://thebay.mo/gba");
  assert.equal(payload.seo_competitor_snapshots.length, 1);
  assert.equal(payload.seo_competitor_snapshots[0].http_status, 200);
  assert.equal(payload.seo_competitor_snapshots[0].method, "web_search_estimate");
});

test("upserts each table on its primary key", async () => {
  const payload = fixture();
  const calls = [];
  const client = {
    from(table) {
      return {
        upsert(rows, options) {
          calls.push({ table, rows, onConflict: options.onConflict });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await writeSupabasePayload(payload, client);
  assert.deepEqual(
    calls.map((c) => [c.table, c.onConflict, c.rows.length]),
    [
      ["seo_rank_daily", "date,keyword,market", 1],
      ["seo_page_rank_daily", "date,keyword,market,page_url", 1],
      ["seo_competitor_snapshots", "checked_on,keyword,market,position", 1],
    ]
  );
});

test("a Supabase error is surfaced and does not include the service key", async () => {
  const client = {
    from() {
      return {
        upsert() {
          return Promise.resolve({ error: { message: "relation does not exist" } });
        },
      };
    },
  };
  await assert.rejects(
    () => writeSupabasePayload(fixture(), client),
    (err) => {
      assert.match(err.message, /seo_rank_daily: relation does not exist/);
      assert.equal(err.message.includes("service_role"), false);
      return true;
    }
  );
});
