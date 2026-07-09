/**
 * New Hotels tab — upcoming / recently opened hotels from new-hotels-data.json
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var root = document.getElementById("new-hotels-root");
  if (!root) return;

  var allHotels = [];
  var activeStatus = "all";
  var activeGroup = "all";
  var activeLocation = "all";

  var PORTUGAL_RE =
    /\bportugal\b|\blisbon\b|\bporto\b|\bcomporta\b|\bmelides\b|\balgarve\b|\bcascais\b|\bsintra\b|\bmadeira\b|\bazores\b/i;
  var ASIA_RE =
    /\basia\b|\bjapan\b|\bchina\b|\bhong kong\b|\bmacao\b|\bmacau\b|\btaiwan\b|\bkorea\b|\bseoul\b|\bbusan\b|\bincheon\b|\bthailand\b|\bbangkok\b|\bphuket\b|\bvietnam\b|\bhanoi\b|\bho chi minh\b|\bsaigon\b|\bdanang\b|\bsingapore\b|\bmalaysia\b|\bkuala lumpur\b|\bpenang\b|\bindonesia\b|\bbali\b|\bjakarta\b|\bphilippines\b|\bmanila\b|\bboracay\b|\bindia\b|\bmumbai\b|\bdelhi\b|\bgoa\b|\bkerala\b|\budaipur\b|\blaos\b|\bcambodia\b|\bmyanmar\b|\byangon\b|\bmongolia\b|\bsri lanka\b|\bmaldives\b|\bnepal\b|\bbhutan\b|\bbangladesh\b|\bpakistan\b|\bkyoto\b|\btokyo\b|\bosaka\b|\bokinawa\b|\bshanghai\b|\bbeijing\b|\bshenzhen\b|\bguangzhou\b|\bjilin\b/i;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function hotelRegion(h) {
    if (h.region === "portugal" || h.region === "asia") return h.region;
    var blob = (h.location || "") + " " + (h.name || "");
    if (PORTUGAL_RE.test(blob)) return "portugal";
    if (ASIA_RE.test(blob) || /\basia\b/i.test(h.region || "")) return "asia";
    return h.region || "other";
  }

  function uniqueGroups(hotels) {
    var set = {};
    hotels.forEach(function (h) {
      if (h.hotelGroup) set[h.hotelGroup] = true;
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
      if (activeLocation === "portugal" && hotelRegion(h) !== "portugal") return false;
      if (activeLocation === "asia" && hotelRegion(h) !== "asia") return false;
      return true;
    });
  }

  function fillGroupFilter(hotels) {
    var sel = document.getElementById("nh-group-filter");
    if (!sel) return;
    var groups = uniqueGroups(hotels);
    var current = sel.value || "all";
    sel.innerHTML =
      '<option value="all">All groups</option>' +
      groups
        .map(function (g) {
          return '<option value="' + esc(g) + '">' + esc(g) + "</option>";
        })
        .join("");
    if (groups.indexOf(current) !== -1) sel.value = current;
    else sel.value = "all";
    activeGroup = sel.value;
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
      '<th scope="col">Status</th>' +
      '<th scope="col">Source</th>' +
      "</tr></thead><tbody>";

    rows.forEach(function (h) {
      var statusClass =
        h.status === "opened" ? "nh-status--opened" : "nh-status--upcoming";
      var statusLabel = h.status === "opened" ? "Opened" : "Opening soon";
      html += "<tr>";
      html += '<td class="nh-name">' + esc(h.name) + "</td>";
      html += '<td class="nh-date">' + esc(h.openDateLabel || "—") + "</td>";
      html += '<td class="nh-loc">' + esc(h.location || "—") + "</td>";
      html += '<td class="nh-group">' + esc(h.hotelGroup || "—") + "</td>";
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
        "As of " + (data.updatedAt || "—") + " · ±6 months" + win;
    }
    fillGroupFilter(allHotels);
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
      activeLocation = locationEl.value || "all";
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
