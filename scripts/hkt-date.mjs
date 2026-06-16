/** Asia/Hong_Kong calendar helpers for daily pipeline scripts. */
export function hktDateStr(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hktIsoDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

export function ageHours(iso) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

/** Add calendar days to an HKT YYYY-MM-DD string. */
export function hktAddDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return hktDateStr(utc);
}

/** HKT calendar date (YYYY-MM-DD) for a Unix timestamp in seconds. */
export function hktDateFromUnix(unixSeconds) {
  return hktDateStr(new Date(unixSeconds * 1000));
}
