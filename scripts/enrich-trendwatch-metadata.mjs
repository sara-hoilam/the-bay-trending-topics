#!/usr/bin/env node
/**
 * Post-capture Trend Watch enrichment: section subtitles, gossip flags,
 * titleEn + whyTrending on section rows (from glossary + topicCandidates).
 *
 * Usage: node scripts/enrich-trendwatch-metadata.mjs [path/to/trendwatch.html]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fragPath = process.argv[2]
  ? path.resolve(root, process.argv[2])
  : path.join(root, "orchestration/fragments/trendwatch.html");

const GOSSIP_TITLE =
  /豆包不会做馒头|玩山姆|托举梗|洞洞鞋|角化型脚气|暴食|秘嫁|阔太|综艺|抄袭|恋情|绯闻|灵魂摆渡|瘦腿|砸店|崩溃痛哭/i;

const GLOSSARY = {
  翁金驊: {
    titleEn: "Angie Ng (TVB artist)",
    whyTrending:
      "Hong Kong searches spiked for TVB actress Angie Ng after fresh on-air appearances and social clips circulated in the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  癌症: {
    titleEn: "Cancer",
    whyTrending:
      "Cancer-related searches rose in Hong Kong amid renewed public-health messaging and high-profile awareness campaigns in the 48h capture.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  回贈: {
    titleEn: "Rebates / rewards",
    whyTrending:
      "Retail and bank rebate keywords trended as Hong Kong shoppers hunted mid-year promotions and cashback offers.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  折扣: {
    titleEn: "Discounts",
    whyTrending:
      "Discount-related queries climbed with seasonal sales and travel-deal marketing targeting Hong Kong consumers.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "低 氣壓": {
    titleEn: "Low pressure (weather)",
    whyTrending:
      "Weather searches jumped after Hong Kong Observatory flagged a low-pressure system affecting local conditions during the active monsoon season.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  低氣壓: {
    titleEn: "Low pressure (weather)",
    whyTrending:
      "Weather searches jumped after Hong Kong Observatory flagged a low-pressure system affecting local conditions during the active monsoon season.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  更好担负起新的文化使命: {
    titleEn: "Shoulder the new cultural mission (Xi line)",
    whyTrending:
      "Baidu realtime topped out on Xi Jinping's cultural-mission phrase as state media amplified the Shenzhen culture-forum messaging and GBA heritage-tech coverage.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  三星堆考古发现11件红玉髓珠: {
    titleEn: "Sanxingdui dig finds 11 carnelian beads",
    whyTrending:
      "Archaeology interest surged after new Sanxingdui artefacts were reported — a major national culture story with museum traffic across southwest China.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "中美两军夏威夷会晤 中方划“红线”": {
    titleEn: "US–China military talks in Hawaii — PRC red lines",
    whyTrending:
      "Baidu placed US–China military consultations in Hawaii at the top of realtime search as outlets framed Beijing's security red lines for the bilateral channel.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "一文了解汛期知识、避险方法": {
    titleEn: "Flood-season safety explainer",
    whyTrending:
      "Emergency-preparedness content trended nationwide as southern provinces entered flood season and civil-affairs posts pushed evacuation guidance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  事业编考生笔试第1因围报被取消资格: {
    titleEn: "Civil-service exam top scorer disqualified (hoarding)",
    whyTrending:
      "A provincial civil-service scandal — top written-exam finisher allegedly hoarding multiple registrations — drove debate on public-sector hiring fairness.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  王莉霞被逮捕: {
    titleEn: "Wang Lixia arrested (Inner Mongolia)",
    whyTrending:
      "Weibo traffic spiked on news that former Inner Mongolia chair Wang Lixia was placed under criminal measures — a major anti-corruption headline.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  这六张网与你我息息相关: {
    titleEn: "Six national networks that touch daily life",
    whyTrending:
      "State-media explainer on transport, power, telecom and logistics networks trended as part of a national infrastructure awareness push.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  豆包不会做馒头: {
    titleEn: "Doubao can't make steamed buns (meme)",
    whyTrending: "",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  玩山姆托举梗妈妈再道歉: {
    titleEn: "Sam's Club meme — mother apologises again",
    whyTrending: "",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  穿洞洞鞋得了角化型脚气: {
    titleEn: "Crocs linked to foot keratosis (viral)",
    whyTrending: "",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  比亚迪汽车5月销量383453辆: {
    titleEn: "BYD May auto sales — 383,453 units",
    whyTrending:
      "Weibo tech hot listed BYD's May delivery figure as the EV giant's monthly sales update circulated — directly relevant to Shenzhen HQ and GBA manufacturing.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  SpaceXA股供应商名单曝光: {
    titleEn: "SpaceX A-share supplier list surfaces",
    whyTrending:
      "Tech board traffic rose on a list naming mainland listed firms tied to SpaceX's supply chain — a cross-border aerospace/industrial story with GBA electronics suppliers in focus.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "腾讯云DeepSeek最高降价97.5%": {
    titleEn: "Tencent Cloud DeepSeek cuts prices up to 97.5%",
    whyTrending:
      "Tencent Cloud's aggressive DeepSeek model pricing cuts hit Weibo tech hot search as enterprises compare AI inference costs — relevant to Shenzhen/HK cloud and fintech buyers.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  施南生: {
    titleEn: "Shi Nansheng (film producer)",
    whyTrending:
      "Veteran Hong Kong film producer Shi Nansheng trended after fresh media coverage of her industry legacy and recent public appearances circulated in the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  龔嘉欣: {
    titleEn: "Grace Wong (TVB actress)",
    whyTrending:
      "TVB actress Grace Wong spiked entertainment searches after on-screen and social-media coverage during the capture window.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  劉亦菲: {
    titleEn: "Liu Yifei (actress)",
    whyTrending:
      "Mainland actress Liu Yifei drove celebrity entertainment searches on Hong Kong Google as fans looked up recent drama and appearance headlines.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  消費: {
    titleEn: "Consumption / spending",
    whyTrending:
      "Consumer-spending keywords climbed as Hong Kong shoppers tracked mid-year retail promotions, dining deals and travel spending during the summer window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  香港施政報告: {
    titleEn: "Hong Kong Policy Address",
    whyTrending:
      "Policy Address searches rose as Hong Kong residents looked up Chief Executive priorities, consultation timelines and expected livelihood measures ahead of the annual address season.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "熱帶 擾動": {
    titleEn: "Tropical disturbance",
    whyTrending:
      "Tropical-disturbance queries jumped alongside Hong Kong Observatory monitoring as a weather system in the South China Sea drew typhoon-season attention.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  台风: {
    titleEn: "Typhoon",
    whyTrending:
      "Typhoon-related searches rose across Hong Kong and the GBA as residents checked storm tracks, rain warnings and travel disruption during active monsoon season.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  习近平将出席世界人工智能大会开幕式: {
    titleEn: "Xi to attend World AI Conference opening",
    whyTrending:
      "Baidu realtime topped out on Xi Jinping's planned attendance at the World AI Conference opening in Shanghai — a major national tech-policy signal with GBA AI-hub relevance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "海南将禁售燃油车 释放什么信号": {
    titleEn: "Hainan ICE ban — what signal?",
    whyTrending:
      "Hainan's plan to ban new fuel-vehicle sales by 2030 dominated Baidu as analysts debated EV transition timing and implications for GBA auto supply chains.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中国自研AI芯片取得架构突破: {
    titleEn: "China homegrown AI chip architecture breakthrough",
    whyTrending:
      "Weibo tech hot ranked domestic AI-chip architecture progress as users debated self-reliance and competition with Nvidia amid the Shanghai AI conference build-up.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  超强厄尔尼诺真要来了: {
    titleEn: "Super El Niño may be coming",
    whyTrending:
      "Weibo traffic spiked on forecasts that a strong El Niño could form this autumn, with users sharing climate impacts on southern China weather and agriculture.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
};

function normTitle(t) {
  return String(t || "").trim();
}

function lookupGlossary(title) {
  const t = normTitle(title);
  if (GLOSSARY[t]) return GLOSSARY[t];
  for (const [key, val] of Object.entries(GLOSSARY)) {
    if (t.includes(key) || key.includes(t)) return val;
  }
  return null;
}

function applyMeta(it, candidate) {
  if (!it || !it.title || it.title === "—") return it;
  const g = lookupGlossary(it.title);
  const c = candidate;
  if (g) {
    if (g.titleEn) it.titleEn = g.titleEn;
    if (g.whyTrending) it.whyTrending = g.whyTrending;
    if (g.isGossip != null) it.isGossip = g.isGossip;
    if (g.isNewsworthy != null) it.isNewsworthy = g.isNewsworthy;
    if (g.isGbaRelevant != null) it.isGbaRelevant = g.isGbaRelevant;
  }
  if (GOSSIP_TITLE.test(it.title)) {
    it.isGossip = true;
    it.isNewsworthy = false;
    it.isGbaRelevant = false;
  }
  if (c) {
    if (c.whyTrending && !it.whyTrending) it.whyTrending = c.whyTrending;
    if (c.titleEn && !it.titleEn) it.titleEn = c.titleEn;
    if (c.isGossip === true) {
      it.isGossip = true;
      it.isNewsworthy = false;
    }
  }
  if (it.isGbaRelevant == null && !it.isGossip) it.isGbaRelevant = true;
  if (it.isNewsworthy == null && !it.isGossip) it.isNewsworthy = true;
  if (it.isGossip == null) it.isGossip = false;
  return it;
}

function findCandidate(data, title) {
  const key = normTitle(title).toLowerCase();
  for (const c of data.topicCandidates || []) {
    if (normTitle(c.displayTitle).toLowerCase() === key) return c;
    for (const h of c.platformHits || []) {
      if (normTitle(h.title).toLowerCase() === key) return c;
    }
  }
  return null;
}

function enrichData(data) {
  const google = data.sections?.find((s) => s.id === "google_trends");
  if (google) {
    google.subtitle = "GBA · Hong Kong & Macao combined";
  }
  const baidu = data.sections?.find((s) => s.id === "baidu");
  if (baidu) {
    baidu.subtitle = "GBA + major national · realtime 热搜";
  }
  const weibo = data.sections?.find((s) => s.id === "weibo");
  if (weibo) {
    weibo.boardLabel = "Realtime + Tech · merged";
    weibo.subtitle = "Weibo · GBA + major national · realtime + tech";
    weibo.boardSources = weibo.boardSources || [
      {
        id: "realtimehot",
        label: "Realtime hot",
        url: "https://s.weibo.com/top/summary?cate=realtimehot",
      },
      { id: "tech", label: "Tech", url: "https://s.weibo.com/top/summary?cate=tech" },
    ];
  }

  for (const sec of data.sections || []) {
    if (sec.id === "google_trends") {
      for (const [geo, items] of Object.entries(sec.itemsByLocation || {})) {
        sec.itemsByLocation[geo] = (items || []).map((it) =>
          applyMeta({ ...it, geoId: it.geoId || geo }, findCandidate(data, it.title)),
        );
      }
    } else {
      sec.items = (sec.items || []).map((it) => applyMeta({ ...it }, findCandidate(data, it.title)));
      if (sec.itemsByBoard) {
        for (const [boardId, items] of Object.entries(sec.itemsByBoard)) {
          sec.itemsByBoard[boardId] = (items || []).map((it) =>
            applyMeta({ ...it, boardId: it.boardId || boardId }, findCandidate(data, it.title)),
          );
        }
      }
    }
  }

  data.topicCandidates = (data.topicCandidates || []).map((c) => {
    const g = lookupGlossary(c.displayTitle);
    const next = { ...c };
    if (g) {
      if (g.titleEn) next.titleEn = g.titleEn;
      if (g.whyTrending) next.whyTrending = g.whyTrending;
      if (g.isGossip) {
        next.isGossip = true;
        next.gbaRelevance = "low";
      }
    }
    if (GOSSIP_TITLE.test(c.displayTitle || "")) {
      next.isGossip = true;
      next.gbaRelevance = "low";
    }
    return next;
  });

  return data;
}

function loadData() {
  const raw = fs.readFileSync(fragPath, "utf8");
  const m = raw.match(
    /(<script type="application\/json" id="trend-watch-data">\s*)([\s\S]*?)(\s*<\/script>)/,
  );
  if (!m) throw new Error("Missing trend-watch-data");
  return { raw, m, data: JSON.parse(m[2]) };
}

function main() {
  const { raw, m, data } = loadData();
  enrichData(data);
  const out = m[1] + JSON.stringify(data, null, 2) + m[3];
  fs.writeFileSync(fragPath, raw.replace(m[0], out));
  console.log("Enriched", fragPath);

  let missingEn = 0;
  for (const sec of data.sections || []) {
    const rows =
      sec.id === "google_trends"
        ? Object.values(sec.itemsByLocation || {}).flat()
        : [...(sec.items || []), ...Object.values(sec.itemsByBoard || {}).flat()];
    for (const it of rows) {
      if (!it?.title || it.title === "—") continue;
      if (/[\u4e00-\u9fff]/.test(it.title) && !it.titleEn && !it.isGossip) missingEn++;
    }
  }
  if (missingEn) console.warn(`WARN ${missingEn} CJK rows still missing titleEn`);
}

main();
