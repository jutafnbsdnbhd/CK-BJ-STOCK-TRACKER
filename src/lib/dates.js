// Dates for POs and DOs. The kitchen runs on Malaysia time, whatever
// timezone the phone happens to be set to.

const TZ = "Asia/Kuala_Lumpur";

/** Today in Malaysia as "YYYY-MM-DD". */
export function klToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-10-08" + 1 → "2026-10-09" */
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** "2026-10-08" → "Thu, 8 Oct 2026" */
export function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Timestamp → "8 Oct 2026, 3:42 pm" in Malaysia time */
export function formatDateTime(ts) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}
