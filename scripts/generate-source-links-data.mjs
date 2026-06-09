#!/usr/bin/env node
/**
 * Parse references/daily-brief-source-domains.md → source-links-data.json
 * Usage: node scripts/generate-source-links-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  HAPPENINGS_FETCH_BY_DOMAIN,
  happeningsFetchMeta,
  happeningsListingUrl,
  macaotourismWhatsonUrl,
} from "./happenings-fetch-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "references/daily-brief-source-domains.md");
const outPath = path.join(root, "source-links-data.json");

const CATEGORY_MAP = {
  Official: "Official",
  News: "News",
  Lifestyle: "Lifestyle",
};

const SKIP_SECTIONS = new Set(["Social", "Event"]);

const EXCLUDED_DOMAINS = new Set([
  // Prior removals
  "kwh.org.mo",
  "en.wikipedia.org",
  "swirepacific.com",
  "mobile.shenzhenmuseum.com",
  "nflive.southcn.com",
  "macaonews.org",
  "www3.nhk.or.jp",
  "japantimes.co.jp",
  "kucoin.com",
  "i-cable.com",
  "ferrari.com",
  "fastcompany.com",
  "news.dayoo.com",
  "web-assets.bcg.com",
  // Batch removals (May 2026)
  "m.21jingji.com",
  "aastocks.com",
  "aljazeera.com",
  "api.app.anhuinews.com",
  "aa.com.tr",
  "apnews.com",
  "baike.baidu.com",
  "bangkokpost.com",
  "bcg.com",
  "caranddriver.com",
  "enhanced.com",
  "esportsworldcup.com",
  "helis.org",
  "cccw.hku.hk",
  "itftennis.com",
  "iautodaily.com",
  "kwongwah.com.my",
  "linkreit.com",
  "liquipedia.net",
  "nypost.com",
  "pbs.org",
  "sahracing.com",
  "sfsymphony.org",
  "gbcode.rthk.hk",
  "m.sohu.com",
  "tencent.com",
  "nytimes.com",
  "m.thepaper.cn",
  "unesco.org",
  "wired.com",
  "wizardofmacau.com",
  "163.com",
  "static.nfnews.com",
  // Non-news / corporate / platform (News category cleanup)
  "newsroom.wynnresorts.com",
  "google.com",
  "indexbox.io",
  "gdghospital.org.cn",
  "marketscreener.com",
  "en.wedoany.com",
  "df962388.com",
  "detail.damai.cn",
  "ppatour-asia.com",
  "szife.com.cn",
  "macaucee.com.mo",
  "prnewswire.com",
  "cdpf.org.cn",
  "appimg.modaily.cn",
  "mobile.epaper.routeryun.com",
  "content.foshanplus.com",
  // Removed from Lifestyle (news-heavy / not event calendars)
  "timeout.com",
  "lifestyleasia.com",
  "macauonjourney.com",
]);

function shouldSkipDomain(domain) {
  return domain.endsWith(".edu.hk") || EXCLUDED_DOMAINS.has(domain);
}

const DISPLAY_NAMES = {
  // Official
  "gov.mo": "Macao SAR Government",
  "info.gov.hk": "Hong Kong Government",
  "news.gov.hk": "Hong Kong Government News",
  "gz.gov.cn": "Guangzhou Government",
  "hengqin.gov.cn": "Hengqin Authority",
  "smg.gov.mo": "Macao SAR Government (SMG)",
  "sz.gov.cn": "Shenzhen Government",
  "fso.gov.hk": "Financial Services Office (HK)",
  "bo.dsaj.gov.mo": "Macao Legal Affairs Bureau",
  "eng.gdd.gov.cn": "Guangdong Government (English)",
  "english.gov.cn": "State Council (English)",
  "fao.sz.gov.cn": "Shenzhen Foreign Affairs Office",
  "gdii.gd.gov.cn": "Guangdong Industry & IT Dept",
  "heritagemuseum.gov.hk": "Hong Kong Heritage Museum",
  "hkelectric.com": "HK Electric",
  "hko.gov.hk": "Hong Kong Observatory",
  "legco.gov.hk": "Legislative Council (HK)",
  "locpg.gov.cn": "Liaison Office of Central Govt (HK)",
  "macaotourism.gov.mo": "Macao Government Tourism Office",
  "mlm.com.mo": "Macao Lottery",
  "qh.sz.gov.cn": "Qianhai Authority",
  "sasac.gov.cn": "State-owned Assets Commission",
  "szft.gov.cn": "Shenzhen Futian District Govt",
  "who.int": "World Health Organization",
  // News — GBA & local
  "tdm.com.mo": "TDM (Macao)",
  "news.tvb.com": "TVB News",
  "sztqb.sznews.com": "Shenzhen Special Zone Daily",
  "scmp.com": "South China Morning Post",
  "thestandard.com.hk": "The Standard",
  "szdaily.sznews.com": "Shenzhen Daily",
  "info.newsgd.com": "Southern Net (NewsGD)",
  "gzdaily.dayoo.com": "Guangzhou Daily",
  "news.southcn.com": "Southern Net",
  "modaily.cn": "Macao Daily",
  "newsgd.com": "NewsGD",
  "wb.sznews.com": "Shenzhen Evening News",
  "21jingji.com": "21st Century Business Herald",
  "english.news.cn": "Xinhua English",
  "news.rthk.hk": "RTHK News",
  "reuters.com": "Reuters",
  "sznews.com": "Shenzhen News",
  "globaltimes.cn": "Global Times",
  "sohu.com": "Sohu",
  "bbc.com": "BBC News",
  "chinadailyasia.com": "China Daily Asia",
  "hk01.com": "HK01",
  "hongkongfp.com": "Hong Kong Free Press",
  "m.sohu.com": "Sohu (Mobile)",
  "macaubusiness.com": "Macao Business",
  "pub-zhtb.hizh.cn": "Zhuhai Daily",
  "abcnews.com": "ABC News",
  "detail.damai.cn": "Damai (Events)",
  "epaper.nfnews.com": "Nanfang Plus (E-paper)",
  "gbcode.rthk.hk": "RTHK (GB Code)",
  "m.thepaper.cn": "The Paper (Mobile)",
  "macaupostdaily.com": "Macao Post Daily",
  "stcn.com": "Securities Times",
  "stheadline.com": "Sing Tao Headline",
  "apnews.com": "Associated Press",
  "appimg.modaily.cn": "Macao Daily (App)",
  "bangkokpost.com": "Bangkok Post",
  "bloomberg.com": "Bloomberg",
  "chinadaily.com.cn": "China Daily",
  "chinanews.com.cn": "China News Service",
  "cn.chinadaily.com.cn": "China Daily (CN)",
  "dimsumdaily.hk": "Dimsum Daily",
  "finance.sina.cn": "Sina Finance",
  "gdtv.cn": "Guangdong TV",
  "independent.co.uk": "The Independent",
  "macaobusinessnews.com": "Macao Business News",
  "macaodaily.com": "Macao Daily (macaodaily.com)",
  "macaucee.com.mo": "Macau CEE",
  "news.cgtn.com": "CGTN",
  "news.cn": "Xinhua News",
  "nytimes.com": "The New York Times",
  "straitstimes.com": "The Straits Times",
  "taichungdaily.com": "Taichung Daily",
  "wired.com": "Wired",
  "163.com": "NetEase",
  "aa.com.tr": "Anadolu Agency",
  "aastocks.com": "AAStocks",
  "aerotime.aero": "AeroTime",
  "aljazeera.com": "Al Jazeera",
  "api.app.anhuinews.com": "Anhui News",
  "baike.baidu.com": "Baidu Baike",
  "bcg.com": "Boston Consulting Group",
  "caranddriver.com": "Car and Driver",
  "cbsnews.com": "CBS News",
  "cccw.hku.hk": "HKU CCCW",
  "cdpf.org.cn": "China Disabled Persons' Federation",
  "channelnewsasia.com": "Channel NewsAsia",
  "chinadailyhk.com": "China Daily Hong Kong",
  "cnbc.com": "CNBC",
  "cnevpost.com": "CnEVPost",
  "content.foshanplus.com": "Foshan Plus",
  "cryptobriefing.com": "Crypto Briefing",
  "df962388.com": "DF962388",
  "edition.cnn.com": "CNN",
  "en.wedoany.com": "WeDoAny",
  "enhanced.com": "Enhanced",
  "epaper.tkww.hk": "Ta Kung Wen Wei (E-paper)",
  "esportsworldcup.com": "Esports World Cup",
  "exmoo.com": "Exmoo",
  "finance.yahoo.com": "Yahoo Finance",
  "focustaiwan.tw": "Focus Taiwan",
  "foshannews.net": "Foshan News",
  "fzs.newoe.cn": "Foshan News (Newoe)",
  "gba.net.cn": "GBA Net",
  "gd.chinadaily.com.cn": "China Daily (Guangdong)",
  "gdghospital.org.cn": "Guangdong Provincial Hospital",
  "ggrasia.com": "GGRAsia",
  "google.com": "Google News",
  "helis.org": "Helis",
  "hk.finance.yahoo.com": "Yahoo Finance HK",
  "hk.on.cc": "on.cc",
  "hm.people.com.cn": "People's Daily (Hainan)",
  "huacheng.gz-cmc.com": "Guangzhou Daily (Huacheng)",
  "iautodaily.com": "iAuto Daily",
  "indexbox.io": "IndexBox",
  "itftennis.com": "ITF Tennis",
  "jinguxun.com": "Jingu Xun",
  "jjckb.xinhuanet.com": "Economic Information Daily",
  "k.sina.com.cn": "Sina",
  "macaudailytimes.com.mo": "Macao Daily Times",
  "liquipedia.net": "Liquipedia",
  "m.21jingji.com": "21st Century Business Herald (Mobile)",
  "m.bendibao.com": "Bendibao (Mobile)",
  "marketscreener.com": "MarketScreener",
  "mobile.epaper.routeryun.com": "Routeryun E-paper",
  "news.cctv.com": "CCTV News",
  "news.gscn.com.cn": "GSCN News",
  "news.qq.com": "Tencent News",
  "news.un.org": "UN News",
  "newsroom.wynnresorts.com": "Wynn Resorts Newsroom",
  "nypost.com": "New York Post",
  "pbs.org": "PBS",
  "ppatour-asia.com": "PPA Tour Asia",
  "prnewswire.com": "PR Newswire",
  "sahracing.com": "SA Racing",
  "sfsymphony.org": "San Francisco Symphony",
  "sina.cn": "Sina",
  "sports.yahoo.com": "Yahoo Sports",
  "sz.people.com.cn": "People's Daily (Shenzhen)",
  "szife.com.cn": "Shenzhen International Fashion Expo",
  "sztv.com.cn": "Shenzhen TV",
  "telegraph.co.uk": "The Telegraph",
  "tencent.com": "Tencent",
  "thepaper.cn": "The Paper",
  "unesco.org": "UNESCO",
  "vakiodaily.com": "Va Kio Daily",
  "waou.com.mo": "Wa Ou Daily",
  "webzdg.sun0769.com": "Dongguan Daily",
  "wizardofmacau.com": "Wizard of Macao",
  "wsj.com": "The Wall Street Journal",
  "xinhuanet.com": "Xinhuanet",
  "xxsb.gz-cmc.com": "Information Times (Guangzhou)",
  "yicaiglobal.com": "Yicai Global",
  "zaobao.com": "Lianhe Zaobao",
  // Lifestyle
  "shenzhenmuseum.com": "Shenzhen Museum",
  "lifestyleasia.com": "Lifestyle Asia",
  "timeout.com": "Time Out",
  "macauonjourney.com": "Macao on Journey",
  "westk.hk": "WestK Hong Kong",
  "event.hktdc.com": "HKTDC Event Calendar",
  "10times.com": "10times (Trade Shows)",
  "eyeshenzhen.com": "Amazing Shenzhen (Events)",
  "ticketflap.com": "Ticketflap",
};

const URL_OVERRIDES = {
  "gov.mo": "https://www.gov.mo/zh-hant/news/",
  "info.gov.hk": "https://www.info.gov.hk/gia/general/ctoday.htm",
  "news.gov.hk": "https://www.news.gov.hk/eng/",
  "news.tvb.com": "https://news.tvb.com/tc/local",
  "news.rthk.hk": "https://news.rthk.hk/rthk/en/latest-news.htm",
  "tdm.com.mo": "https://www.tdm.com.mo/zh-hant/",
  "scmp.com": "https://www.scmp.com/topics/greater-bay-area",
  "info.newsgd.com": "https://info.newsgd.com/",
  "news.southcn.com": "https://news.southcn.com/",
  "hengqin.gov.cn": "https://www.hengqin.gov.cn/",
  "sznews.com": "https://www.sznews.com/",
  "gzdaily.dayoo.com": "https://gzdaily.dayoo.com/",
  "macaubusiness.com": "https://macaubusiness.com/",
  "english.news.cn": "https://english.news.cn/",
  "news.cgtn.com": "https://www.cgtn.com/",
  "hongkongfp.com": "https://hongkongfp.com/",
  "thestandard.com.hk": "https://www.thestandard.com.hk/",
  "modaily.cn": "https://www.modaily.cn/",
  "reuters.com": "https://www.reuters.com/world/",
  "bbc.com": "https://www.bbc.com/news",
  "bloomberg.com": "https://www.bloomberg.com/asia",
  "westk.hk": "https://www.westk.hk/en/home",
  "event.hktdc.com":
    HAPPENINGS_FETCH_BY_DOMAIN["event.hktdc.com"].listingUrl,
  "10times.com": "https://10times.com/shenzhen-cn/tradeshows",
  "eyeshenzhen.com": "https://www.eyeshenzhen.com/node_400950.htm",
  "shenzhenmuseum.com":
    HAPPENINGS_FETCH_BY_DOMAIN["shenzhenmuseum.com"].listingUrl,
  "macaotourism.gov.mo": macaotourismWhatsonUrl(),
  "ticketflap.com": HAPPENINGS_FETCH_BY_DOMAIN["ticketflap.com"].listingUrl,
};

function displayName(domain) {
  if (DISPLAY_NAMES[domain]) return DISPLAY_NAMES[domain];
  const base = domain.replace(/^www\./, "");
  const label = base
    .replace(/\.(com|cn|mo|hk|net|org|io|aero|tw|my)(\.[a-z]{2})?$/i, "")
    .split(".")
    .pop()
    .replace(/-/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function homepageUrl(domain) {
  if (URL_OVERRIDES[domain]) return URL_OVERRIDES[domain];
  const d = domain.replace(/^www\./, "");
  if (/^(m|en|cn|eng|mobile|epaper|appimg|api|finance|hk|gd|sz|web|webzdg|pub|static|detail|content|gbcode|research|newsroom|edition|cn\.|english\.)/.test(d)) {
    return `https://${d}/`;
  }
  if (/\.gov\.(hk|mo|cn)$/.test(d) || d.includes(".gov.")) {
    return `https://www.${d}/`;
  }
  return `https://www.${d}/`;
}

function parseDomains(md) {
  const rows = [];
  let category = null;

  for (const line of md.split(/\r?\n/)) {
    const head = line.match(/^## (Official|News|Lifestyle|Social|Event)/);
    if (head) {
      category = SKIP_SECTIONS.has(head[1]) ? null : head[1];
      continue;
    }
    const item = line.match(/^- `([^`]+)`/);
    if (item && category) {
      const domain = item[1];
      if (shouldSkipDomain(domain)) continue;
      const categoryName = CATEGORY_MAP[category] || category;
      const url = homepageUrl(domain);
      const row = {
        domain,
        displayName: displayName(domain),
        url: happeningsListingUrl(domain, url),
        category: categoryName,
      };
      if (categoryName === "Lifestyle") {
        const meta = happeningsFetchMeta(domain);
        if (meta) row.happeningsFetch = meta;
      }
      rows.push(row);
    }
  }

  return rows.sort((a, b) => {
    const c = a.category.localeCompare(b.category);
    if (c !== 0) return c;
    return a.displayName.localeCompare(b.displayName);
  });
}

const md = fs.readFileSync(mdPath, "utf8");
const sources = parseDomains(md);
const payload = {
  generatedFrom: "references/daily-brief-source-domains.md",
  count: sources.length,
  sources,
};

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${outPath} (${sources.length} sources)`);
