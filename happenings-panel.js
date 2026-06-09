/**
 * Happenings tab — calendar + highlighted and all events from lifestyle source links.
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var HIGHLIGHT_THRESHOLD = 24;
  var root = document.getElementById("happenings-root");
  if (!root) return;

  var FILTERS = [
    { id: "all", label: "All" },
    { id: "hk", label: "Hong Kong" },
    { id: "shenzhen", label: "Shenzhen" },
    { id: "macao", label: "Macao" },
    { id: "gba", label: "Other GBA" },
    { id: "international", label: "International" },
  ];

  var REGIONS = {
    hk: { color: "#e8920a", label: "Hong Kong", dotClass: "hp-dot--hk" },
    shenzhen: { color: "#1e3a5f", label: "Shenzhen", dotClass: "hp-dot--sz" },
    macao: { color: "#7b2d8e", label: "Macao", dotClass: "hp-dot--mo" },
    gba: { color: "#2a7a6f", label: "Other GBA", dotClass: "hp-dot--gba" },
    international: { color: "#5c6b7a", label: "International", dotClass: "hp-dot--intl" },
  };

  var REGION_ORDER = ["hk", "shenzhen", "macao", "gba", "international"];

  var MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  var MARQUEE_PATTERNS = [
    /clockenflap/i,
    /comic\s*con/i,
    /comicon/i,
    /art\s*basel/i,
    /book\s*fair/i,
    /marathon/i,
    /world\s*tour/i,
    /arts?\s*festival/i,
    /music\s*festival/i,
  ];

  function hktTodayParts() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    function get(type) {
      var p = parts.find(function (x) {
        return x.type === type;
      });
      return p ? Number(p.value) : 0;
    }
    return { year: get("year"), month: get("month") - 1, day: get("day") };
  }

  function hktTodayDate() {
    var p = hktTodayParts();
    return new Date(p.year, p.month, p.day);
  }

  var hktInit = hktTodayParts();
  var state = {
    year: hktInit.year,
    month: hktInit.month,
    filter: "all",
    events: [],
    sources: [],
    eventCountByDomain: {},
    seeMoreUrl: null,
    seeMoreLabel: "See more events",
  };

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function parseDate(s) {
    var p = s.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function inferRegion(ev) {
    var loc = (ev.location || "").toLowerCase();
    if (/hong kong|\bhk\b/.test(loc)) return "hk";
    if (/shenzhen|深圳/.test(loc)) return "shenzhen";
    if (/macao|macau|澳门|澳門/.test(loc)) return "macao";
    if (
      /guangzhou|广州|廣州|foshan|佛山|dongguan|东莞|東莞|zhuhai|珠海|huizhou|惠州|jiangmen|江门|江門|zhaoqing|肇庆|肇慶|zhongshan|中山|hengqin|横琴|粵港澳|大湾区/.test(
        loc
      )
    ) {
      return "gba";
    }
    return "international";
  }

  function normalizeRegion(ev) {
    var inferred = inferRegion(ev);
    var r = ev.region;
    if (r === "outside" || !REGIONS[r]) return inferred;
    if (
      (r === "gba" && inferred === "international") ||
      (r === "international" && inferred === "gba")
    ) {
      return inferred;
    }
    return r;
  }

  function eventSpanDays(ev) {
    if (!ev.start || !ev.end) return 1;
    var start = parseDate(ev.start);
    var end = parseDate(ev.end);
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }

  function clientHighlightScore(ev) {
    if (typeof ev.highlightScore === "number") return ev.highlightScore;
    var blob = (ev.title || "") + " " + (ev.location || "");
    var score = 0;
    if (ev.featured) score += 40;
    MARQUEE_PATTERNS.forEach(function (re) {
      if (re.test(blob)) score += 28;
    });
    if (/\bfestival\b/i.test(blob)) score += 18;
    if (/\bexpo\b/i.test(blob)) score += 16;
    if (/\bfair\b/i.test(blob)) score += 14;
    if (/\bconcert\b/i.test(blob)) score += 12;
    if (/\binternational\b/i.test(blob)) score += 10;
    var span = eventSpanDays(ev);
    if (span >= 14) score += 12;
    else if (span >= 7) score += 8;
    else if (span >= 3) score += 4;
    return score;
  }

  function isHighlighted(ev) {
    if (ev.highlighted === true) return true;
    return clientHighlightScore(ev) >= HIGHLIGHT_THRESHOLD;
  }

  function matchesFilter(ev, filter) {
    if (filter === "all") return true;
    return normalizeRegion(ev) === filter;
  }

  function eventOverlapsMonth(ev, year, month) {
    var start = parseDate(ev.start);
    var end = parseDate(ev.end || ev.start);
    var first = new Date(year, month, 1);
    var last = new Date(year, month + 1, 0);
    return start <= last && end >= first;
  }

  function eventsOnDay(year, month, day, filter) {
    var d = new Date(year, month, day);
    return state.events.filter(function (ev) {
      if (!matchesFilter(ev, filter)) return false;
      var start = parseDate(ev.start);
      var end = parseDate(ev.end || ev.start);
      return d >= start && d <= end;
    });
  }

  function filteredEventsForMonth(year, month, filter) {
    return state.events
      .filter(function (ev) {
        return eventOverlapsMonth(ev, year, month) && matchesFilter(ev, filter);
      })
      .sort(function (a, b) {
        return parseDate(a.start) - parseDate(b.start);
      });
  }

  function highlightedEventsForMonth(year, month, filter) {
    return filteredEventsForMonth(year, month, filter)
      .filter(isHighlighted)
      .sort(function (a, b) {
        return clientHighlightScore(b) - clientHighlightScore(a);
      })
      .slice(0, 10);
  }

  function formatBadgeRange(ev) {
    var s = parseDate(ev.start);
    var e = parseDate(ev.end || ev.start);
    var sm = MONTHS[s.getMonth()];
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      if (s.getDate() === e.getDate()) return pad(s.getDate()) + " " + sm;
      return s.getDate() + "-" + e.getDate() + " " + sm;
    }
    return pad(s.getDate()) + " " + sm + " – " + e.getDate() + " " + MONTHS[e.getMonth()];
  }

  function formatDetailDate(ev) {
    var s = parseDate(ev.start);
    var e = parseDate(ev.end || ev.start);
    var fmt = function (d) {
      return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
    };
    if (s.getTime() === e.getTime()) return fmt(s);
    return fmt(s) + " - " + fmt(e);
  }

  function regionMeta(ev) {
    var id = normalizeRegion(ev);
    return REGIONS[id] || REGIONS.gba;
  }

  function renderEventItem(ev, opts) {
    opts = opts || {};
    var meta = regionMeta(ev);
    var loc = ev.location || meta.label;
    var html = '<li class="hp-event' + (opts.highlighted ? " hp-event--highlighted" : "") + '">';
    html +=
      '<div class="hp-event-badge' +
      (opts.highlighted ? " hp-event-badge--highlighted" : "") +
      '" style="background:' +
      meta.color +
      '">' +
      esc(formatBadgeRange(ev)) +
      "</div>";
    html += '<div class="hp-event-body">';
    html +=
      '<p class="hp-event-meta"><strong style="color:' +
      meta.color +
      '">' +
      esc(loc) +
      "</strong> | " +
      esc(formatDetailDate(ev)) +
      "</p>";
    html +=
      '<p class="hp-event-title"><a href="' +
      esc(ev.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(ev.title) +
      "</a></p>";
    html += "</div></li>";
    return html;
  }

  function renderEventList(events, emptyMsg) {
    if (!events.length) {
      return '<p class="hp-empty">' + esc(emptyMsg) + "</p>";
    }
    var html = '<ul class="hp-event-list">';
    events.forEach(function (ev) {
      html += renderEventItem(ev, { highlighted: isHighlighted(ev) });
    });
    html += "</ul>";
    return html;
  }

  function renderSourcesBar() {
    if (!state.sources.length) return "";
    var html = '<div class="hp-sources-bar">';
    html += '<p class="hp-sources-bar-label">Lifestyle calendar sources</p>';
    html += '<ul class="hp-sources-chips">';
    state.sources.forEach(function (src) {
      var count = state.eventCountByDomain[src.domain] || 0;
      html +=
        '<li class="hp-source-chip">' +
        '<a href="' +
        esc(src.url) +
        '" target="_blank" rel="noopener noreferrer" title="' +
        esc(src.domain) +
        '">' +
        '<span class="hp-source-chip-name">' +
        esc(src.displayName || src.domain) +
        "</span>" +
        '<span class="hp-source-chip-count">' +
        count +
        " events</span>" +
        "</a></li>";
    });
    html += "</ul></div>";
    return html;
  }

  function render() {
    var y = state.year;
    var m = state.month;
    var filter = state.filter;
    var today = hktTodayDate();
    var firstDow = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var monthEvents = filteredEventsForMonth(y, m, filter);
    var highlightedEvents = highlightedEventsForMonth(y, m, filter);

    var html = renderSourcesBar();
    html += '<div class="hp-layout">';

    html += '<div class="hp-filters" role="tablist" aria-label="Event region filter">';
    FILTERS.forEach(function (f) {
      html +=
        '<button type="button" class="hp-filter' +
        (filter === f.id ? " hp-filter--active" : "") +
        '" data-filter="' +
        f.id +
        '" role="tab" aria-selected="' +
        (filter === f.id) +
        '">' +
        esc(f.label) +
        "</button>";
    });
    html += "</div>";

    html += '<div class="hp-body">';

    html += '<div class="hp-calendar-col">';
    html += '<div class="hp-cal-head">';
    html +=
      '<button type="button" class="hp-cal-nav" data-nav="-1" aria-label="Previous month">‹</button>';
    html += '<span class="hp-cal-title">' + MONTHS[m] + " " + y + "</span>";
    html +=
      '<button type="button" class="hp-cal-nav" data-nav="1" aria-label="Next month">›</button>';
    html += "</div>";

    html += '<div class="hp-cal-grid hp-cal-weekdays">';
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) {
      html += '<span class="hp-cal-wd">' + d + "</span>";
    });
    html += "</div>";

    html += '<div class="hp-cal-grid hp-cal-days">';
    for (var i = 0; i < firstDow; i++) {
      html += '<span class="hp-cal-day hp-cal-day--empty"></span>';
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var cellDate = new Date(y, m, day);
      var dayEv = eventsOnDay(y, m, day, "all");
      var isToday = sameDay(cellDate, today);
      var dots = "";
      var seen = {};
      dayEv.forEach(function (e) {
        var rid = normalizeRegion(e);
        if (!seen[rid]) {
          seen[rid] = true;
          var meta = REGIONS[rid];
          if (meta) dots += '<span class="hp-dot ' + meta.dotClass + '"></span>';
        }
      });
      html +=
        '<span class="hp-cal-day' +
        (isToday ? " hp-cal-day--today" : "") +
        (dayEv.length ? " hp-cal-day--has" : "") +
        '">' +
        '<span class="hp-cal-num">' +
        day +
        "</span>" +
        (dots ? '<span class="hp-cal-dots">' + dots + "</span>" : "") +
        "</span>";
    }
    html += "</div>";

    html += '<div class="hp-legend">';
    REGION_ORDER.forEach(function (id) {
      var meta = REGIONS[id];
      html +=
        '<span><i class="hp-dot ' +
        meta.dotClass +
        '"></i> ' +
        esc(meta.label) +
        "</span>";
    });
    html += "</div>";
    html += "</div>";

    html += '<div class="hp-events-col">';
    html += '<h2 class="hp-events-title hp-events-title--highlighted">Highlighted Events</h2>';
    html += '<p class="hp-events-sub">Major festivals, fairs, concerts, and crowd-pulling exhibitions</p>';
    html += renderEventList(
      highlightedEvents,
      "No major highlighted events this month for this filter."
    );

    html += '<h2 class="hp-events-title hp-events-title--all">All Events</h2>';
    html += renderEventList(monthEvents, "No events this month for this filter.");

    var seeMoreHref = state.seeMoreUrl || "https://event.hktdc.com/";
    var seeMoreText = state.seeMoreLabel || "See more events";
    html +=
      '<a class="hp-see-more" href="' +
      esc(seeMoreHref) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(seeMoreText) +
      " &rsaquo;</a>";
    html += "</div>";

    html += "</div></div>";

    root.innerHTML = html;

    root.querySelectorAll("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        render();
      });
    });
    root.querySelectorAll("[data-nav]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var delta = Number(btn.getAttribute("data-nav"));
        state.month += delta;
        if (state.month > 11) {
          state.month = 0;
          state.year++;
        } else if (state.month < 0) {
          state.month = 11;
          state.year--;
        }
        render();
      });
    });
  }

  function load() {
    Promise.all([
      fetch("happenings-events.json?v=" + encodeURIComponent(DATA_V)).then(function (r) {
        if (!r.ok) throw new Error("events HTTP " + r.status);
        return r.json();
      }),
      fetch("source-links-data.json?v=" + encodeURIComponent(DATA_V)).then(function (r) {
        if (!r.ok) throw new Error("sources HTTP " + r.status);
        return r.json();
      }),
    ])
      .then(function (results) {
        state.events = (results[0].events || []).map(function (ev) {
          return Object.assign({}, ev, { region: normalizeRegion(ev) });
        });
        state.sources = (results[1].sources || []).filter(function (s) {
          return s.category === "Lifestyle";
        });
        state.eventCountByDomain = {};
        state.sources.forEach(function (src) {
          state.eventCountByDomain[src.domain] = 0;
        });
        state.events.forEach(function (ev) {
          var domain = ev.sourceDomain;
          if (domain && state.eventCountByDomain[domain] != null) {
            state.eventCountByDomain[domain]++;
          }
        });

        var hktdc = state.sources.find(function (s) {
          return s.domain === "event.hktdc.com";
        });
        if (hktdc) {
          state.seeMoreUrl = hktdc.url;
          state.seeMoreLabel = "See more HKTDC exhibitions";
        }
        var meta = document.getElementById("hp-meta");
        if (meta) {
          meta.textContent =
            state.events.length +
            " events · " +
            state.sources.length +
            " lifestyle sources";
        }
        render();
      })
      .catch(function (err) {
        root.innerHTML =
          '<p class="hp-err">Could not load happenings (' +
          esc(err.message) +
          ").</p>";
      });
  }

  load();
})();
