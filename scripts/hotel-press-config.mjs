/**
 * Hotel Press source config — listing URLs and scrape metadata.
 * Each listing must also appear under ## Hotels in
 * references/daily-brief-source-domains.md (one row per listing URL).
 */

export const HOTEL_PRESS_WINDOW_DAYS = 14;

export const HOTEL_PRESS_LISTINGS = [
  {
    id: "galaxy-entertainment",
    domain: "galaxyentertainment.com",
    displayName: "Galaxy Entertainment",
    hotelGroup: "Galaxy Entertainment",
    listingUrl:
      "https://www.galaxyentertainment.com/en/media/press-releases?year=all",
    method: "galaxy-press",
    defaultRegion: "Macao",
  },
  {
    id: "melco-resorts",
    domain: "ir.melco-resorts.com",
    displayName: "Melco Resorts",
    hotelGroup: "Melco",
    listingUrl: "https://ir.melco-resorts.com/press-releases",
    fallbackUrls: ["https://ir.melco-resorts.com/news-releases"],
    method: "melco-press",
    defaultRegion: "Macao",
  },
  {
    id: "mgm-china",
    domain: "en.mgmchinaholdings.com",
    displayName: "MGM China",
    hotelGroup: "MGM China",
    listingUrl: "https://en.mgmchinaholdings.com/media-releases",
    method: "mgm-press",
    defaultRegion: "Macao",
  },
  {
    id: "sjm-holdings",
    domain: "sjmholdings.com",
    displayName: "SJM Holdings",
    hotelGroup: "SJM",
    listingUrl: "https://www.sjmholdings.com/en/media-center/press-release",
    method: "sjm-press",
    defaultRegion: "Macao",
  },
  {
    id: "wynn-palace",
    domain: "newsroom.wynnresorts.com",
    displayName: "Wynn Palace Newsroom",
    hotelGroup: "Wynn",
    listingUrl:
      "https://www.newsroom.wynnresorts.com/en/wynnpalace/newslisting?wynnpalace=wp-pressreleases",
    method: "wynn-newsroom",
    defaultRegion: "Macao",
  },
  {
    id: "wynn-macau",
    domain: "newsroom.wynnresorts.com",
    displayName: "Wynn Macau Newsroom",
    hotelGroup: "Wynn",
    listingUrl:
      "https://www.newsroom.wynnresorts.com/en/wynnmacau/newslisting?wynnmacau=wm-pressreleases",
    method: "wynn-newsroom",
    defaultRegion: "Macao",
  },
  {
    id: "mandarin-oriental",
    domain: "press.mandarinoriental.com",
    displayName: "Mandarin Oriental",
    hotelGroup: "Mandarin Oriental",
    listingUrl: "https://press.mandarinoriental.com/section/press-releases",
    fallbackUrls: [
      "https://press.mandarinoriental.com/section/press-releases?lang=eng",
    ],
    method: "mandarin-press",
    defaultRegion: "Hong Kong",
  },
  {
    id: "shangri-la",
    domain: "shangri-la.com",
    displayName: "Shangri-La Group",
    hotelGroup: "Shangri-La",
    listingUrl: "https://www.shangri-la.com/group/media/",
    method: "shangri-articles",
    defaultRegion: "Hong Kong",
  },
  {
    id: "four-seasons-hk",
    domain: "press.fourseasons.com",
    displayName: "Four Seasons Hong Kong",
    hotelGroup: "Four Seasons",
    listingUrl: "https://press.fourseasons.com/hongkong/hotel-news/",
    method: "fourseasons-press",
    defaultRegion: "Hong Kong",
  },
  {
    id: "sands-china",
    domain: "en.sandsresortsmacao.com",
    displayName: "Sands China Press",
    hotelGroup: "Sands China",
    listingUrl:
      "https://en.sandsresortsmacao.com/sands-lifestyle/press-release.html",
    method: "sands-press",
    defaultRegion: "Macao",
  },
];

/** First listing per domain (legacy lookups). */
export const HOTEL_PRESS_SOURCES = Object.fromEntries(
  [...HOTEL_PRESS_LISTINGS].reverse().map((l) => [l.domain, l]),
);

function normUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

export function matchHotelPressListing({ domain, url, displayName } = {}) {
  const u = normUrl(url);
  if (u) {
    const byUrl = HOTEL_PRESS_LISTINGS.find(
      (l) => normUrl(l.listingUrl) === u || (l.fallbackUrls || []).some((f) => normUrl(f) === u),
    );
    if (byUrl) return byUrl;
  }
  if (domain && displayName) {
    const byName = HOTEL_PRESS_LISTINGS.find(
      (l) => l.domain === domain && l.displayName === displayName,
    );
    if (byName) return byName;
  }
  if (!domain) return null;
  const byDomain = HOTEL_PRESS_LISTINGS.filter((l) => l.domain === domain);
  return byDomain.length === 1 ? byDomain[0] : null;
}

export function hotelPressFetchMeta(source) {
  const listing =
    typeof source === "string"
      ? matchHotelPressListing({ domain: source })
      : matchHotelPressListing(source);
  if (!listing) return null;
  return {
    method: listing.method,
    listingUrl: listing.listingUrl,
    hotelGroup: listing.hotelGroup,
    listingId: listing.id,
  };
}

export function hotelPressListingUrl(domain, fallback) {
  return matchHotelPressListing({ domain })?.listingUrl || fallback;
}
