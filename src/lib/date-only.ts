// Shared helper for converting a Postgres `date` column value to a bare
// "YYYY-MM-DD" string for the client, without ever shifting the calendar day.
//
// Why this exists: the Neon driver's return type for a `date` column isn't
// consistent to depend on by inspection alone — depending on the query
// shape/driver version, `dob` can come back either as a raw text string
// ("2001-08-07") or as a genuine JS `Date` object representing UTC midnight
// of that day. Code across this app previously assumed it was always a
// string and did `String(v).slice(0, 10)` — that's a no-op for the string
// case, but for the Date-object case, `String(dateObj)` runs the JS engine's
// default `Date.prototype.toString()`, which produces something like
// "Thu Aug 07 2025 00:00:00 GMT+0000 (...)" — NOT "YYYY-MM-DD" — so slicing
// the first 10 characters silently produced garbage ("Thu Aug 07", no
// hyphens), which every `.split("-")`/regex-based date parser downstream
// then failed to parse, rendering as blank dates or a birthday that never
// matches the current month.
//
// The fix: branch on the actual runtime type, and for a Date object, read
// it back with *UTC* accessors specifically — a bare `date` column has no
// time-of-day, so the Date object the driver builds from it is always UTC
// midnight of the intended day. Reading it with local accessors (getDate(),
// getMonth()) reintroduces the exact timezone-shift bug this app has already
// hit once (see admin.birthdays.tsx's dobParts comment).
export function toDateOnlyString(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

// For `timestamptz` columns (applied_at, joined_at, sent_at, etc.) where the
// time-of-day actually matters — e.g. computing "20h ago" — never truncate
// to a bare date the way toDateOnlyString() does. Returns a full ISO instant
// string that `new Date(...)` (and thus any relative-time helper) can parse
// reliably, whether the driver handed back a Date object or raw text.
//
// Postgres's default raw-text output for timestamptz uses a space between
// the date and time ("2025-08-06 20:15:00.123+00") rather than the "T"
// separator ISO 8601 requires — `new Date(...)` parsing of that space form
// isn't spec-guaranteed, so it's normalized to "T" before parsing.
export function toTimestampIso(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "" : v.toISOString();
  }
  const s = String(v).replace(" ", "T");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
