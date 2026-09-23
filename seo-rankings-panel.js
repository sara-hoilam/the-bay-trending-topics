/**
 * SEO Rank Tracker — dedicated "SEO Ranks" tab for GBA Pulse.
 *
 * Reads seo-rankings-data.json (written by scripts/capture-seo-rankings.mjs)
 * and renders, per keyword and market:
 *   · current Google position (Search Console, last 7 days) + change
 *   · position over time (line chart, page-1 zone shaded)
 *   · The Bay articles ranking for the keyword, with each article's position
 *   · competitors ranking above us (what it is, rank, clickable link)
 *
 * No external libraries. Styles are injected once and use the site's CSS
 * variables (--ink, --paper, --accent, --accent2, --muted, --rule, --pos, --neg).
 *
 * For an offline preview, set window.SEO_RANKINGS_DATA before this script loads.
 */
(function () {
  var DATA_V = window.GBA_DATA_VERSION || "1";
  var root = document.getElementById("seo-rankings-root");
  if (!root) return;

  var RANGES = [
    { id: "28", label: "28 days", days: 28 },
    { id: "90", label: "3 months", days: 90 },
    { id: "365", label: "12 months", days: 365 },
    { id: "all", label: "All", days: null }
  ];
  var TYPE_LABELS = {
    government: "Government",
    encyclopedia: "Encyclopedia",
    news: "News publisher",
    consultancy: "Consultancy / bank",
    data: "Data portal",
    business: "Business guide",
    travel: "Travel",
    academic: "Academic / think tank",
    video: "Video",
    social: "Social / forum",
    other: "Other"
  };

  var state = { data: null, market: null, keyword: null, range: "90" };
  try {
    var saved = JSON.parse(localStorage.getItem("seoRk") || "{}");
    if (saved.range) state.range = saved.range;
    if (saved.market) state.market = saved.market;
    if (saved.keyword) state.keyword = saved.keyword;
  } catch (e) {}

  function persist() {
    try {
      localStorage.setItem(
        "seoRk",
        JSON.stringify({ range: state.range, market: state.market, keyword: state.keyword })
      );
    } catch (e) {}
  }

  /* ─────────── helpers ─────────── */
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function safeUrl(u) {
    return /^https?:\/\//i.test(String(u || "")) ? String(u) : "#";
  }
  function fmtPos(p) {
    return p == null || isNaN(p) ? "—" : Number(p).toFixed(1);
  }
  function fmtInt(n) {
    if (n == null || isNaN(n)) return "—";
    n = Math.round(n);
    if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-GB");
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  function fmtDateShort(iso) {
    var d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  function dayNum(iso) {
    return Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
  }
  function isoFromDay(n) {
    return new Date(n * 86400000).toISOString().slice(0, 10);
  }
  /** Lower position is better, so a negative change is an improvement. */
  function deltaHtml(cur, prev) {
    if (cur == null || prev == null) return '<span class="seo-delta seo-delta--flat">no prior data</span>';
    var d = cur - prev;
    if (Math.abs(d) < 0.05) return '<span class="seo-delta seo-delta--flat">no change</span>';
    var better = d < 0;
    return (
      '<span class="seo-delta ' + (better ? "seo-delta--up" : "seo-delta--down") + '">' +
      (better ? "▲ " : "▼ ") + Math.abs(d).toFixed(1) + (better ? " better" : " worse") +
      "</span>"
    );
  }
  function pathOf(url) {
    try {
      var u = new URL(url);
      return u.pathname === "/" ? "Homepage" : u.pathname;
    } catch (e) {
      return url;
    }
  }
  function marketBlock(kw) {
    return (kw.markets && kw.markets[state.market]) || null;
  }

  /* ─────────── styles ─────────── */
  function injectStyles() {
    if (document.getElementById("seo-rk-styles")) return;
    var css = [
      "#panel-seoranks main.wrapper{max-width:1100px;padding-top:24px}",
      ".seo-header h2{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;letter-spacing:-.01em;line-height:1.2}",
      ".seo-meta{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:6px}",
      ".seo-sample{background:#fff6db;border-left:3px solid var(--gold);padding:12px 16px;font-size:13.5px;margin:18px 0 0}",
      ".seo-sample strong{font-weight:600}",
      ".seo-toolbar{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:18px 0;border-bottom:1px solid var(--rule);margin-bottom:24px}",
      ".seo-seg{display:flex;align-items:center;gap:8px}",
      ".seo-seg-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}",
      ".seo-seg button{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:7px 12px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);cursor:pointer;border-radius:2px;margin-left:-1.5px}",
      ".seo-seg button:first-of-type{margin-left:0}",
      ".seo-seg button[aria-pressed=true]{background:var(--ink);color:var(--paper)}",
      ".seo-seg button:hover:not([aria-pressed=true]){background:#e8e4dc}",
      ".seo-seg button:focus-visible,.seo-card:focus-visible,.seo-chart svg:focus-visible{outline:2px solid var(--accent2);outline-offset:2px}",
      ".seo-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}",
      ".seo-card{text-align:left;font:inherit;color:inherit;background:#fff;border:1.5px solid var(--rule);border-radius:4px;padding:16px;cursor:pointer;display:flex;flex-direction:column;gap:6px;transition:border-color .15s}",
      ".seo-card:hover{border-color:var(--muted)}",
      ".seo-card[aria-pressed=true]{border-color:var(--accent);box-shadow:inset 0 -3px 0 var(--accent)}",
      ".seo-card-kw{font-weight:600;font-size:15px;line-height:1.3}",
      ".seo-tag{display:inline-block;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:2px;background:var(--accent);color:#fff;margin-left:6px;vertical-align:2px}",
      ".seo-card-pos{font-size:44px;font-weight:600;line-height:1;letter-spacing:-.02em;margin-top:6px}",
      ".seo-card-pos small{font-size:13px;font-weight:400;color:var(--muted);letter-spacing:0;margin-left:4px}",
      ".seo-card-sub{font-family:'DM Mono',monospace;font-size:10.5px;color:var(--muted);letter-spacing:.03em}",
      ".seo-p1{display:inline-block;font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:2px 6px;border-radius:2px;border:1px solid var(--pos);color:var(--pos)}",
      ".seo-p1--off{border-color:var(--rule);color:var(--muted)}",
      ".seo-delta{font-family:'DM Mono',monospace;font-size:11px;white-space:nowrap}",
      ".seo-delta--up{color:var(--pos)}.seo-delta--down{color:var(--neg)}.seo-delta--flat{color:var(--muted)}",
      ".seo-section{margin-bottom:36px}",
      ".seo-section h3{font-family:'Playfair Display',serif;font-size:13px;font-weight:400;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);margin-bottom:4px}",
      ".seo-section .seo-lede{font-size:14px;color:#333;margin-bottom:14px}",
      ".seo-chart{position:relative;background:#fff;border:1px solid var(--rule);border-radius:4px;padding:12px 8px 4px}",
      ".seo-chart svg{display:block;width:100%;height:auto;touch-action:pan-y}",
      ".seo-tip{position:absolute;pointer-events:none;background:#fff;border:1px solid var(--rule);box-shadow:0 2px 8px rgba(0,0,0,.08);border-radius:3px;padding:8px 10px;font-size:12px;min-width:150px;opacity:0;transition:opacity .08s}",
      ".seo-tip-date{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}",
      ".seo-tip-row{display:flex;align-items:center;gap:8px}",
      ".seo-tip-key{display:inline-block;width:12px;height:2px;background:var(--accent2)}",
      ".seo-tip-val{font-weight:600;font-size:14px}",
      ".seo-tip-sub{color:var(--muted);font-size:11px;margin-top:2px}",
      ".seo-legend{display:flex;gap:16px;font-size:12px;color:var(--muted);padding:0 8px 6px 40px}",
      ".seo-legend span{display:inline-flex;align-items:center;gap:6px}",
      ".seo-lg-line{display:inline-block;width:14px;height:2px;background:var(--accent2)}",
      ".seo-lg-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent2);opacity:.35}",
      ".seo-show-sm{display:none}",
      ".seo-empty{color:var(--muted);font-size:14px;padding:24px 8px;text-align:center}",
      ".seo-details{margin-top:8px;font-size:12.5px}",
      ".seo-details summary{cursor:pointer;font-family:'DM Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}",
      ".seo-details .seo-table-wrap{max-height:260px;overflow:auto;margin-top:8px}",
      ".seo-table-wrap{overflow-x:auto;border-radius:4px;border:1px solid #1e3a5f}",
      ".seo-table{width:100%;border-collapse:collapse;font-size:14px}",
      ".seo-table thead th{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;background:#1e3a5f;color:#fff;white-space:nowrap}",
      ".seo-table thead th.num,.seo-table td.num{text-align:right}",
      ".seo-table tbody tr{border-bottom:1px solid var(--rule);background:#fff}",
      ".seo-table tbody tr:last-child{border-bottom:none}",
      ".seo-table td{padding:12px 16px;vertical-align:top;line-height:1.45;color:#1e3a5f}",
      ".seo-table td.num{font-family:'DM Mono',monospace;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}",
      ".seo-table td.rank{font-family:'DM Mono',monospace;font-weight:600;font-size:15px;width:56px}",
      ".seo-table a{color:inherit;font-weight:600;text-decoration:none}",
      ".seo-table a:hover{text-decoration:underline}",
      ".seo-url{display:block;font-family:'DM Mono',monospace;font-size:10.5px;color:var(--muted);margin-top:2px;word-break:break-all;font-weight:400}",
      ".seo-type{display:inline-block;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:2px;background:#eef1f6;color:#1e3a5f;white-space:nowrap}",
      ".seo-note{display:block;font-size:12.5px;color:#555;margin-top:4px}",
      ".seo-us td{background:#fff6db;font-weight:600}",
      ".seo-us .seo-url{font-weight:400}",
      ".seo-flag{font-family:'DM Mono',monospace;font-size:9.5px;color:var(--gold);letter-spacing:.04em;margin-left:6px}",
      ".seo-footnote{font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);margin:10px 0 0;letter-spacing:.03em;line-height:1.6}",
      ".seo-err{color:var(--neg);font-size:14px}",
      ".seo-err code{font-family:'DM Mono',monospace;font-size:11px}",
      "@media (max-width:860px){.seo-cards{grid-template-columns:repeat(2,1fr)}}",
      "@media (max-width:640px){#panel-seoranks main.wrapper{padding-left:16px;padding-right:16px}.seo-cards{gap:8px}.seo-card{padding:12px}.seo-card-pos{font-size:34px}.seo-table td,.seo-table thead th{padding:10px 10px}.seo-hide-sm{display:none}.seo-show-sm{display:block;margin-top:6px}}"
    ].join("\n");
    var el = document.createElement("style");
    el.id = "seo-rk-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ─────────── chart ─────────── */
  function drawChart(host, history, rangeDays) {
    host.innerHTML = "";
    var pts = (history || []).filter(function (h) { return h && h.date; });
    if (rangeDays) {
      var lastDay = pts.length ? dayNum(pts[pts.length - 1].date) : 0;
      pts = pts.filter(function (h) { return dayNum(h.date) > lastDay - rangeDays; });
    }
    var withPos = pts.filter(function (h) { return h.position != null; });
    if (!withPos.length) {
      host.innerHTML = '<p class="seo-empty">No impressions for this keyword in this market and period yet.</p>';
      return;
    }

    var W = Math.max(320, Math.round(host.clientWidth || 800));
    var H = W < 520 ? 240 : 300;
    var M = { t: 16, r: 52, b: 30, l: 40 };
    var iw = W - M.l - M.r, ih = H - M.t - M.b;

    var d0 = dayNum(pts[0].date), d1 = dayNum(pts[pts.length - 1].date);
    if (d1 === d0) d1 = d0 + 1;
    var maxPos = Math.max.apply(null, withPos.map(function (h) { return h.position; }));
    var yMax = Math.max(20, Math.ceil(maxPos / 10) * 10);
    function x(day) { return M.l + ((day - d0) / (d1 - d0)) * iw; }
    function y(pos) { return M.t + ((pos - 1) / (yMax - 1)) * ih; }

    var NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      tabindex: "0",
      "aria-label": "Google position over time. Lower is better; position 1 is the top result."
    });

    // Page-1 zone (positions 1–10)
    el("rect", { x: M.l, y: y(1), width: iw, height: y(10.5) - y(1), fill: "var(--pos)", "fill-opacity": "0.07" }, svg);
    var p1 = el("text", { x: M.l + 6, y: y(1) + 12, fill: "var(--pos)", "font-family": "DM Mono, monospace", "font-size": "9.5", "letter-spacing": ".08em" }, svg);
    p1.textContent = "PAGE 1";

    // Y grid + ticks
    var ticks = [1];
    var step = yMax <= 30 ? 5 : yMax <= 60 ? 10 : 20;
    for (var t = step; t <= yMax; t += step) ticks.push(t);
    ticks.forEach(function (tv) {
      el("line", { x1: M.l, x2: M.l + iw, y1: y(tv), y2: y(tv), stroke: "#0d0d0d", "stroke-opacity": tv === 10 ? "0.25" : "0.08", "stroke-width": "1" }, svg);
      var tx = el("text", { x: M.l - 8, y: y(tv) + 3.5, "text-anchor": "end", fill: "var(--muted)", "font-family": "DM Mono, monospace", "font-size": "10" }, svg);
      tx.textContent = tv;
    });

    // X ticks (about 5)
    var span = d1 - d0, nT = W < 520 ? 3 : 5;
    for (var i = 0; i <= nT; i++) {
      var dd = Math.round(d0 + (span * i) / nT);
      var lab = el("text", { x: x(dd), y: H - 8, "text-anchor": i === 0 ? "start" : i === nT ? "end" : "middle", fill: "var(--muted)", "font-family": "DM Mono, monospace", "font-size": "10" }, svg);
      lab.textContent = fmtDateShort(isoFromDay(dd));
    }

    // 7-day rolling average (impression-weighted) — the main line
    pts.forEach(function (h, idx) {
      var dN = dayNum(h.date), wsum = 0, psum = 0;
      for (var k = idx; k >= 0 && dN - dayNum(pts[k].date) < 7; k--) {
        var q = pts[k];
        if (q.position == null) continue;
        var w = Math.max(1, q.impressions || 1);
        wsum += w; psum += q.position * w;
      }
      h._avg = wsum ? psum / wsum : null;
    });

    // Daily values — faint dots behind the line
    withPos.forEach(function (h) {
      el("circle", { cx: x(dayNum(h.date)), cy: y(h.position), r: 2, fill: "var(--accent2)", "fill-opacity": "0.22" }, svg);
    });

    // Rolling line, broken where there has been no data for 7 days
    var segs = [], cur = [];
    pts.forEach(function (h) {
      if (h._avg == null) { if (cur.length) segs.push(cur); cur = []; return; }
      cur.push(h);
    });
    if (cur.length) segs.push(cur);
    segs.forEach(function (s) {
      if (s.length === 1) {
        el("circle", { cx: x(dayNum(s[0].date)), cy: y(s[0]._avg), r: 2.5, fill: "var(--accent2)" }, svg);
        return;
      }
      var dstr = s.map(function (h, j) { return (j ? "L" : "M") + x(dayNum(h.date)).toFixed(1) + "," + y(h._avg).toFixed(1); }).join("");
      el("path", { d: dstr, fill: "none", stroke: "var(--accent2)", "stroke-width": "2", "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    });

    // End marker + label (latest rolling value)
    var lastAvg = pts.filter(function (h) { return h._avg != null; }).pop();
    var last = lastAvg || withPos[withPos.length - 1];
    var lastVal = lastAvg ? last._avg : last.position;
    el("circle", { cx: x(dayNum(last.date)), cy: y(lastVal), r: 4.5, fill: "var(--accent2)", stroke: "#fff", "stroke-width": "2" }, svg);
    var endLab = el("text", { x: x(dayNum(last.date)) + 9, y: y(lastVal) + 4, fill: "var(--ink)", "font-family": "DM Sans, sans-serif", "font-size": "12", "font-weight": "600" }, svg);
    endLab.textContent = fmtPos(lastVal);

    // Hover layer
    var cross = el("line", { y1: M.t, y2: M.t + ih, stroke: "#0d0d0d", "stroke-opacity": "0.35", "stroke-width": "1", visibility: "hidden" }, svg);
    var dot = el("circle", { r: 4.5, fill: "var(--accent2)", stroke: "#fff", "stroke-width": "2", visibility: "hidden" }, svg);
    var hit = el("rect", { x: M.l, y: 0, width: iw, height: H, fill: "transparent" }, svg);
    var legend = document.createElement("div");
    legend.className = "seo-legend";
    legend.innerHTML = '<span><i class="seo-lg-line"></i>7-day average</span><span><i class="seo-lg-dot"></i>Daily position</span>';
    host.appendChild(legend);
    host.appendChild(svg);

    var tip = document.createElement("div");
    tip.className = "seo-tip";
    tip.setAttribute("aria-hidden", "true");
    var tDate = document.createElement("div"); tDate.className = "seo-tip-date";
    var tRow = document.createElement("div"); tRow.className = "seo-tip-row";
    var tKey = document.createElement("span"); tKey.className = "seo-tip-key";
    var tVal = document.createElement("span"); tVal.className = "seo-tip-val";
    var tSub = document.createElement("div"); tSub.className = "seo-tip-sub";
    tRow.appendChild(tKey); tRow.appendChild(tVal);
    tip.appendChild(tDate); tip.appendChild(tRow); tip.appendChild(tSub);
    host.appendChild(tip);

    var focusIdx = pts.length - 1;
    function showAt(idx) {
      idx = Math.max(0, Math.min(pts.length - 1, idx));
      focusIdx = idx;
      var h = pts[idx];
      var cx = x(dayNum(h.date));
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
      cross.setAttribute("visibility", "visible");
      if (h._avg != null) {
        dot.setAttribute("cx", cx); dot.setAttribute("cy", y(h._avg));
        dot.setAttribute("visibility", "visible");
      } else {
        dot.setAttribute("visibility", "hidden");
      }
      tDate.textContent = fmtDate(h.date);
      tVal.textContent = h._avg != null ? fmtPos(h._avg) + " · 7-day avg" : "No data";
      tSub.textContent = (h.position != null ? "That day: position " + fmtPos(h.position) : "That day: not shown in Google") +
        " · " + fmtInt(h.impressions || 0) + " impr · " + fmtInt(h.clicks || 0) + " clicks";
      var scale = host.clientWidth / W;
      var px = cx * scale, tw = tip.offsetWidth || 160;
      var left = px + 12 + tw > host.clientWidth ? px - tw - 12 : px + 12;
      tip.style.left = Math.max(4, left) + "px";
      tip.style.top = "14px";
      tip.style.opacity = "1";
    }
    function hide() {
      cross.setAttribute("visibility", "hidden");
      dot.setAttribute("visibility", "hidden");
      tip.style.opacity = "0";
    }
    function nearest(evt) {
      var r = svg.getBoundingClientRect();
      var sx = ((evt.clientX - r.left) / r.width) * W;
      var day = d0 + ((sx - M.l) / iw) * (d1 - d0);
      var best = 0, bd = Infinity;
      pts.forEach(function (h, i2) {
        var dist = Math.abs(dayNum(h.date) - day);
        if (dist < bd) { bd = dist; best = i2; }
      });
      return best;
    }
    hit.addEventListener("pointermove", function (e) { showAt(nearest(e)); });
    hit.addEventListener("pointerdown", function (e) { showAt(nearest(e)); });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", function () { showAt(focusIdx); });
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { showAt(focusIdx - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { showAt(focusIdx + 1); e.preventDefault(); }
    });

    // Accessible table view
    var det = document.createElement("details");
    det.className = "seo-details";
    var sum = document.createElement("summary");
    sum.textContent = "View as table";
    det.appendChild(sum);
    var rows = withPos.slice().reverse().map(function (h) {
      return "<tr><td>" + esc(fmtDate(h.date)) + '</td><td class="num">' + esc(fmtPos(h.position)) +
        '</td><td class="num">' + esc(fmtInt(h.impressions)) + '</td><td class="num">' + esc(fmtInt(h.clicks)) + "</td></tr>";
    }).join("");
    var wrap = document.createElement("div");
    wrap.className = "seo-table-wrap";
    wrap.innerHTML = '<table class="seo-table"><thead><tr><th>Date</th><th class="num">Position</th><th class="num">Impressions</th><th class="num">Clicks</th></tr></thead><tbody>' + rows + "</tbody></table>";
    det.appendChild(wrap);
    host.appendChild(det);
  }

  /* ─────────── sections ─────────── */
  function toolbarHtml(data) {
    var m = (data.markets || []).map(function (mk) {
      return '<button type="button" data-market="' + esc(mk.id) + '" aria-pressed="' + (mk.id === state.market) + '">' + esc(mk.label) + "</button>";
    }).join("");
    var r = RANGES.map(function (rg) {
      return '<button type="button" data-range="' + rg.id + '" aria-pressed="' + (rg.id === state.range) + '">' + rg.label + "</button>";
    }).join("");
    return (
      '<div class="seo-toolbar">' +
      '<div class="seo-seg" role="group" aria-label="Google market"><span class="seo-seg-label">Market</span>' + m + "</div>" +
      '<div class="seo-seg" role="group" aria-label="Chart period"><span class="seo-seg-label">Period</span>' + r + "</div>" +
      "</div>"
    );
  }

  function cardsHtml(data) {
    return '<div class="seo-cards" role="group" aria-label="Tracked keywords">' +
      (data.keywords || []).map(function (kw) {
        var mb = marketBlock(kw) || {};
        var c = mb.current || {}, p = mb.previous || {};
        var onP1 = c.position != null && c.position <= 10.5;
        return (
          '<button type="button" class="seo-card" data-keyword="' + esc(kw.keyword) + '" aria-pressed="' + (kw.keyword === state.keyword) + '">' +
          '<span class="seo-card-kw">' + esc(kw.label || kw.keyword) + (kw.target ? '<span class="seo-tag">Target</span>' : "") + "</span>" +
          '<span class="seo-card-pos">' + esc(fmtPos(c.position)) + "<small>avg position</small></span>" +
          deltaHtml(c.position, p.position) +
          '<span><span class="seo-p1' + (onP1 ? "" : " seo-p1--off") + '">' + (onP1 ? "Page 1" : c.position != null ? "Page " + Math.ceil(c.position / 10) : "Not ranking") + "</span></span>" +
          '<span class="seo-card-sub">' + esc(fmtInt(c.impressions)) + " impr · " + esc(fmtInt(c.clicks)) + (c.clicks === 1 ? " click" : " clicks") + " · 7d</span>" +
          "</button>"
        );
      }).join("") + "</div>";
  }

  function pagesHtml(mb) {
    var pages = (mb && mb.pages) || [];
    if (!pages.length) return '<p class="seo-empty">None of our pages appeared in Google for this keyword in the last 7 days.</p>';
    var rows = pages.slice().sort(function (a, b) { return (a.position || 999) - (b.position || 999); }).map(function (pg) {
      return (
        "<tr>" +
        '<td class="rank">' + esc(fmtPos(pg.position)) + "</td>" +
        '<td><a href="' + esc(safeUrl(pg.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(pg.title || pathOf(pg.url)) + "</a>" +
        '<span class="seo-url">' + esc(pathOf(pg.url)) + "</span></td>" +
        '<td class="num">' + deltaHtml(pg.position, pg.previousPosition) + "</td>" +
        '<td class="num seo-hide-sm">' + esc(fmtInt(pg.impressions)) + "</td>" +
        '<td class="num seo-hide-sm">' + esc(fmtInt(pg.clicks)) + "</td>" +
        "</tr>"
      );
    }).join("");
    return (
      '<div class="seo-table-wrap"><table class="seo-table"><thead><tr>' +
      '<th scope="col">Position</th><th scope="col">Article</th><th scope="col" class="num">vs prior 7d</th>' +
      '<th scope="col" class="num seo-hide-sm">Impressions</th><th scope="col" class="num seo-hide-sm">Clicks</th>' +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="seo-footnote">Position = Search Console average position for this article on this keyword, last 7 days. When several of our articles rank for one keyword they can compete with each other.</p>'
    );
  }

  function competitorsHtml(kw, mb, data) {
    var comp = mb && mb.competitors;
    var srcMarket = state.market;
    if (!comp) {
      var hk = kw.markets && kw.markets.hkg;
      if (hk && hk.competitors) { comp = hk.competitors; srcMarket = "hkg"; }
    }
    if (!comp || !comp.list || !comp.list.length) {
      return '<p class="seo-empty">No competitor check has run for this keyword yet.</p>';
    }
    var ours = mb && mb.current ? mb.current.position : null;
    var ourDomain = data.ourDomain || "thebay.mo";
    var selfSeen = comp.list.filter(function (c) { return String(c.domain || "").indexOf(ourDomain) !== -1; })[0];
    var above = comp.list.filter(function (c) {
      if (String(c.domain || "").indexOf(ourDomain) !== -1) return false;
      return ours == null ? true : c.position < ours;
    }).sort(function (a, b) { return a.position - b.position; });

    var rows = above.map(function (c) {
      return (
        "<tr>" +
        '<td class="rank">' + esc(c.position) + "</td>" +
        '<td><a href="' + esc(safeUrl(c.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(c.title || c.domain) + "</a>" +
        (c.verified === false ? '<span class="seo-flag" title="Link could not be confirmed live">UNCONFIRMED LINK</span>' : "") +
        '<span class="seo-url">' + esc(c.domain || pathOf(c.url)) + "</span>" +
        (c.note ? '<span class="seo-note">' + esc(c.note) + "</span>" : "") +
        '<span class="seo-show-sm"><span class="seo-type">' + esc(TYPE_LABELS[c.type] || c.type || "Other") + "</span></span>" +
        "</td>" +
        '<td class="seo-hide-sm"><span class="seo-type">' + esc(TYPE_LABELS[c.type] || c.type || "Other") + "</span></td>" +
        "</tr>"
      );
    }).join("");
    rows +=
      '<tr class="seo-us"><td class="rank">' + esc(ours != null ? fmtPos(ours) : "—") + "</td>" +
      "<td>The Bay<span class=\"seo-url\">" + esc(ourDomain) + " · Search Console average</span></td>" +
      '<td class="seo-hide-sm"><span class="seo-type">News publisher</span></td></tr>';

    var marketLabel = ((data.markets || []).filter(function (m) { return m.id === srcMarket; })[0] || {}).label || srcMarket;
    var note = srcMarket !== state.market ? " Showing " + marketLabel + " results — competitors are not checked for this market." : "";
    return (
      '<div class="seo-table-wrap"><table class="seo-table"><thead><tr>' +
      '<th scope="col">Rank</th><th scope="col">Who</th><th scope="col" class="seo-hide-sm">What it is</th>' +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="seo-footnote">' +
      (above.length ? above.length + " result" + (above.length === 1 ? "" : "s") + " ranking above us." : "Nobody in the checked results ranks above us.") +
      " Competitor ranks are AI-estimated (" + esc(comp.source || "Cursor agent") + ", " + esc(marketLabel) + ", checked " + esc(fmtDate(comp.checkedAt)) +
      ") and may differ from what an individual sees in Google. Our position is from Search Console." + esc(note) +
      "</p>"
    );
  }

  /* ─────────── render ─────────── */
  function render() {
    var data = state.data;
    var kws = data.keywords || [];
    if (!kws.length) {
      root.innerHTML = '<p class="seo-empty">No keywords configured. Edit <code>references/seo-keywords.json</code>.</p>';
      return;
    }
    var marketIds = (data.markets || []).map(function (m) { return m.id; });
    if (marketIds.indexOf(state.market) === -1) state.market = marketIds[0];
    if (!kws.some(function (k) { return k.keyword === state.keyword; })) {
      state.keyword = (kws.filter(function (k) { return k.target; })[0] || kws[0]).keyword;
    }
    if (!RANGES.some(function (r) { return r.id === state.range; })) state.range = "90";
    var kw = kws.filter(function (k) { return k.keyword === state.keyword; })[0];
    var mb = marketBlock(kw);
    var marketLabel = ((data.markets || []).filter(function (m) { return m.id === state.market; })[0] || {}).label;

    var meta = document.getElementById("seo-rankings-meta");
    if (meta) {
      meta.textContent = "Search Console data to " + fmtDate(data.gsc && data.gsc.dataThrough) +
        " · refreshed " + (data.refreshedAtLabel || fmtDate(data.updatedAt)) + " · " + kws.length + " keywords";
    }

    var html = "";
    if (data.sample) {
      html += '<p class="seo-sample"><strong>Sample data.</strong> These numbers are placeholders to preview the layout. Run the <code>SEO rankings</code> workflow once to load real Search Console data.</p>';
    }
    html += toolbarHtml(data) + cardsHtml(data);
    html +=
      '<section class="seo-section"><h3>Position over time · ' + esc(kw.label || kw.keyword) + " · " + esc(marketLabel) + "</h3>" +
      '<p class="seo-lede">Google position for thebay.mo, as a 7-day average with daily values behind it. Lower is better; the shaded band is page 1. Gaps mean we did not appear for a week.</p>' +
      '<div class="seo-chart" id="seo-chart-host"></div></section>';
    html +=
      '<section class="seo-section"><h3>Our articles ranking for this keyword</h3>' + pagesHtml(mb) + "</section>";
    html +=
      '<section class="seo-section"><h3>Who ranks above us</h3>' +
      '<p class="seo-lede">Pages Google shows ahead of The Bay for “' + esc(kw.label || kw.keyword) + '”. Links open the competing page.</p>' +
      competitorsHtml(kw, mb, data) + "</section>";
    root.innerHTML = html;

    var rg = RANGES.filter(function (r) { return r.id === state.range; })[0];
    drawChart(document.getElementById("seo-chart-host"), mb ? mb.history : [], rg.days);

    root.querySelectorAll("[data-market]").forEach(function (b) {
      b.addEventListener("click", function () { state.market = b.getAttribute("data-market"); persist(); render(); });
    });
    root.querySelectorAll("[data-range]").forEach(function (b) {
      b.addEventListener("click", function () { state.range = b.getAttribute("data-range"); persist(); render(); });
    });
    root.querySelectorAll("[data-keyword]").forEach(function (b) {
      b.addEventListener("click", function () { state.keyword = b.getAttribute("data-keyword"); persist(); render(); });
    });
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    if (!state.data) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var host = document.getElementById("seo-chart-host");
      if (!host || !host.offsetParent) return;
      render();
    }, 150);
  });
  // Re-render when the tab becomes visible (chart width is 0 while hidden)
  var panel = document.getElementById("panel-seoranks");
  if (panel && window.MutationObserver) {
    new MutationObserver(function () {
      if (!panel.hidden && state.data) render();
    }).observe(panel, { attributes: true, attributeFilter: ["hidden", "class"] });
  }

  function start(data) {
    injectStyles();
    state.data = data;
    render();
  }

  injectStyles();
  if (window.SEO_RANKINGS_DATA) {
    start(window.SEO_RANKINGS_DATA);
    return;
  }
  fetch("seo-rankings-data.json?v=" + encodeURIComponent(DATA_V))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(start)
    .catch(function (err) {
      root.innerHTML =
        '<p class="seo-err">Could not load SEO rankings (' + esc(err.message) +
        "). Run <code>node scripts/capture-seo-rankings.mjs</code> or the SEO rankings workflow.</p>";
    });
})();
