/**
 * IG Competitor Followers leaderboard — Source Links tab (last panel).
 * Loads ig-leaderboard-data.json and renders ranked tourism-board accounts.
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
    if (n >= 10000) return Math.round(n / 1000) + "K";
    return n.toLocaleString();
  }

  function formatDelta(n) {
    if (n == null) return "—";
    var sign = n > 0 ? "+" : "";
    return sign + n.toLocaleString();
  }

  function formatEngagement(rate) {
    if (rate == null) return "—";
    return (rate * 100).toFixed(2) + "%";
  }

  function deltaClass(n) {
    if (n == null) return "ig-delta--flat";
    if (n > 0) return "ig-delta--up";
    if (n < 0) return "ig-delta--down";
    return "ig-delta--flat";
  }

  function render(data) {
    var accounts = (data.accounts || []).slice().sort(function (a, b) {
      return (b.followers ?? -1) - (a.followers ?? -1);
    });
    var meta = document.getElementById("ig-leaderboard-meta");
    if (meta) {
      meta.textContent =
        (data.updatedAt || "—") +
        " · " +
        accounts.filter(function (a) {
          return a.followers != null;
        }).length +
        "/" +
        accounts.length +
        " accounts";
    }

    if (!accounts.length) {
      root.innerHTML = '<p class="ig-empty">No Instagram accounts configured.</p>';
      return;
    }

    var html = '<div class="ig-table-wrap"><table class="ig-table">';
    html +=
      "<thead><tr>" +
      "<th scope=\"col\">#</th>" +
      "<th scope=\"col\">Account</th>" +
      "<th scope=\"col\">Market</th>" +
      "<th scope=\"col\">Followers</th>" +
      "<th scope=\"col\">7d</th>" +
      "<th scope=\"col\">30d</th>" +
      "<th scope=\"col\">Engagement</th>" +
      "</tr></thead><tbody>";

    accounts.forEach(function (row, idx) {
      var groupClass = row.group === "home" ? "ig-badge--home" : "ig-badge--competitor";
      var groupLabel = row.group === "home" ? "GBA" : "Competitor";
      html += "<tr>";
      html += '<td class="ig-rank">' + (idx + 1) + "</td>";
      html +=
        '<td class="ig-account"><a href="' +
        esc(row.url) +
        '" target="_blank" rel="noopener noreferrer">@' +
        esc(row.handle) +
        "</a>" +
        '<span class="ig-account-name">' +
        esc(row.displayName) +
        "</span>" +
        '<span class="ig-account-org">' +
        esc(row.org) +
        "</span></td>";
      html +=
        '<td class="ig-market"><span class="ig-badge ' +
        groupClass +
        '">' +
        esc(groupLabel) +
        "</span> " +
        esc(row.market) +
        "</td>";
      html += '<td class="ig-followers">' + esc(formatFollowers(row.followers)) + "</td>";
      html +=
        '<td class="ig-delta ' +
        deltaClass(row.followersDelta7d) +
        '">' +
        esc(formatDelta(row.followersDelta7d)) +
        "</td>";
      html +=
        '<td class="ig-delta ' +
        deltaClass(row.followersDelta30d) +
        '">' +
        esc(formatDelta(row.followersDelta30d)) +
        "</td>";
      html += '<td class="ig-engagement">' + esc(formatEngagement(row.engagementRate)) + "</td>";
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    if (data.refreshedAtLabel) {
      html += '<p class="ig-footnote">' + esc(data.refreshedAtLabel) + "</p>";
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
        '<p class="ig-err">Could not load IG leaderboard (' +
        esc(err.message) +
        "). Run <code>node scripts/capture-ig-leaderboard.mjs</code>.</p>";
    });
})();
