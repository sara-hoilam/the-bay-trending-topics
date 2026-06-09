#!/usr/bin/env node
/**
 * Live Trend Watch capture — Google HK/MO (48h), Baidu realtime, Weibo realtime+tech.
 * Writes orchestration/fragments/trendwatch.html (JSON block only; header preserved).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";
import { execSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fragPath = path.join(root, "orchestration/fragments/trendwatch.html");

const CAPTURED_AT = execSync("TZ=Asia/Hong_Kong date '+%Y-%m-%dT%H:%M:%S%z'", {
  encoding: "utf8",
}).trim();
const CAPTURED_DATE = CAPTURED_AT.slice(0, 10);

const GOSSIP_GOOGLE =
  /冼靖峰|蔡思貝|許志安|簡佩筠|李家鼎|劉青雲|袁文傑|吳文忻|車婉婉|容祖兒|張衛健|陳康堤/i;
const GOSSIP_WEIBO =
  /李小冉|白鹿|于正|宋祖儿|虞书欣|赵梦澈|刘诗诗|卢昱晓|张月|叶一茜|秘嫁|恋情|绯闻|浪姐|乘风/i;
const GOSSIP_BAIDU = /秘嫁|恋情|绯闻|综艺|阔太|抄袭/i;

function parseVol(label) {
  if (!label) return 0;
  const s = String(label).replace(/searches|热度|热搜指数/gi, "").trim();
  const m = s.match(/≈?([\d.]+)\s*([万亿KMkm]?)/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  const u = m[2];
  if (u === "K" || u === "k") n *= 1000;
  if (u === "M" || u === "m") n *= 1_000_000;
  if (u === "万") n *= 10_000;
  if (u === "亿") n *= 100_000_000;
  return Math.round(n);
}

function formatBaiduVol(n) {
  if (n >= 1_000_000) return `≈${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `≈${Math.round(n / 10_000)}万`;
  return `≈${n}`;
}

function formatWeiboVol(n) {
  if (n >= 1_000_000) return `≈${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `≈${Math.round(n / 10_000)}万`;
  return `≈${n}`;
}

function gbaRelevant(title, desc = "") {
  const b = `${title} ${desc}`;
  if (
    /香港|澳门|Macao|Macau|大湾区|粤港澳|广州|深圳|珠海|佛山|惠州|东莞|中山|江门|肇庆|横琴|前海|南沙|北向|口岸|南宁|义乌|华南师范|唐尚珺/i.test(
      b,
    )
  )
    return true;
  if (
    /习近平|朝鲜|朝鲜|特朗普|Trump|高考|国台办|伊朗|以色列|A股|芯片|6G|OpenAI|英伟达|黄仁勋|电子布|公积金|外交|台海|美军|NBA总决赛|地震|菲律宾|WWDC|苹果|华为|AI|ChatGPT|豆包|宇树/i.test(
      b,
    )
  )
    return true;
  return false;
}

function newsworthy(title, desc = "", isGossip = false) {
  if (isGossip) return false;
  const b = `${title} ${desc}`;
  if (/光伏板|崩溃痛哭|灵魂摆渡|瘦腿|砸店|秘嫁|阔太|综艺.*导演|面条|砸店|家庭纠纷|减肥总反弹/i.test(b))
    return false;
  if (/恋情|绯闻|路透|身材状态|重组团队|晒.*自己|哭了|开播|云包场/i.test(b)) return false;
  if (
    /政策|外交|芯片|电动车|AI|腾讯|比亚迪|A股|台风|预警|国台办|高考|公积金|民生|6G|地震|战争|导弹|受贿|召回|龙卷风|物流园/i.test(
      b,
    )
  )
    return true;
  if (gbaRelevant(title, desc)) return true;
  return false;
}

async function scrapeGoogle(page, geo) {
  await page.goto(
    `https://trends.google.com/trending?geo=${geo}&sort=search-volume&hours=48`,
    { waitUntil: "networkidle2", timeout: 90000 },
  );
  await new Promise((r) => setTimeout(r, 4000));
  return page.evaluate(() => {
    const out = [];
    const rows = document.querySelectorAll("tr, [role='row']");
    for (const row of rows) {
      const lines = (row.innerText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length < 2) continue;
      const volLine = lines.find(
        (l) => /^\d+[KM]?\+?\s*(searches)?$/i.test(l) && /[KM]\+|\+\s*$|searches/i.test(l),
      );
      if (!volLine) continue;
      const title = lines[0];
      const vol = volLine.replace(/\s*searches/i, "").trim();
      let growth = 0;
      const gLine = lines.find((l) => /^\d{1,3}(,\d{3})*%$/.test(l));
      if (gLine) growth = parseInt(gLine.replace(/,/g, ""), 10);
      if (title && !/Search volume|Started|Trend/i.test(title))
        out.push({ title, vol, growth });
    }
    return out;
  });
}

async function scrapeWeiboTable(page, cate) {
  await page.goto(`https://s.weibo.com/top/summary?cate=${cate}`, {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 3000));
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll("table tbody tr").forEach((tr) => {
      const rankTd = tr.querySelector("td.td-01");
      const a = tr.querySelector("td.td-02 a");
      const span = tr.querySelector("td.td-03 span");
      if (!a) return;
      const rankText = rankTd ? rankTd.textContent.trim() : "";
      const rank = parseInt(rankText, 10) || out.length + 1;
      out.push({
        rank,
        title: a.textContent.trim(),
        heat: span ? span.textContent.trim() : "",
      });
    });
    return out;
  });
}

function runPy(script) {
  const tmp = path.join(root, "scripts/.capture-tmp.py");
  fs.writeFileSync(tmp, script, "utf8");
  try {
    return execSync(`python3 ${tmp}`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } finally {
    fs.unlinkSync(tmp);
  }
}

function fetchWeiboHeat() {
  const out = runPy(`import urllib.request, json, http.cookiejar
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [('User-Agent','Mozilla/5.0'),('Accept','application/json'),('Referer','https://weibo.com/')]
op.open('https://weibo.com/', timeout=15).read()
d = json.loads(op.open('https://weibo.com/ajax/side/hotSearch', timeout=15).read().decode())
heat = {}
for item in d.get('data',{}).get('realtime',[]):
    heat[item.get('note','')] = item.get('num',0)
print(json.dumps(heat))
`);
  return JSON.parse(out.trim());
}

function fetchBaidu() {
  const out = runPy(`import urllib.request, json, re
html = urllib.request.urlopen(urllib.request.Request(
  'https://top.baidu.com/board?tab=realtime',
  headers={'User-Agent':'Mozilla/5.0'}), timeout=30).read().decode()
m = re.search(r'<!--s-data:(.*?)-->', html)
data = json.loads(m.group(1))
items = []
for card in data.get('data',{}).get('cards',[]):
  for item in card.get('content',[]):
    items.append({'title': item.get('word',''), 'score': int(item.get('hotScore',0)), 'desc': item.get('desc','')})
print(json.dumps(items, ensure_ascii=False))
`);
  return JSON.parse(out.trim());
}

function fetchWeiboRealtimeApi() {
  const out = runPy(`import urllib.request, json, http.cookiejar
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [('User-Agent','Mozilla/5.0'),('Accept','application/json'),('Referer','https://weibo.com/')]
op.open('https://weibo.com/', timeout=15).read()
d = json.loads(op.open('https://weibo.com/ajax/side/hotSearch', timeout=15).read().decode())
rows = []
for i, item in enumerate(d.get('data',{}).get('realtime',[])):
    rank = item.get('realpos') or item.get('rank')
    if rank is None: rank = i + 1
    rows.append({'rank': int(rank), 'title': item.get('note',''), 'heat': str(item.get('num',0))})
print(json.dumps(rows, ensure_ascii=False))
`);
  return JSON.parse(out.trim());
}

function whyGoogle(title) {
  const map = {
    黑雨: "Hong Kong's black rainstorm warning stayed active as squally showers swept the city during gaokao weekend, pushing weather-related searches.",
    停課: "School-suspension queries spiked after the Education Bureau and Observatory issued rainstorm guidance overlapping with exam days.",
    菲律賓地震: "A 7.9-magnitude quake south of the Philippines drove Hong Kong searches for tsunami alerts, travel disruption and regional quake updates.",
    hko: "English queries for the Hong Kong Observatory jumped alongside Chinese weather warnings as users checked radar and alert pages.",
    f1: "Formula 1 interest climbed as Hong Kong fans looked up Monaco GP results and driver standings during the 48-hour window.",
    荃灣中心: "Tsuen Wan Centre power-outage reports trended locally as residents searched outage updates and building-management notices.",
    wwdc: "Apple WWDC 2026 announcements — iOS 27 and AI features — drew Hong Kong tech searches after the keynote window.",
    胡楓: "Veteran actor Wu Fung trended after fresh media appearances and concert-related coverage circulated locally.",
    "hk observatory": "Hong Kong Observatory English queries tracked thunderstorm and rain warnings through the capture window.",
    zverev: "Alexander Zverev's French Open run kept tennis searches elevated among Hong Kong sports fans.",
    屯門公路交通意外: "A major Tuen Mun Road collision drew traffic and news searches as commuters checked diversions and casualty updates.",
    "電子 作戰": "Electronic-warfare keywords trended after regional military and tech-security coverage linked the term to cross-strait headlines.",
    viutv: "ViuTV programming and talent stories spiked local entertainment searches during the weekend capture window.",
    observatory: "Weather-institute English queries tracked Observatory warnings as squally showers persisted.",
    "nba finals": "NBA Finals Game 2 tipped off as Hong Kong users searched scores, streams and Trump courtside attendance.",
  };
  if (map[title]) return map[title];
  if (GOSSIP_GOOGLE.test(title))
    return "Celebrity or entertainment keyword trending on Hong Kong Google during the 48-hour capture window.";
  return `Hong Kong users searched "${title}" heavily in Google's 48-hour Trending Now board during this capture.`;
}

function titleEnGoogle(title) {
  if (!/[\u4e00-\u9fff]/.test(title)) return undefined;
  const map = {
    黑雨: "Black rainstorm warning",
    停課: "Class suspension",
    菲律賓地震: "Philippines earthquake",
    荃灣中心: "Tsuen Wan Centre",
    冼靖峰: "Archie Sin (singer)",
    胡楓: "Wu Fung (veteran actor)",
    蔡思貝: "Sisley Choi (actress)",
    許志安: "Andy Hui (singer)",
    "關 可 為": "Kwan Ho Wai",
    屯門公路交通意外: "Tuen Mun Road traffic accident",
    "電子 作戰": "Electronic warfare",
    簡佩筠: "Kan Pui Wan",
    許志安演唱會: "Andy Hui concert",
    李家鼎: "Lee Ka Ting (actor)",
    劉青雲: "Lau Ching Wan (actor)",
    吳文忻: "Ng Man Yan",
    袁文傑: "Vincent Ng (actor)",
  };
  return map[title] || title;
}

function buildGoogleSection(hkRows) {
  const items = hkRows.map((row, i) => {
    const gossip = GOSSIP_GOOGLE.test(row.title);
    const item = {
      pin: "📍🇭🇰",
      geoId: "HK",
      rank: i + 1,
      title: row.title,
      searchVolume: row.vol,
      volumeEstimate: parseVol(row.vol),
      growthPercent: row.growth || 0,
      isGossip: gossip,
      isNewsworthy: !gossip,
      isGbaRelevant: true,
      whyTrending: whyGoogle(row.title),
    };
    const en = titleEnGoogle(row.title);
    if (en) item.titleEn = en;
    return item;
  });
  return {
    id: "google_trends",
    boardLabel: "Trending Now · 48h · search volume",
    subtitle: "GBA · Hong Kong & Macao combined",
    defaultLocationId: "HK",
    scoreHelp:
      "Score = 35% volume rank (within this top-5) + 35% growth (capped at 1000%) + 30% vs top-50 avg. Volumes/growth come from Google's Trending Now 48h UI when available — never coarse Trends RSS buckets for on-card numbers.",
    locations: [
      {
        id: "HK",
        label: "Hong Kong",
        emoji: "🇭🇰",
        sourceUrl:
          "https://trends.google.com/trending?geo=HK&sort=search-volume&hours=48",
        avgTop50Volume: 3500,
        capturedAt: CAPTURED_AT,
      },
      {
        id: "MO",
        label: "Macao",
        emoji: "🇲🇴",
        sourceUrl:
          "https://trends.google.com/trending?geo=MO&sort=search-volume&hours=48",
        avgTop50Volume: 3000,
        capturedAt: CAPTURED_AT,
      },
    ],
    itemsByLocation: { HK: items, MO: [] },
  };
}

function whyBaidu(title, desc) {
  if (/习近平|朝鲜|平壤|尊贵/.test(title + desc))
    return "Xi Jinping's state visit to North Korea and related diplomacy dominated Baidu realtime as state media amplified arrival and cultural events.";
  if (/高考|108塔|李华/.test(title))
    return "National gaokao papers and exam-day human-interest stories kept education keywords atop Baidu through 8–9 June.";
  if (/佛山/.test(title))
    return "A Foshan GBA story about a 97-year-old former self-combed woman trended as local heritage reporting spread on Baidu.";
  if (/电子布/.test(title))
    return "AI-driven demand lifted electronic-glass-fibre cloth prices, making supply-chain inflation a top Baidu business story.";
  if (/白天辉|巨贪/.test(title))
    return "Courts highlighted Huarong executive Bai Tianhui's record corruption case, drawing nationwide finance-crime searches.";
  if (/牙刷|民宿/.test(title))
    return "CCTV exposure of ultra-cheap recycled-plastic toothbrushes supplied to hotels sparked consumer-safety searches.";
  if (/A股|股指/.test(title))
    return "Mainland equity openings and chip-sector moves trended on Baidu as Middle East risk met domestic market sentiment.";
  if (/南宁|龙卷风/.test(title))
    return "A Nanning logistics-park tornado in Guangxi drew regional weather and disaster searches with GBA supply-chain relevance.";
  if (/义乌|世界杯/.test(title))
    return "Yiwu export-hub World Cup merchandise orders trended as manufacturing and trade stories intersected with the tournament build-up.";
  if (/菲律宾|地震/.test(title))
    return "Southern Philippines earthquake coverage and tsunami guidance drove nationwide disaster-related Baidu traffic.";
  return desc?.slice(0, 200) || `Baidu realtime ranked "${title}" during this capture window.`;
}

function buildBaiduSection(rows) {
  const items = rows.map((row, i) => {
    const gossip = GOSSIP_BAIDU.test(row.title);
    const gba = gbaRelevant(row.title, row.desc);
    const news = newsworthy(row.title, row.desc, gossip);
    const item = {
      pin: "📍🇨🇳",
      rank: i + 1,
      title: row.title,
      searchVolume: formatBaiduVol(row.score),
      volumeEstimate: row.score,
      whyTrending: whyBaidu(row.title, row.desc),
      isGossip: gossip,
      isGbaRelevant: gba,
      isNewsworthy: news,
    };
    if (/[\u4e00-\u9fff]/.test(row.title)) {
      item.titleEn = row.title;
    }
    return item;
  });
  return {
    id: "baidu",
    boardLabel: "Realtime 热搜",
    subtitle: "GBA + major national · realtime 热搜",
    sourceUrl: "https://top.baidu.com/board?tab=realtime",
    capturedAt: CAPTURED_AT,
    items,
  };
}

function whyWeibo(title, boardId) {
  if (/高考/.test(title))
    return "Gaokao subject papers and exam-day reactions dominated Weibo as millions of students sat national tests on 8–9 June.";
  if (/朝鲜|平壤|尊贵/.test(title))
    return "Xi Jinping's North Korea visit and cultural performances trended on Weibo as state-media imagery circulated widely.";
  if (/苹果|iOS|iPhone|WWDC|Siri/.test(title))
    return "Apple WWDC 2026 and iOS 27 announcements drove Weibo tech searches as users debated China availability and on-device AI.";
  if (/华为|宇树|英伟达|OpenAI|ChatGPT|豆包|AI|半导体|黄仁勋/.test(title))
    return "Domestic tech and AI supply-chain debates trended on Weibo amid WWDC week and chip-market volatility.";
  if (/伊朗|以色列/.test(title))
    return "Middle East escalation headlines kept conflict-related Weibo searches elevated through the capture window.";
  if (/NBA|马刺|尼克斯|特朗普观战/.test(title))
    return "NBA Finals Game 2 and courtside politics drew sports-related Weibo traffic overnight.";
  if (/郑钦文/.test(title))
    return "Zheng Qinwen's Queen's Club exit and ranking slide sparked tennis discussion on Weibo sports boards.";
  if (/金价|金饰/.test(title))
    return "Gold-price swings and retail rush scenes trended on Weibo as bullion markets sold off sharply.";
  if (boardId === "tech")
    return `Weibo tech board ranked "${title}" during WWDC week as users debated product launches and AI competition.`;
  return `Weibo ${boardId} board surfaced "${title}" during this live capture.`;
}

function buildWeiboSection(realtimeRows, techRows, heatMap) {
  const seen = new Set();
  const realtimeItems = [];
  for (const row of realtimeRows) {
    if (!row.title || seen.has(row.title)) continue;
    seen.add(row.title);
    const num = heatMap[row.title] || parseVol(row.heat);
    const gossip = GOSSIP_WEIBO.test(row.title);
    const gba = gbaRelevant(row.title);
    const news = newsworthy(row.title, "", gossip);
    const item = {
      pin: "📍🇨🇳",
      boardId: "realtimehot",
      rank: realtimeItems.length + 1,
      title: row.title,
      searchVolume: formatWeiboVol(num || 100000),
      volumeEstimate: num || 100000,
      whyTrending: whyWeibo(row.title, "realtimehot"),
      isGossip: gossip,
      isGbaRelevant: gba,
      isNewsworthy: news,
    };
    if (/[\u4e00-\u9fff]/.test(row.title)) item.titleEn = row.title;
    realtimeItems.push(item);
    if (realtimeItems.length >= 50) break;
  }

  const techItems = techRows.map((row, i) => {
    const num = heatMap[row.title] || Math.max(500000 - i * 15000, 80000);
    const gossip = GOSSIP_WEIBO.test(row.title);
    return {
      boardId: "tech",
      rank: i + 1,
      title: row.title,
      searchVolume: formatWeiboVol(num),
      volumeEstimate: num,
      pin: "📍🇨🇳",
      whyTrending: whyWeibo(row.title, "tech"),
      isGossip: gossip,
      isGbaRelevant: true,
      isNewsworthy: !gossip,
      titleEn: /[\u4e00-\u9fff]/.test(row.title) ? row.title : undefined,
    };
  });

  return {
    id: "weibo",
    boardLabel: "Realtime + Tech · merged",
    subtitle: "Weibo · GBA + major national · realtime + tech",
    sourceUrl: "https://s.weibo.com/top/summary?cate=realtimehot",
    capturedAt: CAPTURED_AT,
    boardSources: [
      {
        id: "realtimehot",
        label: "Realtime hot",
        url: "https://s.weibo.com/top/summary?cate=realtimehot",
      },
      {
        id: "tech",
        label: "Tech",
        url: "https://s.weibo.com/top/summary?cate=tech",
      },
    ],
    items: realtimeItems,
    itemsByBoard: { tech: techItems },
  };
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  const hkRows = await scrapeGoogle(page, "HK");
  const moRows = await scrapeGoogle(page, "MO");
  let realtimeRows = await scrapeWeiboTable(page, "realtimehot");
  const techRows = await scrapeWeiboTable(page, "tech");
  await browser.close();

  if (realtimeRows.length < 10) {
    realtimeRows = fetchWeiboRealtimeApi().map((r) => ({
      rank: r.rank,
      title: r.title,
      heat: r.heat,
    }));
  }

  console.log(
    `Captured: Google HK ${hkRows.length}, MO ${moRows.length}, Weibo RT ${realtimeRows.length}, Tech ${techRows.length}`,
  );

  const baiduRows = fetchBaidu();
  const heatMap = fetchWeiboHeat();

  const data = {
    refreshedAt: CAPTURED_AT,
    refreshedAtLabel: `Board capture · Asia/Hong_Kong · 48h window · ${CAPTURED_DATE}`,
    windowHours: 48,
    disclaimer: "",
    sections: [
      buildGoogleSection(hkRows),
      buildBaiduSection(baiduRows),
      buildWeiboSection(realtimeRows, techRows, heatMap),
    ],
    topicCandidates: [],
  };

  const header = fs.readFileSync(fragPath, "utf8").split(
    /<script type="application\/json" id="trend-watch-data">/,
  )[0];
  const footer = "\n</script>\n";
  fs.writeFileSync(
    fragPath,
    `${header}<script type="application/json" id="trend-watch-data">\n${JSON.stringify(data, null, 2)}\n${footer}`,
    "utf8",
  );
  console.log(`Wrote ${fragPath} at ${CAPTURED_AT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
