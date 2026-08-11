// Dependency-free Excel export. Produces a SpreadsheetML 2003 (.xls) file —
// a single XML document Excel and Google Sheets open natively — so we get a
// real spreadsheet download without pulling in a heavyweight library like
// SheetJS. Everything is written as a String cell (member data is text-ish
// and we never want Excel silently reinterpreting, e.g., a phone number or a
// leading-zero account as a number).

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

function row(cells: (string | number | null | undefined)[]): string {
  return `<Row>${cells.map(cell).join("")}</Row>`;
}

// Builds the workbook XML for one sheet from a header row + data rows.
export function buildXls(sheetName: string, headers: string[], rows: (string | number | null | undefined)[][]): string {
  // Excel caps sheet names at 31 chars and forbids : \ / ? * [ ].
  const safeSheet = sheetName.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Sheet1";
  const body = [row(headers), ...rows.map(row)].join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(safeSheet)}">
  <Table>${body}</Table>
 </Worksheet>
</Workbook>`;
}

// Triggers a browser download of the given rows as an .xls file. Client-only.
export function downloadXls(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const xml = buildXls(sheetName, headers, rows);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
