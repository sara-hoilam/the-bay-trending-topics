/**
 * Happenings fetch metadata for Lifestyle domains.
 * Used by generate-source-links-data.mjs (embed in JSON) and generate-happenings-data.mjs.
 *
 * listingUrl — URL shown on Source Links tab and used as Referer for fetch
 * method     — html | hktdc-phr-api
 * parser     — html parser id (html method only)
 */
export const HAPPENINGS_FETCH_BY_DOMAIN = {
  "event.hktdc.com": {
    method: "hktdc-phr-api",
    listingUrl:
      "https://event.hktdc.com/?organizers=hktdc&eventFormat=Exhibition&location=hk",
    apiOrganizers: "hktdc, hktdc-participate",
    defaultRegion: { region: "hk", location: "Hong Kong" },
  },
  "eyeshenzhen.com": {
    method: "html",
    parser: "eyeshenzhen",
    defaultRegion: { region: "shenzhen", location: "Shenzhen" },
  },
  "10times.com": {
    method: "html",
    defaultRegion: { region: "shenzhen", location: "Shenzhen" },
  },
  "westk.hk": {
    method: "html",
    listingUrl: "https://www.westk.hk/en/whats-on",
    defaultRegion: { region: "hk", location: "Hong Kong" },
  },
  "shenzhenmuseum.com": {
    method: "html",
    listingUrl: "https://www.shenzhenmuseum.com/en/exhibition",
    defaultRegion: { region: "shenzhen", location: "Shenzhen" },
  },
};

export const HKTDC_PHR_EVENT_API = "https://api-phr.hktdc.com/phr-home/v1/event";

/** Query params on listingUrl drive client-side filters (eventFormat, location, organizers). */
export function hktdcFiltersFromListingUrl(listUrl) {
  const q = new URL(listUrl).searchParams;
  return {
    organizers: q.get("organizers") || "hktdc",
    eventFormat: q.get("eventFormat") || null,
    location: q.get("location") || null,
  };
}

export function happeningsFetchMeta(domain) {
  const cfg = HAPPENINGS_FETCH_BY_DOMAIN[domain];
  if (!cfg) return null;
  return {
    method: cfg.method,
    ...(cfg.parser ? { parser: cfg.parser } : {}),
  };
}

export function happeningsListingUrl(domain, fallbackUrl) {
  const cfg = HAPPENINGS_FETCH_BY_DOMAIN[domain];
  return cfg?.listingUrl ?? fallbackUrl;
}
