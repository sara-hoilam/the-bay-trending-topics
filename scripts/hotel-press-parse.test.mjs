import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLooseDate,
  parseDateFromUrl,
  parseUsDateTime,
  classifyHeadline,
  parseWynnNewsroomHtml,
  parseSandsPressHtml,
  parseGalaxyPressHtml,
  parseMelcoPressHtml,
  parseMgmPressHtml,
  parseSjmPressHtml,
  parseMandarinPressHtml,
  parseFourSeasonsPressHtml,
  parseShangriArticlesJson,
  selectHotelPressArticles,
  windowBounds,
} from "./hotel-press-parse.mjs";
import { matchHotelPressListing, HOTEL_PRESS_LISTINGS } from "./hotel-press-config.mjs";

test("parseLooseDate handles Wynn news-log dates", () => {
  assert.equal(parseLooseDate("03 Sep 2026"), "2026-09-03");
  assert.equal(parseLooseDate("04 Sep 2026"), "2026-09-04");
});

test("parseLooseDate handles Sands title prefixes", () => {
  assert.equal(parseLooseDate("Sep.3 Sands China Receives Two MICE Honours", "2026"), "2026-09-03");
  assert.equal(parseLooseDate("Aug.23 Sands China Extends", "2026"), "2026-08-23");
  assert.equal(parseLooseDate("July.6 Sands China Named Grand Winner", "2026"), "2026-07-06");
});

test("parseDateFromUrl reads Sands and lifestyle paths", () => {
  assert.equal(
    parseDateFromUrl("https://en.sandsresortsmacao.com/sands-lifestyle/press-release/2026-09-03/Stella-Awards-2026.html"),
    "2026-09-03",
  );
  assert.equal(
    parseDateFromUrl("https://www.sandschina.com/the-company/company-information/press-release/2026/08-05-great-place-to-work.html"),
    "2026-08-05",
  );
});

test("classifyHeadline keeps awards and drops earnings", () => {
  assert.equal(
    classifyHeadline("Sands China Receives Two MICE Honours at M&C Asia Stella Awards 2026"),
    "award",
  );
  assert.equal(
    classifyHeadline("Wynn Palace Becomes the First in Macao to Debut on The World's 50 Best Hotels 2026 Extended 51-100 List"),
    "award",
  );
  assert.equal(
    classifyHeadline("Wynn Launches 20th Anniversary Share Award for Team Members"),
    "award",
  );
  assert.equal(
    classifyHeadline("Sands China Earns Great Place To Work Certification"),
    "award",
  );
  assert.equal(classifyHeadline("Wynn Resorts Announces Second Quarter Earnings"), null);
  assert.equal(
    classifyHeadline("Wynn Donates MOP5 Million to Support Relief and Recovery Efforts in Gyirong, Xizang"),
    "good-news",
  );
});

test("parseWynnNewsroomHtml extracts title, url, date", () => {
  const html = `
    <div class="listing-item news-list-item">
      <div class="news-desc">
        <p><a href="https://www.newsroom.wynnresorts.com/en/wynnpalace/wp-pressreleases/wynn-launches-20th-anniversary-share-award-for-team-members/s/abc">Wynn Launches 20th Anniversary Share Award for Team Members</a></p>
      </div>
      <div class="news-log">
03 Sep 2026
      </div>
    </div>`;
  const items = parseWynnNewsroomHtml(html, {
    domain: "newsroom.wynnresorts.com",
    displayName: "Wynn Palace Newsroom",
    hotelGroup: "Wynn",
  });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /Share Award/);
  assert.equal(items[0].posted, "2026-09-03");
  assert.match(items[0].url, /share-award/);
});

