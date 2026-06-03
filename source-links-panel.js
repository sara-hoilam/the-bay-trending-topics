/**
 * Source Links tab — renders approved daily brief domains from source-links-data.json
 */
(function () {
  var tbody = document.getElementById("source-links-tbody");
  var countEl = document.getElementById("sl-count");
  if (!tbody) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function render(data) {
    if (countEl) {
      countEl.textContent = data.count + " sources";
    }
    tbody.innerHTML = data.sources
      .map(function (row) {
        var domain = row.domain || row.name;
        var label = row.displayName || row.name;
        return (
          "<tr>" +
          "<td class=\"sl-domain\">" + esc(domain) + "</td>" +
          "<td class=\"sl-name\">" + esc(label) + "</td>" +
          "<td class=\"sl-link\"><a href=\"" + esc(row.url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          esc(row.url) + "</a></td>" +
          "<td class=\"sl-cat\"><span class=\"sl-cat-badge sl-cat-" + esc(row.category.toLowerCase()) + "\">" +
          esc(row.category) + "</span></td>" +
          "</tr>"
        );
      })
      .join("");
  }

  fetch("source-links-data.json")
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
