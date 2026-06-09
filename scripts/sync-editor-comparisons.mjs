#!/usr/bin/env node
/**
 * Sync editor comparison docx from Google Drive → Training Data/editor-comparisons/raw/
 *
 * Manual mode (default): reports files already in raw/
 * API mode: set GOOGLE_DRIVE_CREDENTIALS (service account JSON) and optionally GOOGLE_DRIVE_FOLDER_ID
 *
 * Usage:
 *   node scripts/sync-editor-comparisons.mjs
 *   node scripts/sync-editor-comparisons.mjs --dry-run
 *   node scripts/sync-editor-comparisons.mjs --import-dir="GBA Pulse Feedback"
 *   node scripts/sync-editor-comparisons.mjs --import-dir="C:\path\to\GBA Pulse Feedback"
 */
import fs from "fs";
import path from "path";
import {
  ensureDirs,
  listRawDocx,
  paths,
  root,
  DRIVE_FOLDER_ID,
  DRIVE_FOLDER_URL,
  findDocxFiles,
  standardRawFilename,
  extractDateFromFilename,
} from "./editor-comparison-utils.mjs";

function parseArgs() {
  const out = { dryRun: process.argv.includes("--dry-run"), importDir: null };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--import-dir=(.+)$/);
    if (m) out.importDir = path.resolve(root, m[1]);
  }
  return out;
}

function importFromLocalDir(importDir, dryRun) {
  const files = findDocxFiles(importDir);
  if (!files.length) {
    console.log(`No .docx files under ${importDir}`);
    return 0;
  }

  let copied = 0;
  let skipped = 0;
  for (const src of files) {
    const base = path.basename(src);
    const destName = standardRawFilename(base);
    if (!extractDateFromFilename(base) && !extractDateFromFilename(destName)) {
      console.warn(`Skip (no date in filename): ${base}`);
      skipped++;
      continue;
    }
    const dest = path.join(paths.raw, destName);
    if (fs.existsSync(dest)) {
      const srcMtime = fs.statSync(src).mtimeMs;
      const destMtime = fs.statSync(dest).mtimeMs;
      if (destMtime >= srcMtime) {
        console.log(`Up to date: ${destName}`);
        continue;
      }
    }
    if (dryRun) {
      console.log(`Would import: ${base} → ${destName}`);
      copied++;
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`Imported: ${base} → ${destName}`);
    copied++;
  }

  console.log(`Local import complete (${copied} copied, ${skipped} skipped).`);
  return 0;
}

async function loadGoogleApis() {
  try {
    const mod = await import("googleapis");
    return mod.google;
  } catch {
    console.error(
      "googleapis package not installed. Run: npm install googleapis --no-save (or full npm install on CI)",
    );
    return null;
  }
}

async function syncFromDrive(dryRun) {
  const credsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!credsJson?.trim()) {
    console.log("GOOGLE_DRIVE_CREDENTIALS not set — manual sync only.");
    console.log(`Drop .docx files into: ${paths.raw}`);
    console.log(`Drive folder: ${DRIVE_FOLDER_URL}`);
    return 0;
  }

  const google = await loadGoogleApis();
  if (!google) return 1;

  let credentials;
  try {
    credentials = JSON.parse(credsJson);
  } catch {
    console.error("GOOGLE_DRIVE_CREDENTIALS is not valid JSON");
    return 1;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DRIVE_FOLDER_ID;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: 100,
    orderBy: "modifiedTime desc",
  });

  const files = res.data.files ?? [];
  if (!files.length) {
    console.log("No .docx files found in Drive folder.");
    return 0;
  }

  let downloaded = 0;
  for (const file of files) {
    if (!/\.docx$/i.test(file.name) && !/\d{4}-\d{2}-\d{2}/.test(file.name)) continue;
    const destName = file.name.endsWith(".docx") ? file.name : `${file.name}.docx`;
    const dest = path.join(paths.raw, destName);

    if (fs.existsSync(dest)) {
      const localMtime = fs.statSync(dest).mtime.toISOString();
      if (localMtime >= file.modifiedTime) {
        console.log(`Up to date: ${destName}`);
        continue;
      }
    }

    if (dryRun) {
      console.log(`Would download: ${file.name} → ${destName}`);
      downloaded++;
      continue;
    }

    const media = await drive.files.get(
      { fileId: file.id, alt: "media" },
      { responseType: "arraybuffer" },
    );
    fs.writeFileSync(dest, Buffer.from(media.data));
    console.log(`Downloaded: ${destName}`);
    downloaded++;
  }

  console.log(`Drive sync complete (${downloaded} new/updated files).`);
  return 0;
}

async function main() {
  ensureDirs();
  const { dryRun, importDir } = parseArgs();

  if (importDir) {
    console.log(`Importing from: ${importDir}`);
    const code = importFromLocalDir(importDir, dryRun);
    if (code) process.exit(code);
  }

  const local = listRawDocx();
  console.log(`Local raw/: ${local.length} docx file(s)`);

  const code = await syncFromDrive(dryRun);
  if (code) process.exit(code);

  if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
    console.log("\nTo enable API sync:");
    console.log("1. Create a Google Cloud service account with Drive API enabled");
    console.log("2. Share the Drive folder with the service account email");
    console.log("3. Set GOOGLE_DRIVE_CREDENTIALS secret to the service account JSON");
    console.log(`4. Optional: GOOGLE_DRIVE_FOLDER_ID=${DRIVE_FOLDER_ID}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
