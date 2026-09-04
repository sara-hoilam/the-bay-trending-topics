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
  劉兆銘: {
    titleEn: "Lau Siu-ming (actor)",
    whyTrending:
      "Hong Kong character actor Lau Siu-ming (劉兆銘) hit 20K+ with 1,000% growth after local media reported his death at 94 on 2 September. Related query 謝君豪 sat on the same 48-hour board. Obituaries are treated as news, not gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "銀色 債券 2026": {
    titleEn: "Silver Bond 2026",
    whyTrending:
      "Hong Kong's 11th Silver Bond subscription closed at 14:00 on 4 September. The three-year notes guarantee 4.25% and targeted HK$50–55 billion. Related queries included 銀色 債券 and 銀色債券 as eligible residents rushed the cutoff.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "熱帶 風暴 沙 德爾": {
    titleEn: "Tropical Storm Saudel",
    whyTrending:
      "熱帶 風暴 沙 德爾 stayed at 10K+ with 1,000% growth on Hong Kong's 48-hour board after the storm tracked the northern South China Sea. Related queries included 熱帶 氣旋 警報, 三號強風信號 and 熱帶 風暴.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  GPT6正式发布: {
    titleEn: "GPT-6 officially launches",
    whyTrending:
      "OpenAI released GPT-6 Astra on 4 September and framed it as its most capable aligned model. The same launch led Baidu as OpenAI总裁宣布AGI到来 and lifted Hong Kong ChatGPT searches — a cross-platform AI spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "OpenAI总裁宣布AGI到来": {
    titleEn: "OpenAI president declares the AGI era",
    whyTrending:
      "Baidu realtime ranked OpenAI's 4 September GPT-6 Astra launch after president Greg Brockman closed the event with 'Welcome to the AGI era.' Follow-on rows covered the model card and a same-night US AI outage.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  黃之鋒: {
    titleEn: "Joshua Wong",
    whyTrending:
      "Joshua Wong (黃之鋒) searches hit 5K+ with 800% growth on Hong Kong's 48-hour board. The English twin joshua wong also ranked at 1K+. A political-news spike, not celebrity gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  港元: {
    titleEn: "Hong Kong dollar",
    whyTrending:
      "HKD searches hit 200+ with 800% growth on the 48-hour board. Users checked the peg alongside 利息 and 債券 市場 in the same capture window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  麥當勞: {
    titleEn: "McDonald's",
    whyTrending:
      "McDonald's searches hit 2K+ with 300% growth on Hong Kong's 48-hour board. Users looked up the chain during the same window as typhoon and dining-deal queries.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "热带低气压 沙德尔": {
    titleEn: "Tropical depression Saudel",
    whyTrending:
      "Simplified-character searches for 热带低气压 沙德尔 hit 2K+ with 1,000% growth. The row paired with the traditional 100K+ tropical-storm leader as Saudel tracked Fujian and the northern South China Sea.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  香港小姐競選: {
    titleEn: "Miss Hong Kong pageant",
    whyTrending:
      "Miss Hong Kong pageant searches hit 1K+ with 600% growth. Related queries included 林婷婷 and 黃翠如. Pageant/celebrity; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  "热带风暴 沙德尔": {
    titleEn: "Tropical Storm Saudel (simplified)",
    whyTrending:
      "Simplified-character searches for 热带风暴 沙德尔 hit 2K+ with 1,000% growth. The row sat beside the traditional-character 100K+ leader as Saudel's Fujian landfall circulated.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  劉兆銘: {
    titleEn: "Lau Siu-ming (actor)",
    whyTrending:
      "Hong Kong character actor Lau Siu-ming (劉兆銘) hit 20K+ with 1,000% growth after local media reported his death at 94 on 2 September. Related query 謝君豪 sat on the same 48-hour board. Obituaries are treated as news, not gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "习近平同埃及总统塞西会谈": {
    titleEn: "Xi Jinping meets Egypt's President Sisi",
    whyTrending:
      "Baidu realtime led on Xi Jinping's 2 September talks with Egyptian President Abdel Fattah el-Sisi at Cairo's Ittihadiya Palace. Weibo pinned #习近平圆满结束对埃及的国事访问# in the same window — major national diplomacy.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "今天 致敬伟大胜利": {
    titleEn: "Today — salute the great victory (V-J Day)",
    whyTrending:
      "3 September is China's Victory Day marking the 81st anniversary of the end of the War of Resistance. Baidu ranked memorial explainers as state media recalled 14 years of war and more than 35 million Chinese casualties.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  全球股市大反转: {
    titleEn: "Global stock markets reverse sharply",
    whyTrending:
      "Overnight on 2 September global equities staged a deep-V reversal as US Treasury yields dropped after an oil-driven inflation scare. The same headline led Weibo realtime — a cross-platform markets spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  告别机顶盒: {
    titleEn: "Saying goodbye to the set-top box",
    whyTrending:
      "China Broadcasting Network opened a nationwide tender for integrated TV adapters on 31 August so households can watch live TV without an external set-top box. Weibo realtime and tech both ranked the same hardware-policy story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "香港辟谣有一针防多癌疫苗": {
    titleEn: "Hong Kong debunks a one-shot multi-cancer vaccine rumour",
    whyTrending:
      "Weibo ranked a Hong Kong fact-check that no single injection prevents multiple cancers. A direct HK/GBA public-health rumour row in the same window as mainland vaccine-misconception explainers.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "台风沙德尔在福建漳州第三次登陆": {
    titleEn: "Typhoon Saudel makes third landfall in Zhangzhou, Fujian",
    whyTrending:
      "Saudel made a third landfall in Zhangzhou, Fujian. The same storm led Hong Kong Google at 100K+ and Weibo as 沙德尔第3次登陆 — a South China / GBA weather story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "黄色预警！7省区部分地区有大到暴雨": {
    titleEn: "Yellow alert: heavy-to-torrential rain in 7 provincial areas",
    whyTrending:
      "The National Meteorological Centre kept a rainstorm yellow warning at 06:00 on 3 September for Guangdong, Fujian, Jiangxi and four other provinces, with locally extreme rain in eastern Guangdong. Direct GBA weather risk.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "《倩女幽魂》“姥姥”刘兆铭去世": {
    titleEn: "A Chinese Ghost Story's 'Granny' Lau Siu-ming dies",
    whyTrending:
      "Hong Kong media reported on 2 September that veteran actor Lau Siu-ming died at 93. He was known as the tree demon 'Granny' in A Chinese Ghost Story and won TVB's Ten Thousand Radiance award — a direct HK/GBA obituary.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  演员刘兆铭去世: {
    titleEn: "Actor Lau Siu-ming dies",
    whyTrending:
      "Weibo ranked the Hong Kong actor's death at 93. Same A Chinese Ghost Story obituary as Baidu and Hong Kong Google's 5K+ 劉兆銘 row.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  沙德尔第3次登陆: {
    titleEn: "Saudel makes a third landfall",
    whyTrending:
      "Weibo ranked Saudel's third landfall as the storm came ashore in Zhangzhou, Fujian. Hong Kong Google led at 100K+ on 熱帶風暴 沙德爾 and Baidu carried 台风沙德尔在福建漳州第三次登陆.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "微信新功能专治各种看不见": {
    titleEn: "WeChat features that catch what you missed",
    whyTrending:
      "WeChat added a long-press unread-session list and a badge for unclaimed red packets or transfers. The same row ranked on Weibo realtime and tech — a national super-app product spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "雷军称小米18Fold比例根号二比一": {
    titleEn: "Lei Jun: Xiaomi 18 Fold aspect ratio is √2:1",
    whyTrending:
      "Lei Jun said Xiaomi 18 Fold will use a √2:1 aspect ratio. Follow-on rows compared it with Huawei's foldable on the same tech board — GBA handset hardware.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "熱帶風暴 沙德爾": {
    titleEn: "Tropical Storm Saudel",
    whyTrending:
      "Hong Kong's 48-hour board was led by 熱帶風暴 沙德爾 at 100K+ with 1,000% growth as Tropical Storm Saudel tracked the northern South China Sea. Related queries included 熱帶風暴沙德爾, 熱帶低氣壓 沙德爾 and 林超英. A simplified-character twin and English low-pressure-area searches sat on the same board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "热带低气压 沙德尔": {
    titleEn: "Tropical depression Saudel",
    whyTrending:
      "Simplified-character searches for 热带低气压 沙德尔 hit 2K+ with 1,000% growth. The row paired with the traditional 100K+ tropical-storm leader as Saudel tracked Fujian and the northern South China Sea.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  楊思琦: {
    titleEn: "Shirley Yeung",
    whyTrending:
      "TVB actress Shirley Yeung (楊思琦) ranked at 5K+ with 1,000% growth over about 20 hours. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  香港小姐競選: {
    titleEn: "Miss Hong Kong pageant",
    whyTrending:
      "Miss Hong Kong pageant searches hit 1K+ with 600% growth. Related queries included 林婷婷 and 黃翠如. Pageant/celebrity; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  麦当劳: {
    titleEn: "McDonald's",
    whyTrending:
      "McDonald's searches hit 5K+ with 300% growth over about 17 hours. Related queries included mcdonald 優惠, 麥樂雞 and m記優惠 as Hong Kong users looked up app deals and McNuggets promotions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  麥當勞: {
    titleEn: "McDonald's",
    whyTrending:
      "McDonald's searches hit 2K+ with 300% growth on Hong Kong's 48-hour board. Users looked up the chain during the same window as typhoon and dining-deal queries.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "活期 存款": {
    titleEn: "Demand deposits",
    whyTrending:
      "Hong Kong searches for 活期 存款 hit 1K+ with 700% growth over about 16 hours. Users checked savings and current-account rates as HKD and deposit headlines circulated in the same 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  黃之鋒: {
    titleEn: "Joshua Wong",
    whyTrending:
      "Joshua Wong (黃之鋒) searches hit 5K+ with 800% growth on Hong Kong's 48-hour board. The English twin joshua wong also ranked at 1K+. A political-news spike, not celebrity gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  港元: {
    titleEn: "Hong Kong dollar",
    whyTrending:
      "HKD searches hit 200+ with 800% growth on the 48-hour board. Users checked the peg alongside 利息 and 債券 市場 in the same capture window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "白雪 仙": {
    titleEn: "Pak Suet-sin",
    whyTrending:
      "Cantonese-opera legend Pak Suet-sin (白雪仙) hit 2K+ with 1,000% growth over about 16 hours. Related query 白雪仙 marked a cultural/obituary-style spike, not tabloid gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  南韓: {
    titleEn: "South Korea",
    whyTrending:
      "South Korea searches hit 2K+ with 1,000% growth and lasted about 15 hours on Hong Kong's 48-hour board. Users checked regional headlines in the same window as local weather and FX queries.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  何超瓊: {
    titleEn: "Pansy Ho",
    whyTrending:
      "Pansy Ho (何超瓊) searches hit 1K+ with 700% growth and lasted about 1 day 3 hours. The Macao casino heiress is a GBA business name; not treated as tabloid gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  海關: {
    titleEn: "Customs and Excise",
    whyTrending:
      "Hong Kong Customs searches hit 100+ with 200% growth over about an hour. Users checked enforcement and cross-border clearance headlines during the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  西漢姆聯對狼隊: {
    titleEn: "West Ham vs Wolves",
    whyTrending:
      "Cantonese searches for West Ham vs Wolves hit 100+ with 200% growth after the Premier League fixture. Hong Kong fans tracked the same English-football slate as the Villa–Arsenal row.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "习近平出席“上海合作组织+”会议": {
    titleEn: "Xi attends SCO+ meeting",
    whyTrending:
      "Baidu realtime led on Xi Jinping's 1 September SCO+ speech in Bishkek, titled on equal and orderly multipolarity and global governance. Weibo pinned 2026上合峰会习近平提出4点主张 in the same window — major national diplomacy.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  老款手机集体涨价: {
    titleEn: "Older phone models rise in price together",
    whyTrending:
      "Weibo realtime and tech both led on 老款手机集体涨价 after Huawei, Xiaomi and Honor lifted tags on 1 September. Follow-on rows covered unsold stock and cancelled discount-wait plans — a national hardware story with Shenzhen/GBA brands.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  深圳校服真香: {
    titleEn: "Shenzhen school uniforms — actually good",
    whyTrending:
      "Shenzhen school-uniform rules stayed on Baidu and Weibo as parents debated mall self-buy versus campus bulk orders. A direct GBA education-cost story as the new term opened.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  深圳校服火了背后是教育边界问题: {
    titleEn: "Shenzhen uniforms viral — an education-boundary issue",
    whyTrending:
      "Weibo ranked a follow-on row arguing the Shenzhen uniform rush is about the boundary between school and family. Same GBA back-to-school cost story as Baidu's 深圳校服真香.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "双台风最新路径": {
    titleEn: "Latest dual-typhoon tracks",
    whyTrending:
      "Baidu ranked dual-typhoon tracks for Saudel (沙德尔) and Kolawan (科罗旺). The same weather window drove Hong Kong Google's 100K+ 熱帶風暴 沙德爾 spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "曼城1.46亿欧元签下恩佐": {
    titleEn: "Man City sign Enzo Fernández for €146m",
    whyTrending:
      "Weibo ranked Manchester City's reported €146m signing of Enzo Fernández from Chelsea. Hong Kong Google also carried enzo fernández and 切尔西告别恩佐 in the same 48-hour sports window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  尼泊尔泥石流灾害遇难人数升至1093人: {
    titleEn: "Nepal mudslide death toll rises to 1,093",
    whyTrending:
      "Baidu ranked the Nepal-side death toll at 1,093 after the Himalayan ice-rock collapse that also hit Gyirong Port. Related rescue rows stayed on the same realtime board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  云南文山12级台风致人伤亡系谣言: {
    titleEn: "Yunnan Wenshan 'typhoon casualties' is a rumour",
    whyTrending:
      "Officials said a viral clip of a 12-level typhoon causing casualties in Wenshan, Yunnan, was fabricated. A provincial rumour row, not a GBA weather story.",
    isGossip: false,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  沙德爾: {
    titleEn: "Tropical Storm Saudel (沙德爾)",
    whyTrending:
      "Hong Kong's 48-hour board was led by 熱帶風暴 沙德爾 at 100K+ with 1,000% growth as Tropical Storm Saudel tracked the northern South China Sea. Related queries included 熱帶風暴沙德爾, 熱帶低氣壓 沙德爾 and 林超英. A twin simplified-character row and English low-pressure-area searches sat on the same board as Baidu's dual-typhoon path update.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  夜生活: {
    titleEn: "Nightlife",
    whyTrending:
      "Hong Kong users searched 夜生活 at 5K+ with 1,000% growth; the spike lasted about 1 day 21 hours on the 48-hour board. It sat beside typhoon and dining-deal searches as residents checked going-out plans while Saudel lingered offshore.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  房屋署: {
    titleEn: "Housing Department",
    whyTrending:
      "Housing Department searches hit 2K+ with 600% growth and lasted about 19 hours. Users checked Express Flat Allocation and public-rental notices as the September selection window continued.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿斯頓維拉對兵工廠: {
    titleEn: "Aston Villa vs Arsenal",
    whyTrending:
      "Cantonese searches for Aston Villa vs Arsenal jumped to 2K+ with 1,000% growth after the Premier League midweek fixture. Related query 阿仙奴 paired with the English twin aston villa vs arsenal on the same 48-hour board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "aston villa vs arsenal": {
    titleEn: "Aston Villa vs Arsenal",
    whyTrending:
      "English-language searches for Aston Villa vs Arsenal hit 1K+ with 500% growth. Related queries included arsenal and english premier league on Hong Kong's 48-hour board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  謝振軒: {
    titleEn: "Lucas Tse (Cecilia Cheung / Nicholas Tse's son)",
    whyTrending:
      "Lucas Tse (謝振軒) ranked at 5K+ with related queries 張柏芝 and 謝霆鋒 after entertainment coverage of the 19-year-old. Celebrity/family tabloid; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  馬國明: {
    titleEn: "Kenneth Ma (actor)",
    whyTrending:
      "TVB actor Kenneth Ma ranked at 5K+ with related query 湯鎮宗. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  习近平会见普京: {
    titleEn: "Xi Jinping meets Putin",
    whyTrending:
      "Baidu realtime topped out as Xi Jinping met Vladimir Putin in Bishkek on 31 August on the sidelines of the 2026 SCO summit. State media carried the bilateral meeting as the diplomatic headline of the capture window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  华为小米荣耀手机今日集体调价: {
    titleEn: "Huawei, Xiaomi and Honor raise phone prices",
    whyTrending:
      "On 1–2 September Huawei, Xiaomi and Honor raised prices on several handsets, with some Mate models up several hundred to ¥1,000. The three brands blamed chip and memory costs; Weibo realtime led on 老款手机集体涨价 while Baidu ranked their customer-service replies — a national hardware story with Shenzhen/GBA brand relevance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  多款手机正式涨价: {
    titleEn: "Several phone models officially raise prices",
    whyTrending:
      "Weibo realtime and tech both topped out on the handset price-hike wave covering Huawei, Xiaomi and Honor. The same story led Baidu as memory and Qualcomm cost pressure hit retail tags, with follow-on rows about unsold stock and cancelled 'wait for a discount' plans.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "“香港大药房”不卖药也不在香港": {
    titleEn: "'Hong Kong Grand Pharmacy' sells no medicine and is not in Hong Kong",
    whyTrending:
      "China's TCM administration named a viral 'Hong Kong Grand Pharmacy' e-commerce scam that neither sold medicine nor operated in Hong Kong. Platforms took down 35 unlicensed shops and 3,318 product links — a direct GBA brand-misuse story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  百度完成双重主要上市: {
    titleEn: "Baidu completes dual primary listing in Hong Kong",
    whyTrending:
      "Baidu said on 1 September its conversion from a secondary to a dual-primary listing on the Hong Kong Stock Exchange took effect, alongside Nasdaq. A direct HK-market and GBA listing story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  库克正式卸任苹果CEO: {
    titleEn: "Tim Cook steps down as Apple CEO",
    whyTrending:
      "Tim Cook's last day as Apple CEO was 31 August, with hardware SVP John Ternus taking over on 1 September and Cook moving to executive chairman. Weibo tech and realtime both ranked the succession.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "20项措施推动消费扩容升级": {
    titleEn: "20 measures to expand and upgrade consumption",
    whyTrending:
      "Seven ministries issued an 31 August implementation plan with 20 measures to expand goods consumption in the 15th Five-Year Plan period, covering autos, silver-economy goods and AI consumer products. A national 民生/demand-side policy spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "深圳校服 去商场自己买": {
    titleEn: "Shenzhen school uniforms — buy them at the mall",
    whyTrending:
      "Shenzhen parents searched a back-to-school rule that uniforms should be bought at malls rather than through campus bulk orders. A direct GBA education-cost story on 1 September term opening.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  袁絲珩: {
    titleEn: "Yuen Sze-hang / Bernice Yuen (Miss HK 2026)",
    whyTrending:
      "Bernice Yuen (袁絲珩) led Hong Kong's 48-hour board at 50K+ with 1,000% growth after winning Miss Hong Kong 2026 on 30 August. Related queries included 李澤欣, 謝淑怡 and 香港小姐2026. Pageant/celebrity spike; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  梅艷芳: {
    titleEn: "Anita Mui",
    whyTrending:
      "Anita Mui searches hit 20K+ after her mother Tam Mei-kam died at 102 on 30 August. Related queries included 覃美金, 梅啟明 and 梅艷芳 母親. An obituary/estate story, not celebrity gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "快速 增強": {
    titleEn: "Rapid intensification (tropical cyclone)",
    whyTrending:
      "Hong Kong users searched 快速 增強 at 5K+ with 1,000% growth as Observatory and weather pages discussed whether a nearby tropical system could rapidly intensify. Related query 快速增強 sat on the same 48-hour board as 氣旋.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  曼聯對葉士域治: {
    titleEn: "Manchester United vs Ipswich Town",
    whyTrending:
      "Cantonese searches for Manchester United vs Ipswich jumped to 10K+ with 1,000% growth after the Premier League weekend. Related queries included 曼聯, 葉士域治 and the English twin man united vs ipswich town.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  洪水: {
    titleEn: "Floods",
    whyTrending:
      "Flood searches hit 2K+ with 700% growth on Hong Kong Google. Related query 地震 sat alongside Gyirong/Nepal disaster coverage and local rain-risk checks in the same 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "miss hk 2026": {
    titleEn: "Miss Hong Kong 2026",
    whyTrending:
      "English Miss Hong Kong 2026 searches tracked Bernice Yuen's 30 August win. Related queries included bernice yuen miss hong kong 2026. Pageant/celebrity; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  麥當勞優惠: {
    titleEn: "McDonald's deals",
    whyTrending:
      "McDonald's promotion searches hit 500+ as Hong Kong users looked up app coupons and limited-time meal deals during the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "man united vs ipswich town": {
    titleEn: "Manchester United vs Ipswich Town",
    whyTrending:
      "English-language searches for Manchester United vs Ipswich hit 2K+ with 800% growth after the Premier League fixture. Related query manchester united paired with the Cantonese twin 曼聯對葉士域治.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "coleman wong": {
    titleEn: "Coleman Wong (tennis)",
    whyTrending:
      "Hong Kong tennis player Coleman Wong trended at 1K+ as users checked his US Open 2026 results. Sports searches, not celebrity gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  天水圍: {
    titleEn: "Tin Shui Wai",
    whyTrending:
      "Tin Shui Wai district searches hit 2K+ with 1,000% growth on Hong Kong's 48-hour board. The spike sat in the same weather-and-local-news window as flood and cyclone queries.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  蔬菜: {
    titleEn: "Vegetables",
    whyTrending:
      "Vegetable-price searches hit 1K+ as Hong Kong shoppers tracked wet-market and supermarket costs during the 48-hour capture.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  切爾西對布萊頓: {
    titleEn: "Chelsea vs Brighton",
    whyTrending:
      "Cantonese searches for Chelsea vs Brighton jumped to 2K+ after the Premier League weekend. Hong Kong fans tracked the same English-football slate as the Manchester United fixture.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  六合彩: {
    titleEn: "Mark Six lottery",
    whyTrending:
      "Hong Kong's Mark Six lottery hit 10K+ on the 48-hour board as users checked 六合彩結果 and 六合彩攪珠結果 after the latest draw. Related queries stayed on results pages rather than a separate entertainment spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  熱刺對紐卡索聯: {
    titleEn: "Tottenham vs Newcastle United",
    whyTrending:
      "Cantonese searches for Tottenham vs Newcastle jumped to 5K+ with 1,000% growth after the Premier League weekend. Related queries included 利物浦對諾丁漢森林 and 熱刺 as Hong Kong fans tracked Saturday's English-football slate.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "麥當勞 優惠": {
    titleEn: "McDonald's deals",
    whyTrending:
      "McDonald's promotion searches hit 2K+ as Hong Kong users looked up app coupons and limited-time meal deals. Related queries included 麥當勞 and 麥當勞優惠 during the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "天 晴 邨": {
    titleEn: "Tin Ching Estate",
    whyTrending:
      "Tin Ching Estate (天晴邨) in Tin Shui Wai climbed to 1K+ with 800% growth. Local users searched the estate name after neighbourhood headlines circulated in the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿森纳足球俱乐部: {
    titleEn: "Arsenal Football Club",
    whyTrending:
      "Simplified-character Arsenal searches hit 1K+ as Hong Kong fans tracked the Gunners after the Premier League opening weekend. The spike sat alongside other EPL club queries on the same 48-hour board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  王楚欽: {
    titleEn: "Wang Chuqin (table tennis)",
    whyTrending:
      "Olympic table-tennis star Wang Chuqin trended at 1K+ with 1,000% growth as Hong Kong users checked his latest match results. Sports searches, not celebrity gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  氣旋: {
    titleEn: "Cyclone",
    whyTrending:
      "Cyclone searches hit 2K+ with 1,000% growth on Hong Kong's 48-hour board. Related query 天文台時間 tracked Observatory clock and warning times as users watched a nearby tropical system.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  星岛日报: {
    titleEn: "Sing Tao Daily",
    whyTrending:
      "The Chinese-language newspaper Sing Tao Daily ticked up on Hong Kong Google as readers searched the masthead and latest local headlines.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  謝賢: {
    titleEn: "Patrick Tse (actor)",
    whyTrending:
      "Veteran actor Patrick Tse (謝賢) hit 5K+ with 1,000% growth on Hong Kong's 48-hour board. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  李焯寧: {
    titleEn: "Lee Cheuk-ning",
    whyTrending:
      "Lee Cheuk-ning trended at 2K+ after entertainment coverage circulated locally. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  陳懿德: {
    titleEn: "Chan Yi-tak",
    whyTrending:
      "Chan Yi-tak ranked at 5K+ with related queries for 羅天宇 and 梁凱晴. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  黎諾懿: {
    titleEn: "Wayne Lai (actor)",
    whyTrending:
      "TVB actor Wayne Lai (黎諾懿) hit 5K+ with 1,000% growth. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  何超雲: {
    titleEn: "Ho Chiu-wan",
    whyTrending:
      "Ho Chiu-wan trended at 500+ after social-circle coverage. Celebrity/socialite; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  莊雅婷: {
    titleEn: "Chong Nga-ting",
    whyTrending:
      "Chong Nga-ting ranked on Hong Kong Google during the 48-hour window. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  許廷鏗: {
    titleEn: "Alfred Hui (singer)",
    whyTrending:
      "Cantopop singer Alfred Hui (許廷鏗) trended at 500+. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  張繼科: {
    titleEn: "Zhang Jike (table tennis)",
    whyTrending:
      "Zhang Jike hit 2K+ with related query 景甜張繼科 after tabloid coverage of the retired paddler. Celebrity/tabloid spike; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  '弘扬“上海精神” 凝聚“上合力量”': {
    titleEn: "Carry forward the Shanghai Spirit — SCO cohesion",
    whyTrending:
      "Baidu realtime topped out as Xi Jinping prepared to attend the 2026 SCO summit in Bishkek (30 Aug–3 Sep) and pay state visits to Kyrgyzstan and Egypt. State media framed 25 years of the Shanghai Spirit as the diplomatic headline of the week.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  西藏泥石流已致16人遇难546人失联: {
    titleEn: "Xizang mudslide: 16 dead, 546 missing",
    whyTrending:
      "Xizang authorities updated the Gyirong debris-flow toll to 16 dead and 546 missing as of the 30 August briefing. The transboundary disaster from a Nepal-side ice-rock avalanche kept national search traffic at the top of Baidu.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  西藏泥石流灾害原因现已查明: {
    titleEn: "Xizang mudslide cause identified",
    whyTrending:
      "A 30 August Gyirong press briefing said a glacier on Nepal's Lanangtse south face fractured at about 5,200 m at 10:52 on 26 August, triggering an ice-rock avalanche that became a debris flow. Officials said the surge reached China's Gyirong Port in only six to seven minutes.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中国汽车何以全球圈粉: {
    titleEn: "Why Chinese cars are winning globally",
    whyTrending:
      "State-media explainers on Chinese NEV exports — from vehicle shipments to full industrial-ecosystem outbound investment — dominated Baidu as analysts debated the sector's overseas push. Directly relevant to GBA auto manufacturing.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "12306回应乘客称二等座变无座": {
    titleEn: "12306 responds after second-class seats became standing",
    whyTrending:
      "A G116 Changchun–Shenyang train swapped a Fuxing set for a Hexie, leaving some second-class passengers without seats; a pregnant traveller stood for over an hour. 12306 said the rolling-stock change was last-minute and offered no compensation, sparking a national railway-rights debate.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "常冰玉10-7击败世界第一赵心童夺冠": {
    titleEn: "Chang Bingyu beats world No.1 Zhao Xintong 10–7",
    whyTrending:
      "Chang Bingyu won his first ranking title at the Wuhan Open, beating world No.1 Zhao Xintong 10–7 after a world-class clearance in a deficit frame. National snooker traffic spiked across Baidu and Weibo.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  多地立法严控学生带手机入校: {
    titleEn: "Cities legislate school phone bans — including Guangzhou",
    whyTrending:
      "Chongqing, Guangzhou, Zhengzhou and Fujian issued rules letting schools bar student phones, upgrading campus mobile policy into local law. Guangzhou's inclusion makes it a direct GBA education story; the rules also limit schools to custody, not destruction, of devices.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中国集成电路海外大爆发: {
    titleEn: "China IC exports surge overseas",
    whyTrending:
      "China's integrated-circuit exports in the first seven months already topped last year's full-year total, up 99.5% year on year, with memory chips the main driver. Factories reported cash-up-front orders booked into 2028 — a national semiconductor story with GBA electronics-supply relevance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  硬科技开始拯救商场了: {
    titleEn: "Hard-tech brands move into malls — Guangzhou store cited",
    whyTrending:
      "3D-printer maker Bambu Lab opened an East China flagship in Hangzhou MixC after a Guangzhou experience store, as humanoid robots and AI glasses brands chase mall traffic. The Guangzhou footprint keeps the retail-tech story inside the GBA.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  王毅同尼泊尔外长通电话: {
    titleEn: "Wang Yi phones Nepal's foreign minister",
    whyTrending:
      "Foreign Minister Wang Yi told Nepal's FM the Gyirong ice-avalanche debris flow was the most serious cross-border disaster between the two countries in years. The call kept the rescue-diplomacy thread on Baidu after the 30 August casualty update.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "网友建议取消ETC 官方回应": {
    titleEn: "MOT responds to calls to scrap ETC",
    whyTrending:
      "China's transport ministry said ETC remains voluntary and highlighted a phone-plus licence-plate 'cardless' pilot already running in several provinces. A national mobility-policy story that also ranked on Weibo tech.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  吉隆泥石流已致16人遇难546人失联: {
    titleEn: "Gyirong mudslide: 16 dead, 546 missing",
    whyTrending:
      "Weibo realtime topped out on the same 30 August Gyirong casualty update as Baidu — 16 dead and 546 missing after the 26 August transboundary debris flow. Rescue and briefing clips kept the topic at rank 1.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  尼泊尔山洪已致675死2498失联: {
    titleEn: "Nepal floods: 675 dead, 2,498 missing",
    whyTrending:
      "Nepal's flood-and-debris-flow toll — 675 dead and 2,498 missing — trended as the upstream half of the same Gyirong transboundary disaster. Weibo users compared Nepal-side and Tibet-side casualty figures after the 30 August briefings.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  AI赋能新电商发展: {
    titleEn: "AI-powered new e-commerce",
    whyTrending:
      "A national digital-commerce policy thread — AI enabling 'new e-commerce' — held Weibo rank 3 with ~729k heat. Mainland platforms and GBA cross-border sellers are the practical audience for the campaign.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  吉隆口岸小邬警官确认平安: {
    titleEn: "Gyirong Port officer Xiao Wu confirmed safe",
    whyTrending:
      "Weibo users circulated confirmation that a widely followed Gyirong Port officer survived the debris flow. The human-interest update sat inside the same national rescue story, not a separate gossip spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  户上隼辅回应3比2樊振东: {
    titleEn: "Tojo Shunsuke on beating Fan Zhendong 3–2",
    whyTrending:
      "Japan's Tojo Shunsuke spoke after beating Olympic champion Fan Zhendong 3–2 in the German Cup last 16, knocking Fan's club out. National table-tennis traffic followed the 29 August result.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  金价暴跌之前有人直接清仓: {
    titleEn: "Some dumped gold before the price crash",
    whyTrending:
      "Weibo gold-price threads claimed some traders cleared positions before a sharp bullion drop. The same national gold-retail debate that has recurred on mainland boards this month.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "14家央国企将开放超60亿条高价值数据": {
    titleEn: "14 central SOEs to open 6 billion-plus high-value data records",
    whyTrending:
      "A national data-element reform item — 14 central state firms opening more than 6 billion high-value records — ranked on both Weibo realtime and the tech board. Directly relevant to GBA cloud and fintech buyers.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  小米18Fold: {
    titleEn: "Xiaomi 18 Fold",
    whyTrending:
      "Lei Jun said Xiaomi 18 Fold will use a √2:1 aspect ratio, and Weibo tech compared the foldable with Huawei on the same board. A GBA handset-hardware spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中国半导体两个好消息: {
    titleEn: "Two pieces of good news for China's semiconductors",
    whyTrending:
      "Weibo tech framed ChangXin LPDDR6 mass production and related memory-export strength as twin semiconductor wins. The same capture window as Baidu's IC-export surge story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  华为三折叠11年前手稿: {
    titleEn: "Huawei's trifold sketches from 11 years ago",
    whyTrending:
      "Huawei circulated 11-year-old trifold-phone sketches as Yu Chengdong previewed a new triple-fold device. A national hardware story with Shenzhen HQ relevance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  长鑫存储: {
    titleEn: "ChangXin Memory (CXMT)",
    whyTrending:
      "ChangXin Memory dominated Weibo tech after LPDDR6 mass-production headlines and a reported lawsuit involving the US Pentagon. Domestic DRAM self-reliance is a GBA electronics-supply story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  波场前高管说孙宇晨做事底线很低: {
    titleEn: "Ex-Tron exec says Justin Sun has a very low bar",
    whyTrending:
      "A former Tron executive's attack on Justin Sun topped Weibo tech, overlapping the same week's Jing Tian civil-suit chatter. Crypto-governance news rather than entertainment gossip.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  周嘉洛: {
    titleEn: "Koo Ka-lok (TVB actor)",
    whyTrending:
      "TVB actor Koo Ka-lok trended at 10K+ after 驅魔速遞 filming and co-star coverage. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  遺囑: {
    titleEn: "Will / testament",
    whyTrending:
      "Hong Kong Google listed 遗嘱 at 5K+ with 1,000% growth in the same 48-hour window as Hui Ka Yan's Shenzhen life sentence and full asset confiscation. Users searched estate-and-will language around the Evergrande verdict rather than a separate gossip spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  遗嘱: {
    titleEn: "Will / testament",
    whyTrending:
      "Hong Kong Google listed 遗嘱 at 5K+ with 1,000% growth in the same 48-hour window as Hui Ka Yan's Shenzhen life sentence and full asset confiscation. Users searched estate-and-will language around the Evergrande verdict rather than a separate gossip spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  鬥牛梗: {
    titleEn: "Bull terrier",
    whyTrending:
      "Related queries for 格鬥犬, 唐狗 and 打鼓嶺 spiked after a 33-year-old pet-hotel operator in Ta Kwu Ling was fatally attacked on 20 August. Police said CCTV showed a ~30kg mixed bull terrier mauling her for about a minute.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  狗咬死人: {
    titleEn: "Fatal dog attack",
    whyTrending:
      "Hong Kong searches for a fatal dog mauling jumped after the 20 August Ta Kwu Ling pet-hotel death. AFCD took the dog for observation while Border District crime squad investigated possible negligence.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  英超: {
    titleEn: "English Premier League",
    whyTrending:
      "Hong Kong's 48-hour board topped out on 英超 at 20K+ after Hull City beat Manchester United 2–0 on the opening weekend. Related queries included 赫爾城對曼聯 and the English-language twin epl.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  兵工廠對科芬特里城: {
    titleEn: "Arsenal vs Coventry City",
    whyTrending:
      "Cantonese search wording for Arsenal's 3–0 opening-day win over newly promoted Coventry. Related queries included 阿仙奴 and 高雲地利 as Hong Kong fans tracked the EPL kickoff.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "熱帶 風暴": {
    titleEn: "Tropical storm",
    whyTrending:
      "Hong Kong Observatory tropical-storm and cyclone queries climbed as a weather system near the South China Sea drew typhoon-season attention. Related terms included 熱帶氣旋 and 天文台時間.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  热带气旋: {
    titleEn: "Tropical cyclone",
    whyTrending:
      "Simplified-character searches for a tropical cyclone tracked the same Observatory alert window, with related queries for HKO clock and local warning times.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  热带低压: {
    titleEn: "Tropical depression",
    whyTrending:
      "Tropical-depression searches rose alongside 熱帶 風暴 as Hong Kong users checked whether a nearby low would intensify during the 48-hour capture.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "超級 市場": {
    titleEn: "Supermarket",
    whyTrending:
      "Hong Kong supermarket queries, including 百佳超市 / ParknShop, climbed in the 48-hour window as shoppers tracked grocery prices. The spike overlapped mainland coverage of egg prices jumping 15.5% in nine days.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  宣萱: {
    titleEn: "Jessica Hsuan (actress)",
    whyTrending:
      "Actress Jessica Hsuan trended with related queries for 古天樂 and his concert. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  梁朝偉: {
    titleEn: "Tony Leung (actor)",
    whyTrending:
      "Tony Leung Chiu-wai ranked on Hong Kong Google during the 48-hour window. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  补贴: {
    titleEn: "Subsidies",
    whyTrending:
      "Simplified-character subsidy searches in Hong Kong tracked the same 48-hour window as Beijing's 12.4 trillion yuan livelihood-funding briefing and childcare-subsidy rollout.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  癌症疫苗: {
    titleEn: "Cancer vaccine",
    whyTrending:
      "Moderna and Merck reported the first positive Phase 3 readout for a personalised mRNA cancer vaccine in resected melanoma, sending Moderna shares sharply higher then lower as traders digested the news.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  肿瘤疫苗迎百年破局: {
    titleEn: "Tumour vaccine hailed as a century breakthrough",
    whyTrending:
      "Weibo framed the Moderna–Merck Phase 3 melanoma result as a once-in-a-century opening for therapeutic cancer vaccines, pulling medical and biotech searches onto the realtime board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  首个治疗性癌症疫苗: {
    titleEn: "First therapeutic cancer vaccine",
    whyTrending:
      "Coverage of intismeran autogene plus Keytruda meeting recurrence-free and distant-metastasis endpoints made 'first therapeutic cancer vaccine' a national search spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  雷暴: {
    titleEn: "Thunderstorm",
    whyTrending:
      "Hong Kong Observatory issued thunderstorm warnings and special weather tips as heavy-rain cells approached from the south and east. Related queries for low pressure and HKO spiked with the 48h monsoon pulse.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  許家印: {
    titleEn: "Hui Ka Yan (Evergrande)",
    whyTrending:
      "Shenzhen Intermediate People's Court on 20 August sentenced Evergrande founder Hui Ka Yan to life imprisonment and confiscation of personal assets. The GBA verdict also fined Evergrande Group and Evergrande Real Estate billions of yuan.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  许家印: {
    titleEn: "Hui Ka Yan (Evergrande)",
    whyTrending:
      "Simplified-character searches tracked the same Shenzhen first-instance verdict sentencing Hui Ka Yan to life and confiscating his assets over the Evergrande fraud case.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  風暴: {
    titleEn: "Storm",
    whyTrending:
      "Storm-related searches rose with Observatory thunderstorm warnings and two low-pressure areas near the South China Sea and east of Taiwan that could affect the Guangdong coast into the weekend.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  华为PuraXView: {
    titleEn: "Huawei Pura X View",
    whyTrending:
      "Huawei unveiled Pura X View, billed as the first wide-screen candybar phone, at the Harmony Intelligent Mobility launch alongside the Stelato G9. Yu Chengdong said it will ship with HarmonyOS 7, with pre-sales from 28 August.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
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
  熱帶性低氣壓: {
    titleEn: "Tropical depression",
    whyTrending:
      "Tropical-depression queries rose with 熱帶氣旋警報 as HKO tracked TD Sardel about 540 km north-northeast of Hong Kong and weakening inland. Related weather searches stayed active through the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  西藏泥石流已致7人遇难554人失联: {
    titleEn: "Xizang mudslide: 7 dead, 554 missing",
    whyTrending:
      "Xizang emergency authorities said that as of 01:00 on 29 August the Gyirong debris flow had killed 7 and left 554 missing, with 2 villagers rescued. Casualty updates kept the national realtime board elevated.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  西藏吉隆泥石流: {
    titleEn: "Gyirong, Xizang debris flow",
    whyTrending:
      "Weibo's main disaster keyword as rescue teams pushed into Gyirong Port after the 26 August transboundary debris flow. Ranked just behind the table-tennis row with ~804k heat.",
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
      "Weibo ranked 台风 as Tropical Storm Saudel (沙德爾) and a second system, Kolawan (科罗旺), tracked the western Pacific. The same weather window drove Hong Kong Google's 100K+ 熱帶風暴 沙德爾 spike and Baidu's dual-typhoon path update.",
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
  英格蘭對阿根廷: {
    titleEn: "England vs Argentina",
    whyTrending:
      "Argentina beat England 2-1 in the World Cup semifinal overnight on 16 July, sending Hong Kong users to Google for live scores, highlights and Argentina–Spain final preview.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  八达通: {
    titleEn: "Octopus card",
    whyTrending:
      "Hong Kong's Octopus contactless payment card trended as users searched fare updates, mobile-wallet linking and retail promotions during the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  天文台: {
    titleEn: "Hong Kong Observatory",
    whyTrending:
      "Hong Kong Observatory searches hit 50K+ on the 48-hour board as a red rainstorm warning and squally showers drove users to radar and signal pages. Related queries included 天气. The same window also lifted English HKO and hk observatory lookups.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  紅雨: {
    titleEn: "Red rainstorm warning",
    whyTrending:
      "A red rainstorm warning (紅雨) jumped to 20K+ as Hong Kong checked Observatory alerts. Related queries included 天氣, 香港天文台 and 香港天氣. The signal overlapped the same 48-hour weather burst as 天文台.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "徐 杰 歌手": {
    titleEn: "Xu Jie (Taiwan child-star singer)",
    whyTrending:
      "Hong Kong users searched Taiwan child-star singer Xu Jie after reports he died of liver disease at 29. Family handled the funeral quietly in July; local media confirmed the death this week. Obituaries are treated as news, not gossip, on this board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  泥石流: {
    titleEn: "Mudslide / debris flow",
    whyTrending:
      "Gyirong Port and Nepal-side debris-flow searches stayed elevated after the Himalayan ice-rock collapse. Baidu put the Nepal death toll at 1,093; Weibo ranked the barrier lake above Gyirong as fully drained.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  草間彌生: {
    titleEn: "Yayoi Kusama",
    whyTrending:
      "Yayoi Kusama (草間彌生) spiked after reports of the Japanese artist's death. Hong Kong searches followed international art-world coverage within the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  周國豐: {
    titleEn: "Chow Kwok-fung (singer)",
    whyTrending:
      "TVB singing-contest personality Chow Kwok-fung trended with related query 中年好聲音系列. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  "惠 康": {
    titleEn: "Wellcome (supermarket)",
    whyTrending:
      "Wellcome (惠康) supermarket searches hit 5K+ with 1,000% growth in Hong Kong. Users looked up store news and promotions during the 48-hour window.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "apm 打小朋友": {
    titleEn: "APM mall child-assault reports",
    whyTrending:
      "Local searches for an alleged assault on a child at Kwun Tong's APM mall reached 1K+ with related query apm 打人. Hong Kong users looked up incident reports and mall security updates.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中元節: {
    titleEn: "Hungry Ghost Festival",
    whyTrending:
      "Hungry Ghost Festival (中元節) queries rose around the lunar 14th/15th of the seventh month. Related term 農曆七月14 marked the Hong Kong observance date.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "大 快活": {
    titleEn: "Café de Coral",
    whyTrending:
      "Café de Coral fast-food chain queries rose as Hong Kong diners looked up menu deals, branch hours and summer promotions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  書展: {
    titleEn: "Hong Kong Book Fair",
    whyTrending:
      "Book Fair searches climbed ahead of the annual Hong Kong event as readers hunted exhibitor lists, ticket details and author schedules.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  羅家英: {
    titleEn: "Law Kar-ying (actor)",
    whyTrending:
      "Veteran actor Law Kar-ying trended after renewed media coverage of his health update and public appearances circulated locally.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  dse: {
    titleEn: "HKDSE exams",
    whyTrending:
      "Hong Kong DSE results season pushed exam-grade and university-admission queries as students and parents checked release timelines and cut-off scores.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "法國 對 西班牙": {
    titleEn: "France vs Spain",
    whyTrending:
      "Spain's 2-0 World Cup semifinal win over France kept match replay and final-preview searches high among Hong Kong football fans.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  逃票: {
    titleEn: "Fare evasion",
    whyTrending:
      "MTR fare-evasion enforcement stories drew commuter searches for penalties, appeals and recent crackdown cases.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  梅西: {
    titleEn: "Lionel Messi",
    whyTrending:
      "Messi searches followed Argentina's semifinal win as fans looked up his assists, fitness and role in the World Cup final against Spain.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  安素費南迪斯: {
    titleEn: "Enzo Fernández",
    whyTrending:
      "Enzo Fernández trended after his combative role in Argentina's physical World Cup semifinal against England drew highlight and discipline searches.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷: {
    titleEn: "Argentina",
    whyTrending:
      "Argentina national team queries surged after the 2-1 semifinal win set up a World Cup final showdown with Spain on 20 July.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  天文台時間: {
    titleEn: "Observatory time",
    whyTrending:
      "Users checked official Hong Kong Observatory clock and warning-issue times alongside active thunderstorm alerts.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  天气: {
    titleEn: "Weather",
    whyTrending:
      "Weather keyword searches rose among Hong Kong users tracking local rain warnings and cross-border travel conditions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  私煙: {
    titleEn: "Contraband cigarettes",
    whyTrending:
      "Illegal-cigarette enforcement and duty-evasion cases pushed tobacco-control and customs-penalty searches in Hong Kong.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  世界杯: {
    titleEn: "World Cup",
    whyTrending:
      "World Cup bracket and final-preview searches dominated after Argentina and Spain reached the championship match.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  杜曹: {
    titleEn: "Du Chao (football pundit)",
    whyTrending:
      "Football pundit Du Chao trended on Hong Kong Google as World Cup semifinal commentary and post-match analysis clips circulated.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  习近平在上海考察: {
    titleEn: "Xi Jinping inspects Shanghai",
    whyTrending:
      "President Xi Jinping's Shanghai inspection tour topped Baidu realtime as state media amplified tech, manufacturing and urban-development visits ahead of major policy messaging.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "美军对驶往伊朗油轮射“地狱火”导弹": {
    titleEn: "US fires Hellfire at tanker bound for Iran",
    whyTrending:
      "Middle East escalation drove Baidu traffic as reports said US forces struck an oil tanker heading for Iran, deepening Iran–US tension searches.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  家长月薪3500元请大学生暑假带娃: {
    titleEn: "Parent on ¥3,500 salary hires student nanny",
    whyTrending:
      "A viral childcare-cost debate trended as a parent on a modest salary hired a university student for summer childcare, sparking nationwide affordability discussion.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "伊朗“无意谈判”再袭美军基地": {
    titleEn: "Iran hits US base, says no talks intent",
    whyTrending:
      "Iran-related military headlines spiked after Tehran signalled no interest in negotiations while reporting fresh strikes on US facilities.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "飞了40多年 深圳这座机场要搬了": {
    titleEn: "Shenzhen airport relocating after 40 years",
    whyTrending:
      "Shenzhen's long-serving airport relocation plan trended on Baidu as GBA residents searched timeline, new site details and aviation impact for the Bay Area hub.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷绝杀英格兰: {
    titleEn: "Argentina stoppage-time win over England",
    whyTrending:
      "Argentina's 2-1 World Cup semifinal comeback over England topped Weibo realtime hot overnight on 16 July with highlight clips and referee-debate threads.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "贝林厄姆 赛后打人": {
    titleEn: "Bellingham confronts opponent post-match",
    whyTrending:
      "Jude Bellingham's post-match confrontation after England's semifinal loss trended on Weibo with video clips of the touchline scuffle.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  Apple智能: {
    titleEn: "Apple Intelligence",
    whyTrending:
      "Apple Intelligence approval and China launch timing drove Weibo tech search after regulators cleared on-device AI features for mainland iPhones.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "苹果AI 千问": {
    titleEn: "Apple AI × Qwen",
    whyTrending:
      "Alibaba Qwen integration into Apple AI for China trended as users debated Siri replacements and on-device model access for mainland iPhones.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  小米MiMo通过国家大模型备案: {
    titleEn: "Xiaomi MiMo passes LLM filing",
    whyTrending:
      "Xiaomi's MiMo large-model filing approval hit Weibo tech hot as users tracked domestic AI compliance and product launch timelines.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  苹果AI国行版已过审: {
    titleEn: "Apple AI China version approved",
    whyTrending:
      "Regulatory clearance for Apple Intelligence on mainland iPhones spiked tech search as users anticipated iOS feature rollouts.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  什么工作不会被AI替代: {
    titleEn: "Jobs AI won't replace",
    whyTrending:
      "Career-anxiety debate trended on Weibo tech as AI rollouts prompted users to discuss which professions remain resilient to automation.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷2比1淘汰英格兰: {
    titleEn: "Argentina beats England 2-1, faces Spain in final",
    whyTrending:
      "Argentina's 2-1 World Cup semifinal win over England dominated Baidu realtime as users searched highlights, scorers and the 20 July final against Spain.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "阿根廷2比1淘汰英格兰 决赛战西班牙": {
    titleEn: "Argentina beats England 2-1, faces Spain in final",
    whyTrending:
      "Argentina's 2-1 World Cup semifinal win over England dominated Baidu realtime as users searched highlights, scorers and the 20 July final against Spain.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  世界杯决赛对阵图来了: {
    titleEn: "World Cup final bracket graphic",
    whyTrending:
      "Spain versus Argentina final matchup graphics trended on Baidu after both teams won their semifinals, setting up the 20 July championship.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷连续4场绝杀: {
    titleEn: "Argentina four straight late winners",
    whyTrending:
      "Argentina's streak of four consecutive stoppage-time knockout wins in the 2026 World Cup trended as fans searched comeback highlights and final odds.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  英格兰vs阿根廷: {
    titleEn: "England vs Argentina",
    whyTrending:
      "The England–Argentina World Cup semifinal dominated Weibo realtime hot as users shared foul-heavy highlight reels and Argentina's 2-1 comeback win.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "二季度GDP增长4.3% 怎么看": {
    titleEn: "Q2 GDP growth 4.3% — analysis",
    whyTrending:
      "China's Q2 GDP print at 4.3% YoY trended on Baidu as analysts debated the slowdown from Q1's 5.0% and implications for stimulus and GBA manufacturing.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  网红白狮阿杭离世: {
    titleEn: "Guangzhou Zoo star lion Ah Hang dies",
    whyTrending:
      "Guangzhou Zoo's beloved white lion Ah Hang died on 14 July, trending on Baidu as visitors mourned the 17-year-old 'fringe-cut lion' icon.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  DeepSeek工资待遇太恐怖了: {
    titleEn: "DeepSeek pay packages shock netizens",
    whyTrending:
      "DeepSeek compensation figures trended on Weibo tech as users debated AI talent wars and mainland tech-sector pay scales.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  中国用户终于迎来满血iPhone: {
    titleEn: "China users get full-featured iPhone",
    whyTrending:
      "Weibo tech traffic rose as Apple Intelligence and Qwen integration promised mainland iPhone users parity with global AI features after regulatory approval.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  长鑫科技IPO: {
    titleEn: "ChangXin Technology IPO",
    whyTrending:
      "Memory-chip maker ChangXin's IPO filing trended on Weibo tech amid domestic semiconductor self-reliance debates relevant to GBA electronics supply chains.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  小米人形机器人: {
    titleEn: "Xiaomi humanoid robot",
    whyTrending:
      "Xiaomi humanoid-robot demos hit Weibo tech hot as users compared domestic robotics progress with global AI hardware competition.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "紅 雨 停課": {
    titleEn: "Red rainstorm class suspension",
    whyTrending:
      "Hong Kong's red rainstorm warning overlapped with school hours on 16–17 July, driving searches for Education Bureau suspension notices and Observatory alert updates.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "英格蘭 對 阿根廷": {
    titleEn: "England vs Argentina",
    whyTrending:
      "Argentina beat England 2-1 in the World Cup semifinal overnight on 16 July, sending Hong Kong users to Google for live scores, highlights and Argentina–Spain final preview.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "hku space": {
    titleEn: "HKU SPACE",
    whyTrending:
      "HKU School of Professional and Continuing Education queries rose as Hong Kong learners searched summer course enrolment, exam timetables and campus updates.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  張學友: {
    titleEn: "Jacky Cheung (singer)",
    whyTrending:
      "Cantopop star Jacky Cheung spiked entertainment searches after fresh concert and media coverage circulated during the 48-hour capture window.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  杜汶澤: {
    titleEn: "Chapman To (actor)",
    whyTrending:
      "Actor Chapman To trended on Hong Kong Google after controversial social-media posts and entertainment headlines drew fan searches.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  吳綺莉: {
    titleEn: "Marylin Wu (actress)",
    whyTrending:
      "Actress Marylin Wu drove celebrity entertainment searches amid renewed tabloid coverage during the capture window.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  人民的小事就是我们的大事: {
    titleEn: "People's small matters are our big matters (Xi line)",
    whyTrending:
      "President Xi Jinping's Shanghai community visit on 15 July — highlighting urban renewal and 'toilet-free' housing upgrades — topped Baidu realtime as state media amplified the livelihood slogan.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "前一秒石库门 下一秒进未来": {
    titleEn: "From shikumen lanes to the AI future",
    whyTrending:
      "Shanghai's World AI Conference (WAIC) build-up trended on Baidu as promotional content contrasted historic shikumen neighbourhoods with the city's AI-industry ambitions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "TVB演员梁爱在养老院去世": {
    titleEn: "TVB actress Leung Oi dies in nursing home",
    whyTrending:
      "Veteran TVB actress Leung Oi died aged 87 at a Shenzhen nursing home on 8 July; her family announced the news on 16 July, trending across Baidu and GBA entertainment searches.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "伊朗：美军事打击构成“战争罪”": {
    titleEn: "Iran: US strikes are war crimes",
    whyTrending:
      "Tehran's accusation that US military strikes constitute war crimes trended on Baidu as Middle East escalation and oil-tanker incidents kept Iran–US tension in national search traffic.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "外露式、半隐藏门把手“集体回归”": {
    titleEn: "Exposed and semi-hidden car door handles return",
    whyTrending:
      "A wave of July 16 new-car launches — including XPeng MONA L03 and Li Auto L6 — revived debate on door-handle safety after hidden-handle incidents, topping Baidu auto search.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  FIFA回应是否处罚阿根廷: {
    titleEn: "FIFA response on Argentina penalty",
    whyTrending:
      "Weibo users searched whether FIFA would sanction Argentina after a physical World Cup semifinal against England, following controversy over fouls and stoppage-time goals.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  世界杯也有冠军戒指了: {
    titleEn: "World Cup now has championship rings",
    whyTrending:
      "FIFA's new World Cup winner ring design trended on Weibo as fans debated memorabilia and compared the rings to US sports championship traditions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷西班牙争夺大力神杯: {
    titleEn: "Argentina vs Spain for World Cup trophy",
    whyTrending:
      "Argentina–Spain final preview searches surged on Weibo after both teams won their semifinals, setting up the 20 July championship in New York.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿根廷的最后十分钟怎么了: {
    titleEn: "What happened in Argentina's last ten minutes",
    whyTrending:
      "Highlight clips of Argentina's stoppage-time comeback against England trended on Weibo as users rewatched the chaotic final minutes of the semifinal.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  A股: {
    titleEn: "A-shares (mainland stocks)",
    whyTrending:
      "Mainland A-share market moves trended on Weibo as investors tracked chip, EV and AI sector volatility during the mid-July trading week.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  服务员帮人传话多次叫女顾客去包厢: {
    titleEn: "Waiter repeatedly summons diner to private room",
    whyTrending: "",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: false,
  },
  補貼: {
    titleEn: "Subsidies / rebates",
    whyTrending:
      "Government subsidy and consumer-rebate keywords trended as Hong Kong residents searched transport concessions, energy allowances and retail cashback schemes.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  退休: {
    titleEn: "Retirement",
    whyTrending:
      "Retirement-planning searches rose in Hong Kong amid discussions of MPF withdrawals, pension age and post-pandemic workforce transitions.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  陣風: {
    titleEn: "Squalls / gusty winds",
    whyTrending:
      "Squally-shower and gust warnings from the Hong Kong Observatory pushed wind-related weather searches during the active summer monsoon period.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "“三台共舞” 今年台风为何如此活跃": {
    titleEn: "Three typhoons at once — why this year's season is so active",
    whyTrending:
      "Meteorologists said Typhoons Saudel, Zitan and Jelawat were all active over the western Pacific and South China Sea, with 20 named storms so far under an El Niño backdrop. Direct GBA weather risk.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  日本地震: {
    titleEn: "Japan earthquake",
    whyTrending:
      "Hong Kong searches for a Japan earthquake jumped to 5K+ with 1,000% growth. Related queries included 北海道, 北海道地震 and 地震 as users checked a Hokkaido shock, injuries and travel disruption.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  尹景順: {
    titleEn: "Wan King-shun (Midlife Good Voice)",
    whyTrending:
      "Wan King-shun topped Hong Kong's 48-hour board at 20K+ with 600% growth as Midlife Good Voice 4 finals coverage circulated. Related queries included 中年好聲音4 and 李克勤. Celebrity entertainment; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  曼城: {
    titleEn: "Manchester City",
    whyTrending:
      "Manchester City searches jumped after a 4–1 Premier League win at Crystal Palace, with Erling Haaland scoring twice in the 03:00 HKT window. Related queries included 水晶宮對曼城, palace vs man city and 艾寧·夏蘭特.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  水晶宮對曼城: {
    titleEn: "Crystal Palace vs Manchester City",
    whyTrending:
      "Cantonese searches for Crystal Palace vs Manchester City jumped after City won 4–1 in Premier League matchweek 2, with Erling Haaland scoring twice. Related queries included 艾寧·夏蘭特. The English twin palace vs man city also ranked on the same 48-hour board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  吳文傑: {
    titleEn: "Ng Man-kit (Postmaster General designate)",
    whyTrending:
      "The HKSAR government announced on 28 August that former FEHD director Ng Man-kit will become Postmaster General on 26 September, succeeding Tai Suk-yiu. Related queries included 戴淑嬈, 退休 and 香港特別行政區政府.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  景甜: {
    titleEn: "Jing Tian (actress)",
    whyTrending:
      "Actress Jing Tian topped Hong Kong's 48-hour board at 20K+ after TRON founder Justin Sun's civil suit. Celebrity/tabloid spike; skipped in the displayed top-5.",
    isGossip: true,
    isNewsworthy: false,
    isGbaRelevant: true,
  },
  优惠券: {
    titleEn: "Coupons / promo codes",
    whyTrending:
      "Coupon searches hit 5K+ as Wellcome's 88-fold supermarket promo circulated. Related queries included 惠康88折.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "優惠 券": {
    titleEn: "Coupons / promo codes",
    whyTrending:
      "Hong Kong coupon searches hit 500+ with 400% growth on the 48-hour board. Related query 百佳 pointed shoppers to ParknShop deals rather than a separate entertainment spike.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  热带气旋警报: {
    titleEn: "Tropical cyclone warning",
    whyTrending:
      "Hong Kong Observatory tropical-cyclone warning searches rose as tropical depression Sardel tracked north of the territory. Users checked whether a higher signal would follow.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  熱帶氣旋警報: {
    titleEn: "Tropical cyclone warning",
    whyTrending:
      "Hong Kong Observatory tropical-cyclone warning searches hit 2K+ as tropical depression 沙德爾 (Sardel) tracked north of the territory and Signal No. 1 coverage circulated.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  张又侠: {
    titleEn: "Zhang Youxia (CMC vice chairman)",
    whyTrending:
      "Hong Kong searches for Zhang Youxia rose after the 14th NPC Standing Committee on 28 August voted to remove him as CMC vice chairman. Major PLA personnel story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  嫦娥七号任务不能在今年预定窗口实施: {
    titleEn: "Chang'e-7 cannot fly in this year's planned window",
    whyTrending:
      "CMSA said on 23 August that Chang'e-7 cannot fly in this year's planned window after a reliability review. Major national space story across Baidu, Weibo realtime and Weibo tech.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  嫦娥七号任务不满足发射条件: {
    titleEn: "Chang'e-7 mission does not meet launch conditions",
    whyTrending:
      "The official wording that Chang'e-7 does not meet launch conditions recirculated on Baidu and Weibo tech after the 23 August delay.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  DeepSeek计费再调整: {
    titleEn: "DeepSeek adjusts billing again",
    whyTrending:
      "Less than a week after an 17 August price hike and peak/off-peak split, DeepSeek said weekend hours from 23 August would all bill at the off-peak rate. National AI-cost story with GBA developer relevance.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  阿里巴巴拟配售800亿港元新股: {
    titleEn: "Alibaba plans an HK$80 billion share placement",
    whyTrending:
      "Alibaba's reported plan to place about HK$80 billion of new shares is a Hong Kong-market story. Direct GBA listing-and-capital spike on the Weibo tech board.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  买票占座规则明确了然后呢: {
    titleEn: "Seat-hogging rules are clear — what next?",
    whyTrending:
      "Weibo realtime topped out on the railway snack-on-a-paid-seat row after official rules said unused tickets cannot be occupied by a third party. Same national 民生 debate as People's Daily on Baidu.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  甲醛白菜让多重抽检成摆设: {
    titleEn: "Formaldehyde cabbage makes multi-layer inspections look decorative",
    whyTrending:
      "Weibo users argued that Hebei Kangbao cabbages dipped in formaldehyde exposed gaps in layered food-safety checks. Same national 民生 case as Baidu's three-ministry probe.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  梁王世锦赛夺冠: {
    titleEn: "Liang–Wang win the Worlds",
    whyTrending:
      "Liang Weikeng and Wang Chang's first Worlds men's-doubles title trended after the 23 August final. Guangzhou's Liang makes it a GBA sports story.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  梁王组合世锦赛夺冠: {
    titleEn: "Liang–Wang win Worlds men's doubles",
    whyTrending:
      "Guangzhou's Liang Weikeng and Wang Chang swept Malaysia 2–0 for their first Worlds men's-doubles title on 23 August — China's only gold of the championships.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  "427万辆召回 没有一款油车": {
    titleEn: "4.27 million vehicles recalled — none of them ICE",
    whyTrending:
      "SAMR listed 4.2751 million new-energy cars from Tesla, Xiaomi and seven other brands over hidden powered door-handle faults. A national auto-safety story with GBA EV manufacturing in the frame.",
    isGossip: false,
    isNewsworthy: true,
    isGbaRelevant: true,
  },
  李嘉诚: {
    titleEn: "Li Ka-shing",
    whyTrending:
      "Hong Kong searches for Li Ka-shing rose 500% in the 48-hour window as users looked up the Cheung Kong founder's latest business headlines.",
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
  let best = null;
  let bestLen = 0;
  for (const [key, val] of Object.entries(GLOSSARY)) {
    if (t.includes(key) && key.length > bestLen) {
      best = val;
      bestLen = key.length;
    }
  }
  return best;
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
  if (/[\u4e00-\u9fff]/.test(it.title) && it.titleEn === it.title) {
    delete it.titleEn;
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
