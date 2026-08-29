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
      "Searches for 泥石流 hit 10K+ after a Nepal-side debris flow struck Gyirong Port in Tibet, with related queries 西藏泥石流, 尼泊爾 and 吉隆口岸. Hong Kong users tracked casualty and rescue headlines alongside mainland boards.",
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
      "Coupon searches hit 5K+ (800% growth) as Wellcome's 88-fold supermarket promo circulated. Related queries included 惠康88折, 優惠券 and 惠 康 優惠.",
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
