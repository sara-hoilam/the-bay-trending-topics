/**
 * New Hotels source config — listing URLs and scrape metadata.
 * Domains must also appear under ## New Hotels in
 * references/daily-brief-source-domains.md.
 */

export const OPENING_LIST_SUPABASE = {
  url: "https://eidxksqxusflpnmfdhsb.supabase.co",
  /** Public anon key embedded in theopeninglist.com client bundle. */
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZHhrc3F4dXNmbHBubWZkaHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NjExMzMsImV4cCI6MjA3MTQzNzEzM30.Uti3Y0vKso3-1iJ-xgt_V8izv4hNrxeMco6ksAkGE7M",
};

export const NEW_HOTELS_SOURCES = {
  "theopeninglist.com": {
    displayName: "The Opening List",
    hotelGroup: "The Opening List",
    listingUrl: "https://theopeninglist.com/collection/true",
    method: "opening-list-api",
  },
  "marriott.com": {
    displayName: "Marriott Bonvoy Openings",
    hotelGroup: "Marriott",
    listingUrl:
      "https://www.marriott.com/en-us/marriott-brands/portfolio/openings.mi",
    method: "marriott-next-data",
  },
  "group.accor.com": {
    displayName: "Accor 2026 Openings",
    hotelGroup: "Accor",
    listingUrl: "https://group.accor.com/en/news-stories/accor-2026-openings",
    pressUrl:
      "https://press.accor.com/the-journey-continues-accors-most-anticipated-2026-openings?lang=eng",
    method: "accor-html",
  },
  "ihg.com": {
    displayName: "IHG New Hotels",
    hotelGroup: "IHG",
    listingUrl:
      "https://www.ihg.com/content/us/en/deals/hotel-offers/new-hotels",
    archiveUrl:
      "https://web.archive.org/web/2026/https://www.ihg.com/content/us/en/deals/hotel-offers/new-hotels",
    method: "ihg-html",
  },
};

/** ±6 months window around today (HKT). */
export const NEW_HOTELS_WINDOW_MONTHS = 6;
