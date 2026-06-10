#!/usr/bin/env node
/** Generate a minimal comparison docx fixture for parser validation. */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { ensureDirs, paths } from "./editor-comparison-utils.mjs";

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Manual brief vs GBA Pulse AI comparison — 2026-06-09</w:t></w:r></w:p>
    <w:p><w:r><w:t>GBA News (2):</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Southbound travel scheme opens to five more GBA cities from July</w:t></w:r></w:p>
    <w:p><w:r><w:t>https://www.scmp.com/news/hong-kong/transport/article/3356351/example</w:t></w:r></w:p>
    <w:p>
      <w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>[selected]</w:t></w:r>
      <w:r><w:t> Editor pick for cross-border transport.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Hong Kong (1):</w:t></w:r></w:p>
    <w:p><w:r><w:t>5. Observatory issues first black rainstorm warning of 2026</w:t></w:r></w:p>
    <w:p><w:r><w:t>[selected]</w:t></w:r></w:p>
    <w:p><w:r><w:t>Macao (1):</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Blessing ceremony held for 2026 SJM Macao International Dragon Boat Races</w:t></w:r></w:p>
    <w:p><w:r><w:t>[selected]</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

async function main() {
  ensureDirs();
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels").file(".rels", rels);
  zip.folder("word").file("document.xml", documentXml);
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const out = path.join(paths.raw, "2026-06-09-comparison.docx");
  fs.writeFileSync(out, buf);
  console.log(`Wrote fixture ${out}`);
}

main();
