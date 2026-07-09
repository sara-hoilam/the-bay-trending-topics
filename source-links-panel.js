/**
 * Source Links tab — renders approved daily brief domains from source-links-data.json
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var tbody = document.getElementById("source-links-tbody");
  var countEl = document.getElementById("sl-count");
  var filterEl = document.getElementById("sl-category-filter");
  if (!tbody) return;

  var allSources = [];
  var activeCategory = "all";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function filteredSources() {
    if (activeCategory === "all") return allSources;
    return allSources.filter(function (row) {
      return row.category === activeCategory;
    });
  }

  function renderRows() {
    var rows = filteredSources();
    if (countEl) {
      countEl.textContent =
        rows.length + (activeCategory === "all" ? " sources" : " " + activeCategory.toLowerCase() + " sources");
    }
    if (!rows.length) {
      tbody.innerHTML =
        "<tr><td colspan=\"4\" class=\"sl-err\">No sources in this category.</td></tr>";
      return;
    }
    tbody.innerHTML = rows
      .map(function (row) {
        var domain = row.domain || row.name;
        var label = row.displayName || row.name;
        return (
          "<tr>" +
          "<td class=\"sl-domain\">" + esc(domain) + "</td>" +
          "<td class=\"sl-name\">" + esc(label) + "</td>" +
          "<td class=\"sl-link\"><a href=\"" + esc(row.url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          esc(row.url) + "</a></td>" +
          "<td class=\"sl-cat\"><span class=\"sl-cat-badge sl-cat-" + esc(row.category.toLowerCase().replace(/\s+/g, "-")) + "\">" +
          esc(row.category) + "</span></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function render(data) {
    allSources = data.sources || [];
    renderRows();
  }

  if (filterEl) {
    filterEl.addEventListener("change", function () {
      activeCategory = filterEl.value || "all";
      renderRows();
    });
  }

  fetch("source-links-data.json?v=" + encodeURIComponent(DATA_V))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (err) {
      tbody.innerHTML =
        "<tr><td colspan=\"4\" class=\"sl-err\">Could not load source links (" +
        esc(String(err.message)) +
        "). Run <code>node scripts/generate-source-links-data.mjs</code>.</td></tr>";
    });
})();
