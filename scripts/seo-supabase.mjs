/**
 * Optional Supabase history for SEO ranks.
 * The site keeps reading seo-rankings-data.json. This writer is server-side only.
 *
 * Env:
 *   SUPABASE_URL                  — project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service-role key (never sent to the browser)
 *
 * Upsert syntax follows @supabase/supabase-js v2:
 *   client.from(table).upsert(rows, { onConflict })
 * https://supabase.com/docs/reference/javascript/upsert
 */
const TABLES = [
  ["seo_rank_daily", "date,keyword,market"],
  ["seo_page_rank_daily", "date,keyword,market,page_url"],
  ["seo_competitor_snapshots", "checked_on,keyword,market,position"],
];

const CHUNK = 500;

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) return null;
  return { url, key };
}

export async function createSupabaseWriter() {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    throw new Error("@supabase/supabase-js is not installed. Run: npm install @supabase/supabase-js --no-save");
  }
  return createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Rows that match the migration primary keys. captured_at is refreshed on every upsert. */
export function buildSupabasePayload({ keywords, rankDaily, pageDaily, capturedAt }) {
  const captured_at = capturedAt;
  const seo_rank_daily = (rankDaily || []).map((row) => ({ ...row, captured_at }));
  const seo_page_rank_daily = (pageDaily || []).map((row) => ({ ...row, captured_at }));
  const seo_competitor_snapshots = [];
  const seen = new Set();

  for (const kw of keywords || []) {
    for (const [market, block] of Object.entries(kw.markets || {})) {
      const comp = block?.competitors;
      if (!comp?.checkedAt || !Array.isArray(comp.list)) continue;
      for (const item of comp.list) {
        const position = parseInt(item.position, 10);
        if (!Number.isFinite(position)) continue;
        const key = `${comp.checkedAt}|${kw.keyword}|${market}|${position}`;
        if (seen.has(key)) continue;
        seen.add(key);
        seo_competitor_snapshots.push({
          checked_on: comp.checkedAt,
          keyword: kw.keyword,
          market,
          position,
          url: item.url,
          domain: item.domain ?? null,
          title: item.title ?? null,
          type: item.type ?? null,
          note: item.note ?? "",
          method: comp.method ?? null,
          verified: item.verified ?? null,
          http_status: item.httpStatus ?? null,
        });
      }
    }
  }

  return { seo_rank_daily, seo_page_rank_daily, seo_competitor_snapshots };
}

export function summarisePayload(payload) {
  const lines = [];
  for (const [table] of TABLES) {
    const rows = payload[table] || [];
    lines.push(`${table}: ${rows.length} row(s) would be upserted`);
    for (const row of rows.slice(0, 5)) lines.push(JSON.stringify(row));
    if (rows.length > 5) lines.push(`… ${rows.length - 5} more`);
  }
  return lines.join("\n");
}

export async function writeSupabasePayload(payload, client) {
  for (const [table, onConflict] of TABLES) {
    const rows = payload[table] || [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      if (!slice.length) continue;
      const { error } = await client.from(table).upsert(slice, { onConflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
}
