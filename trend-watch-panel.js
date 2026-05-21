/**
 * Renders Trend Watch from embedded JSON (#trend-watch-data) into #trend-watch-root.
 * Scoped for GBA Pulse panel #panel-trendwatch (tw-* classes).
 */
(function () {
  var RANK_SLOTS = 5;

  var BRAND = {
    google_trends: { title: "Google Trends", accent: "#4285f4", iconId: "tw-icon-google-trends" },
    baidu: { title: "Baidu", accent: "#2932e1", iconId: "tw-icon-baidu" },
    weibo: { title: "Weibo", accent: "#e6162d", iconId: "tw-icon-weibo" },
    x_twitter: { title: "X", accent: "#000", iconId: "tw-icon-x" },
  };

  function esc(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function iconBlock(id) {
    return '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function sortItems(items) {
    return (items || []).slice().sort(function (a, b) {
      var ra = a.rank != null ? a.rank : 999;
      var rb = b.rank != null ? b.rank : 999;
      return ra - rb;
    });
  }

  function rowsFromItems(items) {
    var sorted = sortItems(items);
    var byRank = {};
    sorted.forEach(function (it) {
      var r = it.rank != null ? it.rank : sorted.indexOf(it) + 1;
      byRank[r] = it;
    });
    var out = [];
    for (var r = 1; r <= RANK_SLOTS; r++) {
      out.push(byRank[r] || null);
    }
    return out;
  }

  function getGoogleItems(sec, locId) {
    var map = sec.itemsByLocation || {};
    if (map[locId] && map[locId].length) return map[locId];
    return sec.items || [];
  }

  function googleLocationMeta(sec, id) {
    var locs = sec.locations || [];
    for (var i = 0; i < locs.length; i++) {
      if (locs[i].id === id) return locs[i];
    }
    return null;
  }

  function parseVolumeFromLabel(s) {
    if (s == null) return null;
    var t = String(s).replace(/\s/g, "").toUpperCase();
    var m = t.match(/([\d.]+)([KMB])\+?/);
    if (!m) return null;
    var n = parseFloat(m[1], 10);
    if (isNaN(n)) return null;
    var mul = { K: 1e3, M: 1e6, B: 1e9 }[m[2]] || 1;
    return Math.round(n * mul);
  }

  function volumeNumeric(it) {
    if (it && it.volumeEstimate != null && Number(it.volumeEstimate) > 0) {
      return Number(it.volumeEstimate);
    }
    return parseVolumeFromLabel(it && it.searchVolume);
  }

  function volumeForItem(it) {
    if (!it) return "—";
    if (it.searchVolume != null && String(it.searchVolume).trim() !== "") return String(it.searchVolume);
    if (it.volumeLabel != null && String(it.volumeLabel).trim() !== "") return String(it.volumeLabel);
    if (it.volumeScore != null) return String(it.volumeScore);
    return "—";
  }

  function captureIso(data, sec, locMeta, it) {
    if (it && it.capturedAt) return it.capturedAt;
    if (locMeta && locMeta.capturedAt) return locMeta.capturedAt;
    if (sec.capturedAt) return sec.capturedAt;
    return data.refreshedAt || "";
  }

  function formatPulled(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return esc(iso);
      return esc(
        d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })
      );
    } catch (e) {
      return esc(iso);
    }
  }

  function pinForItem(it) {
    if (it && it.pin) return it.pin;
    return "📍";
  }

  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  function computeGoogleTopicScore(it, locMeta, itemsForLoc) {
    if (!it) return null;
    var V = volumeNumeric(it);
    var A = locMeta && locMeta.avgTop50Volume != null ? Number(locMeta.avgTop50Volume) : 0;
    var G = it && it.growthPercent != null ? Number(it.growthPercent) : 0;
    if (!V || V <= 0 || !itemsForLoc || !itemsForLoc.length) return null;

    var vmax = 0;
    for (var i = 0; i < itemsForLoc.length; i++) {
      var vi = volumeNumeric(itemsForLoc[i]);
      if (vi > vmax) vmax = vi;
    }
    if (vmax <= 0) return null;

    var normVol = Math.log10(1 + V) / Math.log10(1 + vmax);
    normVol = clamp(normVol, 0, 1);

    var normGrowth = clamp(G / 1000, 0, 1);

    var ratio = A > 0 ? V / A : 1;
    var normVsAvg = clamp((ratio - 0.35) / 1.65, 0, 1);

    var score = 100 * (0.35 * normVol + 0.35 * normGrowth + 0.3 * normVsAvg);
    return Math.round(clamp(score, 0, 100));
  }

  function isRowEmpty(it) {
    if (!it || !it.title) return true;
    var t = String(it.title).trim();
    return t === "" || t === "—";
  }

  function renderTopicCard(data, sec, locMeta, rank, it, score) {
    var empty = isRowEmpty(it);
    var title = empty ? "—" : it.title;
    var vol = volumeForItem(it);
    var pulled = formatPulled(captureIso(data, sec, locMeta, it));
    var pin = pinForItem(it);
    var hasScore = score != null && score !== "";
    var cls = "tw-topic-card" + (empty ? " tw-is-empty" : "") + (hasScore ? " tw-has-score" : "");
    var html = '<div class="' + cls + '">';
    html += '<div class="tw-topic-card-main">';
    html += '<div class="tw-topic-rank">#' + rank + "</div>";
    html += '<div class="tw-topic-title">' + esc(title) + "</div>";
    html +=
      '<div class="tw-topic-metric"><span class="tw-metric-lbl">Search volume</span><span class="tw-metric-val">' +
      esc(vol) +
      "</span></div>";
    html +=
      '<div class="tw-topic-metric" style="margin-top:8px"><span class="tw-metric-lbl">Data pulled</span><time datetime="' +
      esc(captureIso(data, sec, locMeta, it)) +
      '">' +
      pulled +
      "</time></div>";
    html += "</div>";
    if (hasScore) {
      html += '<div class="tw-topic-card-score-col">';
      html += '<span class="tw-topic-pin-abs" aria-hidden="true">' + esc(pin) + "</span>";
      html += '<span class="tw-topic-score-val">' + esc(String(score)) + "</span>";
      html += '<span class="tw-topic-score-lbl">Score</span>';
      html += "</div>";
    } else {
      html += '<span class="tw-topic-pin-abs" aria-hidden="true">' + esc(pin) + "</span>";
    }
    html += "</div>";
    return html;
  }

  function paintGooglePanel(data, sec) {
    var panel = document.getElementById("panel-google-trends");
    if (!panel) return;
    var select = panel.querySelector("[data-google-geo-select]");
    var link = panel.querySelector("[data-google-board-link]");
    var subEl = panel.querySelector("[data-google-subtitle]");
    var hintEl = panel.querySelector("[data-google-score-hint]");
    var stack = panel.querySelector("[data-google-rank-stack]");
    if (!select || !link || !stack) return;

    var locId = select.value;
    var loc = googleLocationMeta(sec, locId);
    var items = getGoogleItems(sec, locId);
    if (loc) {
      link.href = loc.sourceUrl || "#";
      link.setAttribute("href", loc.sourceUrl || "#");
      subEl.textContent = (loc.emoji ? loc.emoji + " " : "") + (loc.label || locId);
    }
    if (hintEl && sec.scoreHelp) {
      hintEl.textContent = sec.scoreHelp;
    }

    var rows = rowsFromItems(items);
    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var it = rows[i];
      var sc = computeGoogleTopicScore(it, loc, items);
      var scDisp = sc == null ? null : String(sc);
      html += renderTopicCard(data, sec, loc, i + 1, it, scDisp);
    }
    stack.innerHTML = html;
  }

  function renderGoogleShell(data, sec) {
    var b = BRAND.google_trends;
    var def = sec.defaultLocationId || "HK";
    var locs = sec.locations || [];
    var html =
      '<article class="tw-platform-panel" id="panel-google-trends" style="--panel-accent:' + esc(b.accent) + '">';
    html += '<header class="tw-panel-head">';
    html += '<div class="tw-brand-icon-wrap">' + iconBlock(b.iconId) + "</div>";
    html += '<div class="tw-panel-titles">';
    html += "<h2>" + esc(b.title) + "</h2>";
    html += '<div class="tw-board">' + esc(sec.boardLabel || "") + "</div>";
    html += '<p class="tw-panel-sub" data-google-subtitle></p>';
    html += "</div></header>";

    var firstUrl = (locs[0] && locs[0].sourceUrl) || "#";
    html += '<div class="tw-panel-actions">';
    html +=
      '<a class="tw-panel-open" data-google-board-link href="' +
      esc(firstUrl) +
      '" target="_blank" rel="noopener noreferrer">Open live board ↗</a>';
    html += '<div class="tw-geo-select-wrap">';
    html += '<span class="tw-geo-select-label">Location</span>';
    html += '<select class="tw-geo-select" data-google-geo-select aria-label="Trend location">';
    for (var i = 0; i < locs.length; i++) {
      var L = locs[i];
      var sel = L.id === def ? " selected" : "";
      html += '<option value="' + esc(L.id) + '"' + sel + ">" + esc(L.label) + "</option>";
    }
    html += "</select></div></div>";
    html += '<div class="tw-rank-stack" data-google-rank-stack></div>';
    if (sec.scoreHelp) {
      html +=
        '<p class="tw-panel-score-hint tw-panel-score-hint--footer" data-google-score-hint>' +
        esc(sec.scoreHelp) +
        "</p>";
    }
    html += "</article>";
    return html;
  }

  function renderPanel(data, sec) {
    if (sec.id === "google_trends") {
      return renderGoogleShell(data, sec);
    }
    var b = BRAND[sec.id] || { title: sec.id, iconId: "tw-icon-google-trends" };
    var rows = rowsFromItems(sec.items || []);
    var html = '<article class="tw-platform-panel" id="tw-source-' + esc(sec.id) + '">';
    html += '<header class="tw-panel-head">';
    html += '<div class="tw-brand-icon-wrap">' + iconBlock(b.iconId) + "</div>";
    html += '<div class="tw-panel-titles">';
    html += "<h2>" + esc(b.title) + "</h2>";
    html += '<div class="tw-board">' + esc(sec.boardLabel || "") + "</div>";
    if (sec.subtitle) html += '<p class="tw-panel-sub">' + esc(sec.subtitle) + "</p>";
    html += "</div></header>";
    if (sec.sourceUrl) {
      html +=
        '<div class="tw-panel-actions"><a class="tw-panel-open" href="' +
        esc(sec.sourceUrl) +
        '" target="_blank" rel="noopener noreferrer">Open live board ↗</a></div>';
    }
    html += '<div class="tw-rank-stack">';
    for (var i = 0; i < rows.length; i++) {
      html += renderTopicCard(data, sec, null, i + 1, rows[i], null);
    }
    html += "</div></article>";
    return html;
  }

  function bindGooglePanel(data) {
    var sec = null;
    (data.sections || []).forEach(function (s) {
      if (s.id === "google_trends") sec = s;
    });
    if (!sec) return;
    var panel = document.getElementById("panel-google-trends");
    if (!panel) return;
    var select = panel.querySelector("[data-google-geo-select]");
    if (!select) return;
    paintGooglePanel(data, sec);
    select.addEventListener("change", function () {
      paintGooglePanel(data, sec);
    });
  }

  function renderTrendWatchIntoRoot(data, root) {
    var sections = data.sections || [];
    var html = "";

    if (data.refreshedAtLabel || data.refreshedAt) {
      html +=
        '<p class="tw-meta-line">' + esc(data.refreshedAtLabel || data.refreshedAt || "") + "</p>";
    }

    if (data.disclaimer) {
      html += '<div class="tw-alert">' + esc(data.disclaimer) + "</div>";
    }

    html += '<div class="tw-dashboard"><div class="tw-platform-grid">';
    sections.forEach(function (sec) {
      html += renderPanel(data, sec);
    });
    html += "</div></div>";

    root.innerHTML = html;
    bindGooglePanel(data);
  }

  function initTrendWatch() {
    var payloadEl = document.getElementById("trend-watch-data");
    var root = document.getElementById("trend-watch-root");
    if (!payloadEl || !root) return;
    try {
      var data = JSON.parse(payloadEl.textContent || "{}");
      renderTrendWatchIntoRoot(data, root);
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      root.innerHTML =
        '<div class="tw-err"><strong>Invalid trend watch JSON.</strong> ' + esc(msg) + "</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTrendWatch);
  } else {
    initTrendWatch();
  }
})();
