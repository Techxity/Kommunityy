// Pure date-period helpers shared by the dues server functions and the
// member-facing dues/checkout pages. All month math is done on plain
// {year, month} pairs (month is 1-12) so there's no timezone drift — the
// same reasoning as src/lib/date-only.ts.

export type Ym = { y: number; m: number };

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// How many calendar months one billing period covers, by plan interval.
export function monthsPerPeriod(interval: string | null | undefined): number {
  switch (interval) {
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
    default:
      return 1; // monthly
  }
}

// "quarter" / "year" / "month" — the unit label for a plan interval.
export function periodUnit(interval: string | null | undefined): string {
  switch (interval) {
    case "quarterly":
      return "quarter";
    case "yearly":
      return "year";
    default:
      return "month";
  }
}

export function parseYm(dateStr: string): Ym {
  const [y, m] = dateStr.split("-").map(Number);
  return { y: y || 1970, m: m || 1 };
}

export function ymToDateStr(ym: Ym): string {
  return `${ym.y}-${String(ym.m).padStart(2, "0")}-01`;
}

export function addMonths(ym: Ym, n: number): Ym {
  const total = ym.y * 12 + (ym.m - 1) + n;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

export function formatYm(ym: Ym): string {
  return `${MONTH_NAMES[ym.m - 1]} ${ym.y}`;
}

export function currentYm(): Ym {
  const now = new Date();
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
}

// A > B ?
export function ymAfter(a: Ym, b: Ym): boolean {
  return a.y * 12 + a.m > b.y * 12 + b.m;
}
