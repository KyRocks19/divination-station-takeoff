/**
 * Parse a timestamp as UTC. Accepts a Date (from PostgreSQL) or a string
 * (from SQLite, which omits a timezone marker and must be coerced to UTC).
 */
export function parseDate(s: string | Date): Date {
  if (s instanceof Date) return s;
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

/** Return an ISO 8601 string suitable for the HTML <time dateTime> attribute. */
export function toISOString(s: string | Date): string {
  return parseDate(s).toISOString();
}
