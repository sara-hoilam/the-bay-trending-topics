#!/usr/bin/env node
/**
 * Upsert today's IG leaderboard snapshot into Google Sheets.
 * followers_growth_pct_7d is computed from sheet history (today vs 7 calendar days ago).
 *
 * Env:
 *   GOOGLE_SHEETS_IG_LEADERBOARD_ID  — spreadsheet ID from the sheet URL
 *   GOOGLE_SHEETS_IG_TAB             — tab name (default: Daily_Datalog)
 *   GOOGLE_SHEETS_CREDENTIALS        — service account JSON (preferred)
 *   GOOGLE_DRIVE_CREDENTIALS         — fallback if Sheets creds unset
 *
 * Usage:
 *   node scripts/sync-ig-leaderboard-sheet.mjs
 *   node scripts/sync-ig-leaderboard-sheet.mjs --dry-run
 */
import {
  growthPctFromSheetRows,
  loadLeaderboardData,
  parseFollowerCount,
  writeLeaderboardData,
} from "./ig-leaderboard-utils.mjs";
import { hktAddDays } from "./hkt-date.mjs";

const HEADERS = [
  "date",
  "handle",
  "display_name",
  "followers",
  "followers_growth_pct_7d",
  "captured_at",
];

const dryRun = process.argv.includes("--dry-run");

function getCredentialsJson() {
  return (
    process.env.GOOGLE_SHEETS_CREDENTIALS?.trim() ||
    process.env.GOOGLE_DRIVE_CREDENTIALS?.trim() ||
    ""
  );
}

async function loadGoogleApis() {
  try {
    const mod = await import("googleapis");
    return mod.google;
  } catch {
    console.error(
      "googleapis package not installed. Run: npm install googleapis --no-save"
    );
    return null;
  }
}

function quoteTabName(tab) {
  return `'${String(tab).replace(/'/g, "''")}'`;
}

function parseSheetRows(values) {
  if (!values?.length) return [];
  const [header, ...rows] = values;
  const isHeader = header?.[0] === HEADERS[0];
  const dataRows = isHeader ? rows : values;
  const parsed = [];
  for (const row of dataRows) {
    const date = row?.[0];
    const handle = row?.[1];
    const followers = parseFollowerCount(row?.[3]);
    if (!date || !handle || followers == null) continue;
    parsed.push({ date: String(date), handle: String(handle), followers });
  }
  return parsed;
}

function rowsFromData(data) {
  const today = data.updatedAt;
  const capturedAt = data.refreshedAt ?? "";
  return (data.accounts || []).map((row) => [
    today,
    row.handle ?? "",
    row.displayName ?? "",
    row.followers ?? "",
    row.followersGrowthPct7d ?? "",
    capturedAt,
  ]);
}

async function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_IG_LEADERBOARD_ID?.trim();
  const tabName = process.env.GOOGLE_SHEETS_IG_TAB?.trim() || "Daily_Datalog";
  const credsJson = getCredentialsJson();

  if (!spreadsheetId) {
    console.log("GOOGLE_SHEETS_IG_LEADERBOARD_ID not set — skipping sheet sync.");
    return null;
  }
  if (!credsJson) {
    console.log(
      "GOOGLE_SHEETS_CREDENTIALS / GOOGLE_DRIVE_CREDENTIALS not set — skipping sheet sync."
    );
    return null;
  }

  let credentials;
  try {
    credentials = JSON.parse(credsJson);
  } catch {
    console.error("Google credentials env var is not valid JSON");
    return null;
  }

  const google = await loadGoogleApis();
  if (!google) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, spreadsheetId, tabName };
}

async function readSheetRows(sheets, spreadsheetId, tabName) {
  const range = `${quoteTabName(tabName)}!A:F`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return parseSheetRows(res.data.values ?? []);
}

async function ensureHeader(sheets, spreadsheetId, tabName) {
  const range = `${quoteTabName(tabName)}!A1:F1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const firstRow = res.data.values?.[0] ?? [];
  const hasHeader = firstRow[0] === HEADERS[0] && firstRow[5] === HEADERS[5];
  if (hasHeader) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
  console.log(`Wrote header row to ${tabName}`);
}

async function findTodayRowIndexes(sheets, spreadsheetId, tabName, today) {
  const range = `${quoteTabName(tabName)}!A:A`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = res.data.values ?? [];
  const indexes = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i]?.[0] === today) indexes.push(i);
  }
  return indexes;
}

async function deleteRows(sheets, spreadsheetId, tabName, rowIndexes) {
  if (!rowIndexes.length) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`Tab not found: ${tabName}`);
  }

  const requests = [...rowIndexes]
    .sort((a, b) => b - a)
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex,
          endIndex: rowIndex + 1,
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

async function appendRows(sheets, spreadsheetId, tabName, rows) {
  const range = `${quoteTabName(tabName)}!A:F`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

function applyGrowthFromSheet(data, sheetRows) {
  const today = data.updatedAt;
  const refDate = hktAddDays(today, -7);
  let withGrowth = 0;

  for (const account of data.accounts || []) {
    const growth = growthPctFromSheetRows(
      sheetRows,
      account.handle,
      today,
      account.followers
    );
    account.followersGrowthPct7d = growth;
    if (growth != null) withGrowth++;
  }

  console.log(
    `7d growth from sheet: ${withGrowth}/${data.accounts?.length ?? 0} accounts (ref date ${refDate})`
  );
  return data;
}

async function main() {
  const data = loadLeaderboardData();
  if (!data?.updatedAt || !data.accounts?.length) {
    console.error("No ig-leaderboard-data.json to sync");
    process.exit(1);
  }

  const client = await getSheetsClient();
  if (!client) return 0;

  const { sheets, spreadsheetId, tabName } = client;
  const today = data.updatedAt;

  await ensureHeader(sheets, spreadsheetId, tabName);
  const sheetRows = await readSheetRows(sheets, spreadsheetId, tabName);
  applyGrowthFromSheet(data, sheetRows);

  const rows = rowsFromData(data);

  if (dryRun) {
    console.log(
      `Dry run: would replace ${today} in ${tabName} with ${rows.length} row(s)`
    );
    rows.forEach((row) => console.log(row.join("\t")));
    return 0;
  }

  writeLeaderboardData(data);

  const existing = await findTodayRowIndexes(sheets, spreadsheetId, tabName, today);
  if (existing.length) {
    await deleteRows(sheets, spreadsheetId, tabName, existing);
    console.log(`Deleted ${existing.length} existing row(s) for ${today}`);
  }
  await appendRows(sheets, spreadsheetId, tabName, rows);
  console.log(
    `Appended ${rows.length} row(s) to ${tabName} for ${today} (sheet ${spreadsheetId})`
  );
  return 0;
}

main().catch((err) => {
  console.error("Sheet sync failed:", err.message || err);
  process.exit(1);
});
