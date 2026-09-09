/**
 * Hotel Press tab — awards and good news from Hotels source links (last 14 days).
 * Renders Daily Brief-style topic cards from hotel-press-data.json.
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var root = document.getElementById("hotel-press-root");
  if (!root) return;

  var allArticles = [];
  var activeGroup = "all";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function uniqueSorted(values) {
    var set = {};
    values.forEach(function (v) {
      if (v) set[v] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function filtered() {
    if (activeGroup === "all") return allArticles;
    return allArticles.filter(function (a) {
      return a.hotelGroup === activeGroup;
    });
  }

  function fillGroupSelect(values) {
    var sel = document.getElementById("hp-group-filter");
    if (!sel) return;
    var keep = sel.value || "all";
    sel.innerHTML =
      '<option value="all">All groups</option>' +
      values
        .map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        })
        .join("");
    sel.value = values.indexOf(keep) !== -1 ? keep : "all";
    activeGroup = sel.value;
  }

  function kindLabel(kind) {
    if (kind === "award") return "Award";
    if (kind === "good-news") return "Good news";
    return "Hotel press";
  }

  function renderRows() {
    var rows = filtered();
    var countEl = document.getElementById("hp-press-count");
    if (countEl) {
      countEl.textContent =
        rows.length + (rows.length === 1 ? " article" : " articles");
    }

    if (!rows.length) {
      root.innerHTML =
        '<p class="nh-empty">No awards or good news in the last 14 days for these hotel press sources.</p>';
      return;
    }

    var html = "";
    var delay = 0.05;
    rows.forEach(function (a, i) {
      var cat = a.hotelGroup || a.sourceName || "Hotels";
      var kind = kindLabel(a.kind);
      html +=
        '<div class="topic brief-article" style="animation-delay:' +
        delay.toFixed(2) +
        's">' +
        '<div class="topic-rank">' +
        esc(a.rank || i + 1) +
        "</div>" +
        '<div class="topic-body">' +
        '<div class="topic-cat">' +
        esc(cat) +
        " · " +
        esc(kind) +
        "</div>" +
        '<h2 class="topic-title">' +
        esc(a.title) +
        "</h2>" +
        '<p class="topic-summary">' +
        esc(a.summary || "") +
        "</p>" +
        '<div class="topic-meta">' +
        "<span><span class=\"icon\">📰</span> Source: " +
        '<a href="' +
        esc(a.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(a.sourceName || a.sourceDomain || "Source") +
        "</a>" +
        " · Posted: " +
        esc(a.posted || "—") +
        "</span>" +
        "</div>" +
        "</div></div>";
      delay += 0.05;
    });
    root.innerHTML = html;
  }

  function render(data) {
    allArticles = data.articles || [];
    var meta = document.getElementById("hp-press-meta");
    if (meta) {
      var win =
        data.windowStart && data.windowEnd
          ? data.windowStart + " → " + data.windowEnd
          : "last 14 days";
      meta.textContent =
        "as of " + (data.updatedAt || "—") + " · " + win;
    }
    fillGroupSelect(
      uniqueSorted(
        allArticles.map(function (a) {
          return a.hotelGroup;
        }),
      ),
    );
    renderRows();
  }

  var groupEl = document.getElementById("hp-group-filter");
  if (groupEl) {
    groupEl.addEventListener("change", function () {
      activeGroup = groupEl.value || "all";
      renderRows();
    });
  }

  fetch("hotel-press-data.json?v=" + encodeURIComponent(DATA_V))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (err) {
      root.innerHTML =
        '<p class="nh-err">Could not load hotel press (' +
        esc(err.message) +
        "). Run <code>node scripts/generate-hotel-press-data.mjs</code>.</p>";
    });
})();
