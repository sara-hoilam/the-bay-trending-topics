#!/usr/bin/env node
/**
 * Upsert today's IG leaderboard snapshot into Google Sheets.
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
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadLeaderboardData } from "./ig-leaderboard-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const HEADERS = [
  "date",
  "handle",
  "display_name",
  "followers",
  "followers_growth_pct_7d",
  "posts_7d",
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

function rowsFromData(data) {
  const today = data.updatedAt;
  const capturedAt = data.refreshedAt ?? "";
  return (data.accounts || []).map((row) => [
    today,
    row.handle ?? "",
    row.displayName ?? "",
    row.followers ?? "",
    row.followersGrowthPct7d ?? "",
    row.posts7d ?? "",
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

async function ensureHeader(sheets, spreadsheetId, tabName) {
  const range = `${quoteTabName(tabName)}!A1:G1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const firstRow = res.data.values?.[0] ?? [];
  const hasHeader = firstRow[0] === HEADERS[0];
  if (hasHeader) return 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
  console.log(`Wrote header row to ${tabName}`);
  return 1;
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
  const range = `${quoteTabName(tabName)}!A:G`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
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
  const rows = rowsFromData(data);

  if (dryRun) {
    console.log(
      `Dry run: would replace ${today} in ${tabName} with ${rows.length} row(s)`
    );
    rows.forEach((row) => console.log(row.join("\t")));
    return 0;
  }

  await ensureHeader(sheets, spreadsheetId, tabName);
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
