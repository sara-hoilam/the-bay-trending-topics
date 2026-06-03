/**
 * Daily Brief — article selection + Word (.docx) export for Google Drive.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  HeadingLevel,
} from "https://esm.sh/docx@9.1.0";

const FONT_BODY = "DM Sans";
const FONT_HEAD = "Playfair Display";
const COLOR_INK = "0D0D0D";
const COLOR_MUTED = "6B6460";
const COLOR_ACCENT = "C8441B";
const COLOR_ACCENT2 = "1B4DC8";
const COLOR_SUMMARY = "2A2A2A";

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function getEditionMeta(panel) {
  const titleEl = panel.querySelector(".section-head h2");
  const raw = titleEl?.textContent?.trim() || "THE BAY: Daily Brief";
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  return {
    title: raw,
    date: dateMatch?.[1] || new Date().toISOString().slice(0, 10),
  };
}

function parseSources(topic) {
  return $all(".topic-meta span", topic)
    .map((span) => {
      const link = span.querySelector("a");
      const text = span.textContent || "";
      const posted = text.match(/Posted:\s*([\d-]+)/)?.[1] || "";
      return {
        label: link?.textContent?.trim() || "",
        url: link?.href || "",
        posted,
      };
    })
    .filter((s) => s.label || s.url);
}

function collectBriefStructure(panel) {
  const wrapper = panel.querySelector("main.wrapper");
  if (!wrapper) return { edition: getEditionMeta(panel), sections: [] };

  const edition = getEditionMeta(panel);
  const sections = [];
  let currentSection = null;

  for (const node of wrapper.children) {
    if (node.classList?.contains("brief-toolbar")) continue;

    if (node.classList?.contains("section-head")) {
      const name = node.querySelector("h2")?.textContent?.trim() || "";
      if (name && !name.startsWith("THE BAY: Daily Brief")) {
        currentSection = { name, articles: [] };
        sections.push(currentSection);
      }
      continue;
    }

    if (node.classList?.contains("topic") || node.classList?.contains("brief-article")) {
      if (!currentSection) {
        currentSection = { name: "Brief", articles: [] };
        sections.push(currentSection);
      }
      currentSection.articles.push(node);
    }
  }

  return { edition, sections };
}

function getSelectedTopics(panel) {
  return $all(".topic.brief-article.is-selected, .topic.is-selected", panel);
}

function updateCount(panel) {
  const countEl = $("#brief-selected-count");
  if (!countEl) return;
  const n = getSelectedTopics(panel).length;
  const total = $all(".topic.brief-article, #panel-overall .topic", panel).length;
  countEl.textContent = n === 0 ? "No articles selected" : `${n} of ${total} selected`;
}

function injectToolbar(panel) {
  const wrapper = panel.querySelector("main.wrapper");
  if (!wrapper || $("#brief-toolbar")) return;

  const bar = document.createElement("div");
  bar.className = "brief-toolbar";
  bar.id = "brief-toolbar";
  bar.innerHTML =
    '<span class="brief-toolbar-count" id="brief-selected-count">No articles selected</span>' +
    '<div class="brief-toolbar-actions">' +
    '<button type="button" class="brief-toolbar-btn" id="brief-select-all">Select all</button>' +
    '<button type="button" class="brief-toolbar-btn brief-toolbar-btn--primary" id="brief-export-btn">Export Word</button>' +
    "</div>";
  wrapper.insertBefore(bar, wrapper.firstChild);

  $("#brief-select-all", bar).addEventListener("click", () => {
    const topics = $all(".topic.brief-article, #panel-overall .topic", panel);
    const allSelected = topics.every((t) => t.classList.contains("is-selected"));
    topics.forEach((topic) => setTopicSelected(topic, !allSelected));
    updateCount(panel);
    const btn = $("#brief-select-all", bar);
    btn.textContent = !allSelected && topics.length ? "Clear all" : "Select all";
  });

  $("#brief-export-btn", bar).addEventListener("click", () => exportDocx(panel));
}

function injectSelectButtons(panel) {
  $all(".topic", panel).forEach((topic) => {
    if (topic.querySelector(".topic-select-wrap")) return;
    topic.classList.add("brief-article");

    const wrap = document.createElement("div");
    wrap.className = "topic-select-wrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topic-select-btn";
    btn.textContent = "Select";
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      const on = !topic.classList.contains("is-selected");
      setTopicSelected(topic, on);
      updateCount(panel);
      syncSelectAllLabel(panel);
    });
    wrap.appendChild(btn);
    topic.appendChild(wrap);
  });
}

function setTopicSelected(topic, on) {
  topic.classList.toggle("is-selected", on);
  const btn = topic.querySelector(".topic-select-btn");
  if (btn) {
    btn.textContent = on ? "Selected" : "Select";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

function sourceParagraph(source) {
  const children = [
    new TextRun({ text: "📰 Source: ", font: FONT_BODY, size: 20, color: COLOR_MUTED }),
  ];
  if (source.url) {
    children.push(
      new ExternalHyperlink({
        link: source.url,
        children: [
          new TextRun({
            text: source.label || source.url,
            font: FONT_BODY,
            size: 20,
            color: COLOR_ACCENT2,
            underline: { type: "single", color: COLOR_ACCENT2 },
          }),
        ],
      }),
    );
  } else {
    children.push(
      new TextRun({ text: source.label, font: FONT_BODY, size: 20, color: COLOR_ACCENT2 }),
    );
  }
  if (source.posted) {
    children.push(
      new TextRun({
        text: ` · Posted: ${source.posted}`,
        font: FONT_BODY,
        size: 20,
        color: COLOR_MUTED,
      }),
    );
  }
  return new Paragraph({
    children,
    spacing: { after: 80 },
  });
}

function articleParagraphs(topic) {
  const rank = topic.querySelector(".topic-rank")?.textContent?.trim() || "";
  const cat = topic.querySelector(".topic-cat")?.textContent?.trim() || "";
  const title = topic.querySelector(".topic-title")?.textContent?.trim() || "";
  const summary = topic.querySelector(".topic-summary")?.textContent?.trim() || "";
  const sources = parseSources(topic);

  const blocks = [
    new Paragraph({
      spacing: { before: 280, after: 80 },
      border: { top: { style: "single", size: 6, color: "CCCCCC" } },
      children: [
        new TextRun({
          text: rank,
          font: FONT_HEAD,
          size: 56,
          bold: true,
          color: COLOR_ACCENT,
        }),
        new TextRun({ text: "   ", size: 20 }),
        new TextRun({
          text: cat.toUpperCase(),
          font: "DM Mono",
          size: 16,
          color: COLOR_ACCENT2,
          characterSpacing: 60,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: title,
          font: FONT_HEAD,
          size: 39,
          bold: true,
          color: COLOR_INK,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: summary,
          font: FONT_BODY,
          size: 22,
          color: COLOR_SUMMARY,
        }),
      ],
    }),
  ];

  sources.forEach((s) => blocks.push(sourceParagraph(s)));
  return blocks;
}

async function exportDocx(panel) {
  const selected = new Set(getSelectedTopics(panel));
  if (!selected.size) {
    window.alert("Select at least one article to export.");
    return;
  }

  const { edition, sections } = collectBriefStructure(panel);
  const exportBtn = $("#brief-export-btn");
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.textContent = "Exporting…";
  }

  try {
    await exportDocxLib(panel, selected, edition, sections);
  } catch (err) {
    console.warn("docx library export failed, using Word HTML fallback:", err);
    exportWordHtml(panel, selected, edition, sections);
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.textContent = "Export Word";
    }
  }
}

async function exportDocxLib(panel, selected, edition, sections) {
  const docChildren = buildDocChildren(selected, edition, sections);
  let exported = 0;
  for (const section of sections) {
    exported += section.articles.filter((a) => selected.has(a)).length;
  }
  if (!exported) {
    window.alert("Select at least one article to export.");
    return;
  }

  const doc = new Document({
    sections: [{ properties: {}, children: docChildren }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `THE-BAY-Daily-Brief-${edition.date}.docx`);
}

function buildDocChildren(selected, edition, sections) {
  const docChildren = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: edition.title,
          font: FONT_HEAD,
          size: 44,
          bold: true,
          color: COLOR_INK,
        }),
      ],
    }),
  ];

  for (const section of sections) {
    const picked = section.articles.filter((a) => selected.has(a));
    if (!picked.length) continue;

    docChildren.push(
      new Paragraph({
        spacing: { before: 320, after: 160 },
        children: [
          new TextRun({
            text: section.name.toUpperCase(),
            font: FONT_HEAD,
            size: 22,
            color: COLOR_MUTED,
            characterSpacing: 120,
          }),
        ],
      }),
    );

    for (const topic of picked) {
      docChildren.push(...articleParagraphs(topic));
    }
  }

  return docChildren;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportWordHtml(panel, selected, edition, sections) {
  let body = `<h1 style="font-family:Georgia,serif;font-size:22pt;color:#0d0d0d;">${escHtml(edition.title)}</h1>`;

  for (const section of sections) {
    const picked = section.articles.filter((a) => selected.has(a));
    if (!picked.length) continue;

    body += `<h2 style="font-family:Georgia,serif;font-size:11pt;letter-spacing:0.18em;text-transform:uppercase;color:#6b6460;margin-top:24pt;">${escHtml(section.name)}</h2>`;

    for (const topic of picked) {
      const rank = topic.querySelector(".topic-rank")?.textContent?.trim() || "";
      const cat = topic.querySelector(".topic-cat")?.textContent?.trim() || "";
      const title = topic.querySelector(".topic-title")?.textContent?.trim() || "";
      const summary = topic.querySelector(".topic-summary")?.textContent?.trim() || "";
      const sources = parseSources(topic);

      body += `<div style="border-top:1.5pt solid #0d0d0d;padding-top:14pt;margin-top:14pt;">`;
      body += `<p style="margin:0 0 6pt;"><span style="font-family:Georgia,serif;font-size:28pt;font-weight:bold;color:#c8441b;">${escHtml(rank)}</span> `;
      body += `<span style="font-family:Consolas,monospace;font-size:8pt;letter-spacing:0.12em;text-transform:uppercase;color:#1b4dc8;">${escHtml(cat)}</span></p>`;
      body += `<p style="font-family:Georgia,serif;font-size:17pt;font-weight:bold;margin:0 0 8pt;color:#0d0d0d;">${escHtml(title)}</p>`;
      body += `<p style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.65;margin:0 0 10pt;color:#2a2a2a;">${escHtml(summary)}</p>`;

      for (const s of sources) {
        body += `<p style="font-family:Consolas,monospace;font-size:9pt;color:#6b6460;margin:0 0 4pt;">📰 Source: `;
        if (s.url) {
          body += `<a href="${escHtml(s.url)}" style="color:#1b4dc8;">${escHtml(s.label)}</a>`;
        } else {
          body += escHtml(s.label);
        }
        if (s.posted) body += ` · Posted: ${escHtml(s.posted)}`;
        body += `</p>`;
      }
      body += `</div>`;
    }
  }

  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" ` +
    `xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${escHtml(edition.title)}</title></head>` +
    `<body>${body}</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  downloadBlob(blob, `THE-BAY-Daily-Brief-${edition.date}.doc`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function syncSelectAllLabel(panel) {
  const btn = $("#brief-select-all");
  if (!btn) return;
  const topics = $all(".topic.brief-article, #panel-overall .topic", panel);
  const any = topics.some((t) => t.classList.contains("is-selected"));
  const all = topics.length > 0 && topics.every((t) => t.classList.contains("is-selected"));
  btn.textContent = all ? "Clear all" : "Select all";
  if (!any) btn.textContent = "Select all";
}

function initSelectAllLabel(panel) {
  syncSelectAllLabel(panel);
}

function init() {
  const panel = $("#panel-overall");
  if (!panel) return;

  injectToolbar(panel);
  injectSelectButtons(panel);
  updateCount(panel);
  syncSelectAllLabel(panel);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
