/**
 * Hotel Press source config — listing URLs and scrape metadata.
 * Domains must also appear under ## Hotels in
 * references/daily-brief-source-domains.md.
 */

export const HOTEL_PRESS_WINDOW_DAYS = 14;

export const HOTEL_PRESS_SOURCES = {
  "newsroom.wynnresorts.com": {
    displayName: "Wynn Palace Newsroom",
    hotelGroup: "Wynn",
    listingUrl:
      "https://www.newsroom.wynnresorts.com/en/wynnpalace/newslisting?wynnpalace=wp-pressreleases",
    method: "wynn-newsroom",
    defaultRegion: "Macao",
  },
  "en.sandsresortsmacao.com": {
    displayName: "Sands China Press",
    hotelGroup: "Sands China",
    listingUrl:
      "https://en.sandsresortsmacao.com/sands-lifestyle/press-release.html",
    method: "sands-press",
    defaultRegion: "Macao",
  },
};

export function hotelPressFetchMeta(domain) {
  const cfg = HOTEL_PRESS_SOURCES[domain];
  if (!cfg) return null;
  return {
    method: cfg.method,
    listingUrl: cfg.listingUrl,
    hotelGroup: cfg.hotelGroup,
  };
}

export function hotelPressListingUrl(domain, fallback) {
  return HOTEL_PRESS_SOURCES[domain]?.listingUrl || fallback;
}
