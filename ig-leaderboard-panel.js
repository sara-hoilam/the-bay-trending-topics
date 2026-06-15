/**
 * IG Competitor Followers leaderboard — dedicated IG Leaderboard tab.
 * Chip layout mirrors Happenings lifestyle source bar (ranked follower counts).
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
    if (n == null) return "7d —";
    var sign = n > 0 ? "+" : "";
    return "7d " + sign + n.toLocaleString();
  }

  function deltaClass(n) {
    if (n == null) return "igl-chip-delta--flat";
    if (n > 0) return "igl-chip-delta--up";
    if (n < 0) return "igl-chip-delta--down";
    return "igl-chip-delta--flat";
  }

  function renderChip(row, rank) {
    var homeClass = row.group === "home" ? " igl-chip--home" : "";
    return (
      '<li class="igl-chip' +
      homeClass +
      '">' +
      '<a href="' +
      esc(row.url) +
      '" target="_blank" rel="noopener noreferrer" title="@' +
      esc(row.handle) +
      ' on Instagram">' +
      '<span class="igl-chip-rank">#' +
      rank +
      "</span>" +
      '<span class="igl-chip-name">' +
      esc(row.displayName || row.handle) +
      "</span>" +
      '<span class="igl-chip-handle">@' +
      esc(row.handle) +
      " · " +
      esc(row.market) +
      "</span>" +
      '<span class="igl-chip-followers">' +
      esc(formatFollowers(row.followers)) +
      " followers</span>" +
      '<span class="igl-chip-delta ' +
      deltaClass(row.followersDelta7d) +
      '">' +
      esc(formatDelta(row.followersDelta7d)) +
      "</span>" +
      "</a></li>"
    );
  }

  function renderGroup(label, accounts, startRank) {
    if (!accounts.length) return "";
    var html = '<div class="igl-group">';
    html += '<p class="igl-group-label">' + esc(label) + "</p>";
    html += '<ul class="igl-chips">';
    accounts.forEach(function (row, i) {
      html += renderChip(row, startRank + i);
    });
    html += "</ul></div>";
    return html;
  }

  function render(data) {
    var accounts = (data.accounts || []).slice();
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
      root.innerHTML = '<p class="igl-empty">No Instagram accounts configured.</p>';
      return;
    }

    var home = accounts
      .filter(function (a) {
        return a.group === "home";
      })
      .sort(function (a, b) {
        return (b.followers ?? -1) - (a.followers ?? -1);
      });
    var competitors = accounts
      .filter(function (a) {
        return a.group !== "home";
      })
      .sort(function (a, b) {
        return (b.followers ?? -1) - (a.followers ?? -1);
      });

    var html = renderGroup("GBA tourism boards", home, 1);
    html += renderGroup("Competitor destinations", competitors, home.length + 1);
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
