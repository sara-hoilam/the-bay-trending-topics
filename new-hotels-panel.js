/**
 * New Hotels tab — Asia & Portugal openings from new-hotels-data.json
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var root = document.getElementById("new-hotels-root");
  if (!root) return;

  var allHotels = [];
  var activeStatus = "all";
  var activeGroup = "all";
  var activeCountry = "all";

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
    return allHotels.filter(function (h) {
      if (activeStatus === "upcoming" && h.status !== "upcoming") return false;
      if (activeStatus === "opened" && h.status !== "opened") return false;
      if (activeGroup !== "all" && h.hotelGroup !== activeGroup) return false;
      if (activeCountry !== "all" && h.country !== activeCountry) return false;
      return true;
    });
  }

  function fillSelect(id, values, allLabel, current) {
    var sel = document.getElementById(id);
    if (!sel) return "all";
    var keep = current || sel.value || "all";
    sel.innerHTML =
      '<option value="all">' +
      esc(allLabel) +
      "</option>" +
      values
        .map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        })
        .join("");
    if (values.indexOf(keep) !== -1) sel.value = keep;
    else sel.value = "all";
    return sel.value;
  }

  function renderName(h) {
    var label = esc(h.name);
    if (h.websiteUrl) {
      return (
        '<a class="nh-hotel-link" href="' +
        esc(h.websiteUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        label +
        "</a>"
      );
    }
    return label;
  }

  function renderStars(stars) {
    var n = Number(stars);
    if (!n || n < 1 || n > 5) {
      return '<span class="nh-stars nh-stars--na">—</span>';
    }
    var icons = "";
    for (var i = 0; i < n; i++) {
      icons +=
        '<span class="nh-star" aria-hidden="true">★</span>';
    }
    return (
      '<span class="nh-stars" title="' +
      n +
      ' star' +
      (n === 1 ? "" : "s") +
      '" aria-label="' +
      n +
      ' star' +
      (n === 1 ? "" : "s") +
      '">' +
      icons +
      "</span>"
    );
  }

  function renderRows() {
    var rows = filtered();
    var countEl = document.getElementById("nh-count");
    if (countEl) {
      countEl.textContent = rows.length + (rows.length === 1 ? " hotel" : " hotels");
    }

    if (!rows.length) {
      root.innerHTML =
        '<p class="nh-empty">No hotels match these filters in the ±6 month window.</p>';
      return;
    }

    var html =
      '<div class="nh-table-wrap"><table class="nh-table">' +
      "<thead><tr>" +
      '<th scope="col">Hotel</th>' +
      '<th scope="col">Open date</th>' +
      '<th scope="col">Location</th>' +
      '<th scope="col">Hotel group</th>' +
      '<th scope="col">Stars</th>' +
      '<th scope="col">Status</th>' +
      '<th scope="col">Source</th>' +
      "</tr></thead><tbody>";

    rows.forEach(function (h) {
      var statusClass =
        h.status === "opened" ? "nh-status--opened" : "nh-status--upcoming";
      var statusLabel = h.status === "opened" ? "Opened" : "Opening soon";
      html += "<tr>";
      html += '<td class="nh-name">' + renderName(h) + "</td>";
      html += '<td class="nh-date">' + esc(h.openDateLabel || "—") + "</td>";
      html += '<td class="nh-loc">' + esc(h.location || h.country || "—") + "</td>";
      html += '<td class="nh-group">' + esc(h.hotelGroup || "—") + "</td>";
      html += '<td class="nh-stars-cell">' + renderStars(h.stars) + "</td>";
      html +=
        '<td class="nh-status"><span class="nh-status-badge ' +
        statusClass +
        '">' +
        esc(statusLabel) +
        "</span></td>";
      html +=
        '<td class="nh-source"><a href="' +
        esc(h.sourceUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(h.sourceName || h.sourceDomain || "Source") +
        "</a></td>";
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    root.innerHTML = html;
  }

  function render(data) {
    allHotels = data.hotels || [];
    var meta = document.getElementById("nh-meta");
    if (meta) {
      var win =
        data.windowStart && data.windowEnd
          ? " · window " + data.windowStart + " → " + data.windowEnd
          : "";
      meta.textContent =
        "Asia & Portugal · as of " +
        (data.updatedAt || "—") +
        " · ±6 months" +
        win;
    }

    activeGroup = fillSelect(
      "nh-group-filter",
      uniqueSorted(allHotels.map(function (h) {
        return h.hotelGroup;
      })),
      "All groups",
      activeGroup,
    );
    activeCountry = fillSelect(
      "nh-location-filter",
      data.countries && data.countries.length
        ? data.countries
        : uniqueSorted(allHotels.map(function (h) {
            return h.country;
          })),
      "All countries",
      activeCountry,
    );
    renderRows();
  }

  var statusEl = document.getElementById("nh-status-filter");
  if (statusEl) {
    statusEl.addEventListener("change", function () {
      activeStatus = statusEl.value || "all";
      renderRows();
    });
  }
  var groupEl = document.getElementById("nh-group-filter");
  if (groupEl) {
    groupEl.addEventListener("change", function () {
      activeGroup = groupEl.value || "all";
      renderRows();
    });
  }
  var locationEl = document.getElementById("nh-location-filter");
  if (locationEl) {
    locationEl.addEventListener("change", function () {
      activeCountry = locationEl.value || "all";
      renderRows();
    });
  }

  fetch("new-hotels-data.json?v=" + encodeURIComponent(DATA_V))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function (err) {
      root.innerHTML =
        '<p class="nh-err">Could not load new hotels (' +
        esc(err.message) +
        "). Run <code>node scripts/generate-new-hotels-data.mjs</code>.</p>";
    });
})();
