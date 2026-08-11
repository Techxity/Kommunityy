// Dependency-free CSV export. Excel and Google Sheets both open CSV directly
// with no "different format" prompt. A UTF-8 BOM is prepended so Excel renders
// non-ASCII correctly (e.g. the ₦ sign, accented names) instead of mojibake.

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  // Always quote — safe for values containing commas, quotes, or newlines.
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// Triggers a browser download of the given rows as a .csv file. Client-only.
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const csv = "﻿" + buildCsv(headers, rows); // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
