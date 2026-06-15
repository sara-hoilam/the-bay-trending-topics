/**
 * IG Competitors Benchmark — dedicated IG Leaderboard tab.
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var root = document.getElementById("ig-leaderboard-root");
  if (!root) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function formatFollowers(n) {
    if (n == null) return "—";
    if (n >= 1000000) {
      var m = n / 1000000;
      return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")) + "M";
    }
    if (n >= 100000) return Math.round(n / 1000) + "K";
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString();
  }

  function formatGrowthPct(n) {
    if (n == null) return "—";
    var sign = n > 0 ? "+" : "";
    return sign + n.toFixed(2).replace(/\.?0+$/, "") + "%";
  }

  function formatPosts7d(n) {
    if (n == null) return "—";
    return String(n);
  }

  function growthClass(n) {
    if (n == null) return "";
    if (n > 0) return "igl-growth--up";
    if (n < 0) return "igl-growth--down";
    return "igl-growth--flat";
  }

  function render(data) {
    var accounts = data.accounts || [];
    var meta = document.getElementById("ig-leaderboard-meta");
    if (meta) {
      meta.textContent =
        "As of " +
        (data.updatedAt || "—") +
        " · " +
        accounts.length +
        " accounts";
    }

    if (!accounts.length) {
      root.innerHTML = '<p class="igl-empty">No Instagram accounts configured.</p>';
      return;
    }

    var html = '<div class="igl-table-wrap"><table class="igl-table">';
    html +=
      "<thead><tr>" +
      '<th scope="col">Instagram competitors benchmark</th>' +
      '<th scope="col">Followers</th>' +
      '<th scope="col">7d growth</th>' +
      '<th scope="col">7d posts</th>' +
      "</tr></thead><tbody>";

    accounts.forEach(function (row) {
      var rowClass = row.highlight ? " igl-row--highlight" : "";
      html += '<tr class="igl-row' + rowClass + '">';
      html +=
        '<td class="igl-account">' +
        '<a href="' +
        esc(row.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(row.displayName || row.handle) +
        "</a>" +
        '<span class="igl-handle">@' +
        esc(row.handle) +
        "</span></td>";
      html += '<td class="igl-followers">' + esc(formatFollowers(row.followers)) + "</td>";
      html +=
        '<td class="igl-growth ' +
        growthClass(row.followersGrowthPct7d) +
        '">' +
        esc(formatGrowthPct(row.followersGrowthPct7d)) +
        "</td>";
      html += '<td class="igl-posts">' + esc(formatPosts7d(row.posts7d)) + "</td>";
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    if (data.refreshedAtLabel) {
      html += '<p class="igl-footnote">' + esc(data.refreshedAtLabel) + "</p>";
    }
    root.innerHTML = html;
  }

  fetch("ig-leaderboard-data.json?v=" + encodeURIComponent(DATA_V))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (err) {
      root.innerHTML =
        '<p class="igl-err">Could not load IG leaderboard (' +
        esc(err.message) +
        "). Run <code>node scripts/capture-ig-leaderboard.mjs</code>.</p>";
    });
})();
