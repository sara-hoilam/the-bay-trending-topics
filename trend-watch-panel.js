/**
 * Renders Trend Watch from embedded JSON (#trend-watch-data) into #trend-watch-root.
 * Scoped for GBA Pulse panel #panel-trendwatch (tw-* classes).
 */
(function () {
  var RANK_SLOTS = 5;

  var BRAND = {
    google_trends: { title: "Google Trends", accent: "#4285f4", iconId: "tw-icon-google-trends" },
    baidu: { title: "Baidu", accent: "#2932e1", iconId: "tw-icon-baidu" },
    weibo: { title: "Weibo", accent: "#e6162d", iconId: "tw-icon-weibo" },
  };

  var GOSSIP_KEYWORDS =
    /恋情|绯闻|出轨|分手|复合|八卦|吃瓜|秘婚|私生|離婚|离婚|搭伙|世纪婚礼|视后|影帝|艳照|偷情|小三|浪姐|抄袭|新歌.*抄袭|综艺.*导演|豪门|星闻|娛樂|娱乐八卦|秘嫁|闊太|前無綫小花|暴食減肥/i;

  /** Google Trends: topics that must never be treated as gossip. */
  var NEWS_TOPIC =
    /派位|統一|小一|小\s*一|存款|利率|定期|天氣|低氣|氣壓|風球|预警|署|局|院|政策|新规|雨|风|驾驶|试验|频率|获批|报警|造谣|投资|电动车|雷暴|大风|武契奇|勋章|友谊|去世|離世|病逝|訃|享年|sir|finals|ticketmaster|酒家|防長|外交|选举|考試|放榜|誤發|短訊/i;

  /**
   * Baidu / Weibo — The Bay bar: GBA-relevant policy, diplomacy, tech, weather, business.
   * Skip local viral human-interest, entertainment nostalgia, micro-dramas.
   */
  var NEWSWORTHY =
    /新规|规则|立法|条例|规定|政策|驾驶|获批|试验|频率|6G|5G|AI|人工智能|豆包|Doubao|芯片|半导体|电动车|法拉利|苹果|利率|存款|税|经济|GDP|股市|银行|外交|总统|部长|协议|勋章|武契奇|国防|制裁|贸易|台风|雷暴|大风|暴雨|预警|极端|气象|天气|香港|澳门|港澳|大湾区|粤港|横琴|派位|統一|小一|小\s*一|入境|通关|口岸|监管|央行|发改委|国务院|环球|国际|全球|文化|使命|考古|三星堆|会晤|红线|汛期/i;

  var LOCAL_VIRAL =
    /大哥|赊.*面|砸店|崩溃痛哭|光伏板|亲戚|灵魂摆渡|瘦腿|膝盖|酒家|博主|嫌贵|找碴|暴食|减肥|秘嫁|阔太|综艺|重播|播出|电视剧|网剧|粉丝|网红|相亲|离婚|恋情|绯闻|抄袭|新歌|砸|痛哭|老宅|偷装|造谣者|学校已报警/i;

  /** GBA: HK, Macao, nine Guangdong municipalities + cross-border GBA terms. */
  var GBA_LOCAL =
    /香港|Hong Kong|港人|港府|港媒|港铁|港岛|九龙|新界|Macau|Macao|澳门|澳門|氹仔|路环|横琴|前海|南沙|河套|北向|港珠澳|通关|口岸|大湾区|粤港澳|珠三角|GBA|粤港|粤澳|广东|Guangdong|广州|Guangzhou|廣州|深圳|Shenzhen|珠海|佛山|Foshan|惠州|东莞|東莞|中山|江门|江門|肇庆|肇慶|白云|Baiyun|罗湖|福田|南山|宝安|龙岗|黄埔|番禺|顺德|香洲|金湾|斗门|比亚迪|BYD|全红婵|何猷君/i;

  /**
   * Major national / China-wide stories that qualify without a GBA place name
   * (e.g. Trump state visit, cross-strait, nationwide policy).
   */
  var MAJOR_NATIONAL =
    /特朗普|Trump|拜登|Biden|中美元首|习.*(访|会晤|通话)|国事访问|国台办|台海|两岸|中美|中俄|国务院|全国人大|政协|央行|发改委|全国.*(高考|考)|高考|1290万|民生|公积金|育儿|住房.*红包|芯片|半导体|黄仁勋|Jensen|Huang|制裁|贸易战|关税|台灣|台湾问题|两军|夏威夷|阅兵|6G|试验.*获批|获批.*频率|地震.*(广东|粤)|广东.*地震|台风.*(广东|粤|港|澳)|广东.*台风/i;

  function gbaAutoMatch(blob) {
    return GBA_LOCAL.test(blob) || MAJOR_NATIONAL.test(blob);
  }

  var WEIBO_BOARDS = {
    realtimehot: {
      label: "Realtime hot",
      url: "https://s.weibo.com/top/summary?cate=realtimehot",
    },
    tech: {
      label: "Tech",
      url: "https://s.weibo.com/top/summary?cate=tech",
    },
  };

  function esc(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function iconBlock(id) {
    return '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function sortItems(items) {
    return (items || []).slice().sort(function (a, b) {
      var ra = a.rank != null ? a.rank : 999;
      var rb = b.rank != null ? b.rank : 999;
      return ra - rb;
    });
  }

  function isRowEmpty(it) {
    if (!it || !it.title) return true;
    var t = String(it.title).trim();
    return t === "" || t === "—";
  }

  function isGossipItem(it) {
    if (!it || isRowEmpty(it)) return false;
    if (it.isGossip === true) return true;
    if (it.isGossip === false) return false;
    var t = String(it.title).trim();
    if (NEWS_TOPIC.test(t)) return false;
    if (GOSSIP_KEYWORDS.test(t)) return true;
    return false;
  }

  function itemTextBlob(it) {
    if (!it) return "";
    return [it.title, it.titleEn, it.whyTrending, it.summary]
      .filter(function (s) {
        return s != null && String(s).trim() !== "";
      })
      .join(" ");
  }

  function hasGbaGoogleHit(candidate) {
    if (!candidate || !candidate.platformHits) return false;
    var hits = candidate.platformHits;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.platform === "google_trends" && (h.geo === "HK" || h.geo === "MO")) return true;
    }
    return false;
  }

  function candidateGbaOk(c) {
    if (!c) return false;
    if (c.isGbaRelevant === true) return true;
    if (c.isGbaRelevant === false || c.gbaRelevance === "low") return false;
    if (c.gbaRelevance === "high" || c.gbaRelevance === "medium") return true;
    return hasGbaGoogleHit(c);
  }

  function isGbaRelevantItem(it, data, secId, geoId, candidate) {
    if (!it || isRowEmpty(it)) return false;
    if (it.isGbaRelevant === true) return true;

    var c =
      candidate ||
      (data && secId ? findCandidate(data, it.title, secId, geoId || it.geoId || it.geo) : null);
    if (candidateGbaOk(c)) return true;
    if (hasGbaGoogleHit(c)) return true;

    var g = it.geoId || it.geo || geoId;
    if (g === "HK" || g === "MO") return true;

    var blob = itemTextBlob(it);
    if (c && c.whyTrending) blob += " " + String(c.whyTrending);
    if (gbaAutoMatch(blob)) return true;

    if (it.isGbaRelevant === false) return false;
    if (c && (c.isGbaRelevant === false || c.gbaRelevance === "low")) return false;
    return false;
  }

  /** Weibo deep scan: auto-detect GBA/national in title or whyTrending even when flags were omitted. */
  function isNewsworthyAuto(it) {
    if (!it || isRowEmpty(it)) return false;
    if (it.isGossip === true) return false;
    var blob = itemTextBlob(it);
    if (LOCAL_VIRAL.test(blob) || GOSSIP_KEYWORDS.test(blob)) return false;
    if (it.isNewsworthy === true) return true;
    if (NEWSWORTHY.test(blob) || NEWS_TOPIC.test(blob) || gbaAutoMatch(blob)) return true;
    if (it.isNewsworthy === false) return false;
    return false;
  }

  function passesWeiboDeepFilter(it, data) {
    return isNewsworthyAuto(it) && isGbaRelevantItem(it, data, "weibo", null, null);
  }

  function isNewsworthyItem(it) {
    if (!it || isRowEmpty(it)) return false;
    if (it.isNewsworthy === true) return true;
    if (it.isNewsworthy === false) return false;
    if (it.isGossip === true) return false;
    var blob = itemTextBlob(it);
    if (LOCAL_VIRAL.test(blob)) return false;
    if (GOSSIP_KEYWORDS.test(blob)) return false;
    if (NEWSWORTHY.test(blob)) return true;
    return false;
  }

  function passesPlatformFilter(it, secId, data, geoId) {
    if (secId === "baidu" || secId === "weibo") {
      if (it.isGossip === true) return false;
      var c = findCandidate(data, it.title, secId, geoId);
      if (c && (c.isGossip === true || c.gbaRelevance === "low")) return false;
      if (candidateGbaOk(c)) {
        return isNewsworthyItem(it) || isNewsworthyAuto(it);
      }
      return isNewsworthyItem(it) && isGbaRelevantItem(it, data, secId, geoId, c);
    }
    if (it.isGossip === true) return false;
    return !isGossipItem(it);
  }

  function isGossipCandidate(c) {
    if (!c) return false;
    if (c.isGossip === true) return true;
    if (c.isGossip === false) return false;
    return isGossipItem({ title: c.displayTitle });
  }

  function isNewsworthyCandidate(c, secId, data) {
    if (!c) return false;
    if (secId === "baidu" || secId === "weibo") {
      var stub = {
        title: c.displayTitle,
        whyTrending: c.whyTrending,
        titleEn: c.titleEn,
        isGossip: c.isGossip,
        isNewsworthy: c.isNewsworthy,
        isGbaRelevant: c.isGbaRelevant,
      };
      return isNewsworthyItem(stub) && isGbaRelevantItem(stub, data, secId, null, c);
    }
    return !isGossipCandidate(c);
  }

  function getWeiboItems(sec) {
    var pool = [];
    (sec.items || []).forEach(function (it) {
      pool.push(Object.assign({}, it, { boardId: it.boardId || "realtimehot" }));
    });
    var byBoard = sec.itemsByBoard || {};
    Object.keys(byBoard).forEach(function (boardId) {
      sortItems(byBoard[boardId]).forEach(function (it) {
        pool.push(Object.assign({}, it, { boardId: it.boardId || boardId }));
      });
    });
    return pool;
  }

  function getSectionItems(sec) {
    if (sec.id === "weibo") return getWeiboItems(sec);
    return sec.items || [];
  }

  function buildTrendingNowUrl(geoId) {
    return (
      "https://trends.google.com/trending?geo=" +
      encodeURIComponent(geoId) +
      "&sort=search-volume&hours=48"
    );
  }

  var BOARD_URLS = {
    baidu: "https://top.baidu.com/board?tab=realtime",
    weibo: "https://s.weibo.com/top/summary?cate=realtimehot",
  };

  function buildBoardUrl(sec, locMeta) {
    if (sec.id === "google_trends") {
      if (locMeta && locMeta.id) return buildTrendingNowUrl(locMeta.id);
      return buildTrendingNowUrl("HK");
    }
    if (BOARD_URLS[sec.id]) {
      return BOARD_URLS[sec.id];
    }
    if (sec.sourceUrl) {
      return String(sec.sourceUrl).replace(/hours=4\b/, "hours=48");
    }
    return "#";
  }

  function buildGoogleSearchUrl(title) {
    if (!title || title === "—") return null;
    return "https://www.google.com/search?q=" + encodeURIComponent(String(title).trim());
  }

  /** Topic title ↗ opens Google Search with the keyword (all boards). */
  function buildTopicLiveUrl(secId, geoId, title) {
    return buildGoogleSearchUrl(title);
  }

  function getGoogleItems(sec, locId) {
    var map = sec.itemsByLocation || {};
    if (map[locId] && map[locId].length) return map[locId];
    return sec.items || [];
  }

  function googleLocationMeta(sec, id) {
    var locs = sec.locations || [];
    for (var i = 0; i < locs.length; i++) {
      if (locs[i].id === id) return locs[i];
    }
    return null;
  }

  function normalizeVolumeDisplay(raw) {
    var s = String(raw || "").trim();
    if (!s || s === "—") return "—";
    if (s.indexOf("not available") !== -1) return "—";
    s = s.replace(/\s*searches\s*$/i, "");
    s = s.replace(/\s*search volume\s*$/i, "");
    s = s.replace(/\s*热度\s*$/g, "");
    s = s.replace(/\s*热搜指数\s*$/g, "");
    return s.trim() || "—";
  }

  function volumeForItem(it) {
    if (!it) return "—";
    if (it.searchVolume != null && String(it.searchVolume).trim() !== "") {
      return normalizeVolumeDisplay(it.searchVolume);
    }
    if (it.volumeLabel != null && String(it.volumeLabel).trim() !== "") {
      return normalizeVolumeDisplay(it.volumeLabel);
    }
    return "—";
  }

  function whyForItem(it, candidate) {
    if (it && it.whyTrending) return String(it.whyTrending).trim();
    if (it && it.summary) return String(it.summary).trim();
    if (candidate && candidate.whyTrending) return String(candidate.whyTrending).trim();
    return "";
  }

  function titleEnForItem(it, candidate) {
    if (it && it.titleEn) return String(it.titleEn).trim();
    if (candidate && candidate.titleEn) return String(candidate.titleEn).trim();
    return "";
  }

  function needsTitleTranslation(title) {
    if (!title || title === "—") return false;
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(title);
  }

  function renderTitleBlock(title, titleEn, why, liveUrl, empty) {
    var showEn = needsTitleTranslation(title) && titleEn;
    var html =
      '<div class="tw-topic-title-wrap"' +
      (why ? " data-has-tip" : "") +
      ' tabindex="0">';

    if (liveUrl && !empty) {
      html +=
        '<a class="tw-topic-title tw-topic-title-link" href="' +
        esc(liveUrl) +
        '" target="_blank" rel="noopener noreferrer" data-search-query="' +
        esc(title) +
        '" title="Copy keyword and search on Google">' +
        esc(title) +
        " ↗</a>";
    } else {
      html += '<div class="tw-topic-title">' + esc(title) + "</div>";
    }

    if (showEn) {
      html += '<div class="tw-topic-title-en">' + esc(titleEn) + "</div>";
    }

    if (why) {
      html += '<div class="tw-topic-tip" role="tooltip">' + esc(why) + "</div>";
    }

    html += "</div>";
    return html;
  }

  function findCandidate(data, title, secId, geoId) {
    var key = String(title || "").trim().toLowerCase();
    var list = data.topicCandidates || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (String(c.displayTitle || "").trim().toLowerCase() === key) return c;
      var hits = c.platformHits || [];
      for (var j = 0; j < hits.length; j++) {
        var h = hits[j];
        if (String(h.title || "").trim().toLowerCase() !== key) continue;
        if (secId === "google_trends" && h.platform === "google_trends" && h.geo === geoId) return c;
        if (secId !== "google_trends" && h.platform === secId) return c;
      }
    }
    return null;
  }

  function backfillFromCandidates(data, secId, geoId, seen) {
    var allowedTitles = null;
    if (secId === "baidu" || secId === "weibo") {
      allowedTitles = new Set();
      (data.sections || []).forEach(function (sec) {
        if (sec.id !== secId) return;
        getSectionItems(sec).forEach(function (it) {
          if (it && it.title) allowedTitles.add(String(it.title).trim());
        });
      });
    }
    var out = [];
    (data.topicCandidates || []).forEach(function (c) {
      if (out.length + seen.size >= RANK_SLOTS * 2) return;
      if (secId === "google_trends") {
        if (isGossipCandidate(c)) return;
      } else if (!isNewsworthyCandidate(c, secId, data)) {
        return;
      }
      var hit = null;
      (c.platformHits || []).forEach(function (h) {
        if (hit) return;
        if (secId === "google_trends" && h.platform === "google_trends") {
          if (!geoId || h.geo === geoId) hit = h;
        } else if (secId !== "google_trends" && h.platform === secId) {
          hit = h;
        }
      });
      if (!hit) return;
      var title = c.displayTitle || hit.title;
      if (allowedTitles && !allowedTitles.has(String(title).trim())) return;
      var dedupeKey = secId === "google_trends" ? title + "|" + (hit.geo || geoId || "") : title;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      var itemGeo = hit.geo || geoId || "HK";
      out.push({
        rank: hit.rank,
        title: title,
        geoId: itemGeo,
        searchVolume: hit.searchVolume,
        volumeEstimate: hit.volumeEstimate,
        growthPercent: hit.growthPercent,
        whyTrending: c.whyTrending || "",
        titleEn: c.titleEn || "",
        pin: itemGeo === "HK" ? "📍🇭🇰" : itemGeo === "MO" ? "📍🇲🇴" : "📍🇨🇳",
      });
    });
    return out;
  }

  /**
   * Last-resort Weibo fill: mirror Baidu rows that pass GBA filters when the Weibo
   * board's top ranks are mostly entertainment (common capture gap).
   */
  function backfillWeiboFromBaidu(data, pool, seen) {
    if (pool.length >= RANK_SLOTS) return;
    var baiduSec = null;
    (data.sections || []).forEach(function (sec) {
      if (sec.id === "baidu") baiduSec = sec;
    });
    if (!baiduSec) return;
    sortItems(baiduSec.items || []).forEach(function (it) {
      if (pool.length >= RANK_SLOTS) return;
      if (!it || !it.title || seen.has(it.title)) return;
      if (!passesPlatformFilter(it, "baidu", data, null)) return;
      seen.add(it.title);
      pool.push(Object.assign({}, it, { pin: it.pin || "📍🇨🇳" }));
    });
  }

  function displayGoogleItems(data, sec) {
    var locs = (sec.locations || []).filter(function (loc) {
      return loc.id === "HK" || loc.id === "MO";
    });
    if (!locs.length) locs = sec.locations || [];
    var pool = [];
    locs.forEach(function (loc) {
      sortItems(getGoogleItems(sec, loc.id)).forEach(function (it) {
        if (isRowEmpty(it) || isGossipItem(it) || it.isGossip === true) return;
        pool.push(Object.assign({}, it, { geoId: it.geoId || it.geo || loc.id }));
      });
    });
    var seen = new Set(
      pool.map(function (it) {
        return it.title + "|" + (it.geoId || "");
      })
    );
    if (pool.length < RANK_SLOTS) {
      backfillFromCandidates(data, "google_trends", null, seen).forEach(function (it) {
        if (pool.length < RANK_SLOTS) pool.push(it);
      });
    }
    pool.sort(function (a, b) {
      var va = a.volumeEstimate != null ? a.volumeEstimate : 0;
      var vb = b.volumeEstimate != null ? b.volumeEstimate : 0;
      if (vb !== va) return vb - va;
      return (a.rank || 999) - (b.rank || 999);
    });
    var rows = [];
    for (var i = 0; i < RANK_SLOTS; i++) {
      rows.push(pool[i] || null);
    }
    return rows;
  }

  function displayItems(data, sec, geoId) {
    if (sec.id === "google_trends") return displayGoogleItems(data, sec);
    var secId = sec.id;
    var raw = getSectionItems(sec);
    var pool = sortItems(raw).filter(function (it) {
      return !isRowEmpty(it) && passesPlatformFilter(it, secId, data, geoId);
    });
    if (secId === "weibo") {
      var byTitle = {};
      pool.forEach(function (it) {
        var key = it.title;
        if (!byTitle[key] || (it.volumeEstimate || 0) > (byTitle[key].volumeEstimate || 0)) {
          byTitle[key] = it;
        }
      });
      pool = Object.values(byTitle);
    }
    var seen = new Set(
      pool.map(function (it) {
        return it.title;
      })
    );
    if (pool.length < RANK_SLOTS) {
      backfillFromCandidates(data, secId, geoId, seen).forEach(function (it) {
        if (pool.length < RANK_SLOTS) pool.push(it);
      });
    }
    if (secId === "weibo" && pool.length < RANK_SLOTS) {
      sortItems(raw).forEach(function (it) {
        if (pool.length >= RANK_SLOTS) return;
        if (seen.has(it.title)) return;
        if (!passesWeiboDeepFilter(it, data)) return;
        seen.add(it.title);
        pool.push(it);
      });
    }
    if (secId === "weibo" && pool.length < RANK_SLOTS) {
      backfillWeiboFromBaidu(data, pool, seen);
    }
    pool.sort(function (a, b) {
      if (secId === "baidu" || secId === "weibo") {
        var va = a.volumeEstimate != null ? a.volumeEstimate : 0;
        var vb = b.volumeEstimate != null ? b.volumeEstimate : 0;
        if (vb !== va) return vb - va;
      }
      return (a.rank || 999) - (b.rank || 999);
    });
    var rows = [];
    for (var i = 0; i < RANK_SLOTS; i++) {
      rows.push(pool[i] || null);
    }
    return rows;
  }

  function pinForItem(it, geoId) {
    if (it && it.pin) return it.pin;
    var g = (it && (it.geoId || it.geo)) || geoId;
    if (g === "HK") return "📍🇭🇰";
    if (g === "MO") return "📍🇲🇴";
    return "📍🇨🇳";
  }

  function itemGeoId(it, geoId) {
    if (it && (it.geoId || it.geo)) return it.geoId || it.geo;
    return geoId || null;
  }

  function renderTopicCard(data, sec, locMeta, rank, it, geoId) {
    var empty = isRowEmpty(it);
    var title = empty ? "—" : it.title;
    var vol = volumeForItem(it);
    var itemGeo = empty ? geoId : itemGeoId(it, geoId);
    var pin = pinForItem(it, itemGeo);
    var secId = sec.id;
    var candidate = empty ? null : findCandidate(data, title, secId, itemGeo);
    var why = empty ? "" : whyForItem(it, candidate);
    var titleEn = empty ? "" : titleEnForItem(it, candidate);
    var liveUrl = empty ? null : buildTopicLiveUrl(secId, itemGeo, title);

    var cls = "tw-topic-card" + (empty ? " tw-is-empty" : " tw-has-volume");
    var html = '<div class="' + cls + '">';
    html += '<div class="tw-topic-card-main">';
    html += '<div class="tw-topic-rank">#' + rank + "</div>";
    html += renderTitleBlock(title, titleEn, why, liveUrl, empty);
    html += "</div>";
    html += '<div class="tw-topic-card-vol-col">';
    html += '<span class="tw-topic-pin-abs" aria-hidden="true">' + esc(pin) + "</span>";
    html += '<span class="tw-topic-vol-val">' + esc(vol) + "</span>";
    html += "</div>";
    html += "</div>";
    return html;
  }

  function renderGooglePanel(data, sec) {
    var b = BRAND.google_trends;
    var locs = sec.locations || [];
    var rows = displayGoogleItems(data, sec);
    var html =
      '<article class="tw-platform-panel" id="panel-google-trends" style="--panel-accent:' + esc(b.accent) + '">';
    html += '<header class="tw-panel-head">';
    html += '<div class="tw-brand-icon-wrap">' + iconBlock(b.iconId) + "</div>";
    html += '<div class="tw-panel-titles">';
    html += "<h2>" + esc(b.title) + "</h2>";
    html += '<div class="tw-board">' + esc(sec.boardLabel || "") + "</div>";
    if (sec.subtitle) html += '<p class="tw-panel-sub">' + esc(sec.subtitle) + "</p>";
    html += "</div></header>";
    html += '<div class="tw-panel-actions tw-panel-actions--boards">';
    for (var i = 0; i < locs.length; i++) {
      var loc = locs[i];
      var boardUrl = buildTrendingNowUrl(loc.id);
      html +=
        '<a class="tw-panel-open" href="' +
        esc(boardUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(loc.label || loc.id) +
        " ↗</a>";
    }
    html += "</div>";
    html += '<div class="tw-rank-stack">';
    for (var j = 0; j < rows.length; j++) {
      html += renderTopicCard(data, sec, null, j + 1, rows[j], null);
    }
    html += "</div></article>";
    return html;
  }

  function renderWeiboPanel(data, sec) {
    var b = BRAND.weibo;
    var rows = displayItems(data, sec, null);
    var sources = sec.boardSources || [
      { id: "realtimehot", label: "Realtime hot", url: WEIBO_BOARDS.realtimehot.url },
      { id: "tech", label: "Tech", url: WEIBO_BOARDS.tech.url },
    ];
    var html = '<article class="tw-platform-panel" id="tw-source-weibo">';
    html += '<header class="tw-panel-head">';
    html += '<div class="tw-brand-icon-wrap">' + iconBlock(b.iconId) + "</div>";
    html += '<div class="tw-panel-titles">';
    html += "<h2>" + esc(b.title) + "</h2>";
    html += '<div class="tw-board">' + esc(sec.boardLabel || "") + "</div>";
    if (sec.subtitle) html += '<p class="tw-panel-sub">' + esc(sec.subtitle) + "</p>";
    html += "</div></header>";
    html += '<div class="tw-panel-actions tw-panel-actions--boards">';
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      html +=
        '<a class="tw-panel-open" href="' +
        esc(src.url || "#") +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(src.label || src.id) +
        " ↗</a>";
    }
    html += "</div>";
    html += '<div class="tw-rank-stack">';
    for (var j = 0; j < rows.length; j++) {
      html += renderTopicCard(data, sec, null, j + 1, rows[j], null);
    }
    html += "</div></article>";
    return html;
  }

  function renderPanel(data, sec) {
    if (sec.id === "google_trends") {
      return renderGooglePanel(data, sec);
    }
    if (sec.id === "weibo") {
      return renderWeiboPanel(data, sec);
    }
    var b = BRAND[sec.id] || { title: sec.id, iconId: "tw-icon-google-trends" };
    var rows = displayItems(data, sec, null);
    var boardUrl = buildBoardUrl(sec, null);
    var html = '<article class="tw-platform-panel" id="tw-source-' + esc(sec.id) + '">';
    html += '<header class="tw-panel-head">';
    html += '<div class="tw-brand-icon-wrap">' + iconBlock(b.iconId) + "</div>";
    html += '<div class="tw-panel-titles">';
    html += "<h2>" + esc(b.title) + "</h2>";
    html += '<div class="tw-board">' + esc(sec.boardLabel || "") + "</div>";
    if (sec.subtitle) html += '<p class="tw-panel-sub">' + esc(sec.subtitle) + "</p>";
    html += "</div></header>";
    html += '<div class="tw-panel-actions">';
    html +=
      '<a class="tw-panel-open" href="' +
      esc(boardUrl) +
      '" target="_blank" rel="noopener noreferrer">View live board ↗</a>';
    html += "</div>";
    html += '<div class="tw-rank-stack">';
    for (var i = 0; i < rows.length; i++) {
      html += renderTopicCard(data, sec, null, i + 1, rows[i], null);
    }
    html += "</div></article>";
    return html;
  }

  function renderTrendWatchIntoRoot(data, root) {
    var sections = data.sections || [];
    var html = "";

    if (data.refreshedAtLabel || data.refreshedAt) {
      html +=
        '<p class="tw-meta-line">' + esc(data.refreshedAtLabel || data.refreshedAt || "") + "</p>";
    }

    if (data.disclaimer) {
      html += '<div class="tw-alert">' + esc(data.disclaimer) + "</div>";
    }

    html += '<div class="tw-dashboard"><div class="tw-platform-grid">';
    sections.forEach(function (sec) {
      html += renderPanel(data, sec);
    });
    html += "</div></div>";

    root.innerHTML = html;
  }

  function copySearchQuery(query) {
    if (!query) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(query).catch(function () {});
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = query;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (err) {
      /* clipboard unavailable */
    }
  }

  function attachTopicLinkCopy(root) {
    if (root._twCopyBound) return;
    root._twCopyBound = true;
    root.addEventListener("click", function (e) {
      var a = e.target.closest(".tw-topic-title-link");
      if (!a || !root.contains(a)) return;
      copySearchQuery(a.getAttribute("data-search-query") || "");
    });
  }

  function initTrendWatch() {
    var payloadEl = document.getElementById("trend-watch-data");
    var root = document.getElementById("trend-watch-root");
    if (!payloadEl || !root) return;
    try {
      var data = JSON.parse(payloadEl.textContent || "{}");
      renderTrendWatchIntoRoot(data, root);
      attachTopicLinkCopy(root);
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      root.innerHTML =
        '<div class="tw-err"><strong>Invalid trend watch JSON.</strong> ' + esc(msg) + "</div>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTrendWatch);
  } else {
    initTrendWatch();
  }
})();