test("parseSandsPressHtml strips date prefix and uses URL year", () => {
  const html = `
    <li><a href="https://en.sandsresortsmacao.com/sands-lifestyle/press-release/2026-09-03/Stella-Awards-2026.html">Sep.3 Sands China Receives Two MICE Honours at M&amp;C Asia Stella Awards 2026</a></li>
    <li><a href="https://www.sandschina.com/the-company/company-information/press-release/2026/08-05-great-place-to-work.html">Aug.5 Sands China Earns Great Place To Work Certification&trade;</a></li>`;
  const items = parseSandsPressHtml(html, {
    domain: "en.sandsresortsmacao.com",
    displayName: "Sands China Press",
    hotelGroup: "Sands China",
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Sands China Receives Two MICE Honours at M&C Asia Stella Awards 2026");
  assert.equal(items[0].posted, "2026-09-03");
  assert.equal(items[1].posted, "2026-08-05");
  assert.match(items[1].title, /Great Place To Work/);
});

test("parseSandsPressHtml ignores non press-release links", () => {
  const html = `
    <li><a href="https://en.sandsresortsmacao.com/sands-lifestyle/index.html">Home</a></li>
    <li><a href="https://en.sandsresortsmacao.com/sands-lifestyle/press-release/2026-09-03/Stella-Awards-2026.html">Sep.3 Sands China Receives Two MICE Honours</a></li>`;
  const items = parseSandsPressHtml(html, {
    domain: "en.sandsresortsmacao.com",
    displayName: "Sands China Press",
    hotelGroup: "Sands China",
  });
  assert.equal(items.length, 1);
  assert.match(items[0].url, /Stella-Awards/);
});

test("selectHotelPressArticles keeps 14-day awards only", () => {
  const bounds = windowBounds("2026-09-09", 14);
  const selected = selectHotelPressArticles(
    [
      {
        title: "Sands China Receives Two MICE Honours at M&C Asia Stella Awards 2026",
        posted: "2026-09-03",
        sourceDomain: "en.sandsresortsmacao.com",
      },
      {
        title: "Sands China Earns Great Place To Work Certification",
        posted: "2026-08-05",
        sourceDomain: "en.sandsresortsmacao.com",
      },
      {
        title: "Wynn Resorts Announces Second Quarter Earnings",
        posted: "2026-09-01",
        sourceDomain: "newsroom.wynnresorts.com",
      },
    ],
    bounds,
  );
  assert.equal(selected.length, 1);
  assert.match(selected[0].title, /Stella Awards/);
  assert.equal(bounds.start, "2026-08-26");
});

test("parseDateFromUrl reads Galaxy compact YYYYMMDD", () => {
  assert.equal(
    parseDateFromUrl("https://www.galaxyentertainment.com/en/media/press-releases/1211/20260903"),
    "2026-09-03",
  );
});

test("parseUsDateTime handles Shangri-La CMS dates", () => {
  assert.equal(parseUsDateTime("8/27/2025 4:00:00 PM"), "2025-08-27");
  assert.equal(parseUsDateTime("3/7/2026 4:00:00 PM"), "2026-03-07");
});

test("parseGalaxyPressHtml extracts date and title", () => {
  const html = `
    <div class="press_list"><ul>
      <li>
        <a href="/en/media/press-releases/1211/20260903">
          <span class="date">Sep 03, 2026</span>
          <span class="title"><!-- --> GEG and Lui Che Woo Family Charitable Foundation Donate MOP10 Million</span>
        </a>
      </li>
    </ul></div>`;
  const items = parseGalaxyPressHtml(html, {
    domain: "galaxyentertainment.com",
    displayName: "Galaxy Entertainment",
    hotelGroup: "Galaxy Entertainment",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-09-03");
  assert.match(items[0].title, /Donate MOP10 Million/);
  assert.match(items[0].url, /press-releases\/1211\/20260903/);
});

test("parseMelcoPressHtml extracts NewsDate and headline", () => {
  const html = `
    <span class="NewsDate">Aug 13, 2026</span>
    <div class="nir-widget--field nir-widget--news--headline NewsTitle">
      <a href="/news-releases/news-release-details/melco-recognized-best-companies-work-asia-hr-asia">Melco recognized as “Best Companies to Work for in Asia” by HR Asia</a>
    </div>`;
  const items = parseMelcoPressHtml(html, {
    domain: "ir.melco-resorts.com",
    displayName: "Melco Resorts",
    hotelGroup: "Melco",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-08-13");
  assert.match(items[0].title, /Best Companies to Work/);
});

test("parseMgmPressHtml extracts wd_item date and title", () => {
  const html = `
    <li class="wd_item">
      <div class="wd_date">Sep 08, 2026</div>
      <div class="wd_title"><a href="https://en.mgmchinaholdings.com/media-releases?item=854">Three MGM Restaurants Recognized in Trip.Gourmet’s 2027 Global Fine Dining Selection</a></div>
    </li>`;
  const items = parseMgmPressHtml(html, {
    domain: "en.mgmchinaholdings.com",
    displayName: "MGM China",
    hotelGroup: "MGM China",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-09-08");
  assert.match(items[0].title, /Trip\.Gourmet/);
});

test("parseSjmPressHtml absolutizes PDF links", () => {
  const html = `
    <tr class="sectiontableentry">
      <td class="field_displayDate">04 Sep 2026</td>
      <td><a href="resources/images/uploads/demo.pdf" itemprop="url">SJM Donates to Support Relief Efforts</a></td>
    </tr>`;
  const items = parseSjmPressHtml(html, {
    domain: "sjmholdings.com",
    displayName: "SJM Holdings",
    hotelGroup: "SJM",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-09-04");
  assert.equal(
    items[0].url,
    "https://www.sjmholdings.com/resources/images/uploads/demo.pdf",
  );
});

test("parseMandarinPressHtml reads swiper slide", () => {
  const html = `
    <div class="swiper-slide">
      <div class="date">22 Jun 2026</div>
      <h3>Mandarin Oriental Introduces Its New Resort – Mandarin Oriental Punta Negra, Mallorca</h3>
      <a href="https://press.mandarinoriental.com/mallorca-opening/" class="cta">See more</a>
    </div>`;
  const items = parseMandarinPressHtml(html, {
    domain: "press.mandarinoriental.com",
    displayName: "Mandarin Oriental",
    hotelGroup: "Mandarin Oriental",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-06-22");
  assert.match(items[0].url, /mallorca-opening/);
});

test("parseFourSeasonsPressHtml reads article-blurb date line", () => {
  const html = `
    <a class="article-blurb portrait" href="/hongkong/hotel-news/2026/worlds-50-best">
      <div class="detail">September 1, 2026, Hong Kong, China</div>
      <div class="title">Four Seasons Hotel Hong Kong Recognized in the World’s 50 Best Hotels 2026 Extended List</div>
    </a>`;
  const items = parseFourSeasonsPressHtml(html, {
    domain: "press.fourseasons.com",
    displayName: "Four Seasons Hong Kong",
    hotelGroup: "Four Seasons",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-09-01");
  assert.match(items[0].title, /50 Best Hotels/);
});

test("parseShangriArticlesJson maps CMS items to listing URLs", () => {
  const payload = {
    data: {
      search: {
        results: {
          items: [
            {
              name: "IWD 2026",
              title: "International Women’s Day 2026: Giving with Purpose to Empower Women",
              date: "3/7/2026 4:00:00 PM",
            },
          ],
        },
      },
    },
  };
  const items = parseShangriArticlesJson(payload, {
    domain: "shangri-la.com",
    displayName: "Shangri-La Group",
    hotelGroup: "Shangri-La",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].posted, "2026-03-07");
  assert.match(items[0].url, /media_post\?post=IWD%202026/);
});

test("selectHotelPressArticles dedupes Wynn Palace and Macau GUIDs", () => {
  const bounds = windowBounds("2026-09-09", 14);
  const selected = selectHotelPressArticles(
    [
      {
        title: "Wynn Launches 20th Anniversary Share Award for Team Members",
        posted: "2026-09-03",
        url: "https://www.newsroom.wynnresorts.com/en/wynnpalace/wp-pressreleases/share/s/abc-guid",
        sourceDomain: "newsroom.wynnresorts.com",
      },
      {
        title: "Wynn Launches 20th Anniversary Share Award for Team Members",
        posted: "2026-09-03",
        url: "https://www.newsroom.wynnresorts.com/en/wynnmacau/wm-pressreleases/share/s/abc-guid",
        sourceDomain: "newsroom.wynnresorts.com",
      },
    ],
    bounds,
  );
  assert.equal(selected.length, 1);
});

test("matchHotelPressListing distinguishes Wynn Palace and Macau URLs", () => {
  assert.equal(HOTEL_PRESS_LISTINGS.length, 10);
  const palace = matchHotelPressListing({
    domain: "newsroom.wynnresorts.com",
    url: "https://www.newsroom.wynnresorts.com/en/wynnpalace/newslisting?wynnpalace=wp-pressreleases",
    displayName: "Wynn Palace Newsroom",
  });
  const macau = matchHotelPressListing({
    domain: "newsroom.wynnresorts.com",
    url: "https://www.newsroom.wynnresorts.com/en/wynnmacau/newslisting?wynnmacau=wm-pressreleases",
    displayName: "Wynn Macau Newsroom",
  });
  assert.equal(palace.id, "wynn-palace");
  assert.equal(macau.id, "wynn-macau");
});
