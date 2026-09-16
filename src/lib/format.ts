// Largest-first, so the first unit the elapsed time reaches is the one used.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/**
 * A human timestamp for the item drawer: "4 days ago", "yesterday", "just now".
 *
 * Uses `Intl.RelativeTimeFormat` rather than a date library — this is the only
 * relative timestamp in the app, and the platform already formats it.
 *
 * Note this is rendered in a client component, so it reads the *viewer's* clock.
 *
 * @param value An ISO date string, or a `Date`.
 * @param now Reference point, injectable so tests don't depend on the clock.
 */
export function relativeTime(value: string | Date, now: Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";

  const elapsed = date.getTime() - now.getTime();
  const magnitude = Math.abs(elapsed);

  for (const [unit, ms] of UNITS) {
    if (magnitude >= ms) {
      // Truncate rather than round, so 6 days never reads as "last week".
      return relativeTimeFormat.format(Math.trunc(elapsed / ms), unit);
    }
  }

  return "just now";
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB"];

/** A byte count as a short human string, e.g. `1.4 MB`. */
export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";

  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  // Whole bytes never need a decimal; larger units read better with one.
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10;
  return `${rounded} ${FILE_SIZE_UNITS[unit]}`;
}
