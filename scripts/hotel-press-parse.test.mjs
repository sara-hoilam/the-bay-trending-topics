import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLooseDate,
  parseDateFromUrl,
  classifyHeadline,
  parseWynnNewsroomHtml,
  parseSandsPressHtml,
  selectHotelPressArticles,
  windowBounds,
} from "./hotel-press-parse.mjs";

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
