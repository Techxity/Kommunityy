import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsv } from "../src/lib/export-csv.ts";

test("quotes every cell and escapes embedded quotes", () => {
  const csv = buildCsv(["Name", "Note"], [["Ada", 'a "quoted" word']]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], '"Name","Note"');
  assert.equal(lines[1], '"Ada","a ""quoted"" word"');
});

test("commas and newlines inside a value stay contained", () => {
  const csv = buildCsv(["A"], [["one, two"]], );
  assert.equal(csv.split("\r\n")[1], '"one, two"');
  const csv2 = buildCsv(["A"], [["line1\nline2"]]);
  // The newline is inside the quoted field — the row itself isn't split by it.
  assert.ok(csv2.includes('"line1\nline2"'));
});

test("null / undefined / number cells", () => {
  const csv = buildCsv(["A", "B", "C"], [[null, undefined, 42]]);
  assert.equal(csv.split("\r\n")[1], '"","","42"');
});

test("uses CRLF row terminators (Excel-friendly)", () => {
  const csv = buildCsv(["A"], [["1"], ["2"]]);
  assert.equal(csv, '"A"\r\n"1"\r\n"2"');
});

test("header-only export", () => {
  assert.equal(buildCsv(["A", "B"], []), '"A","B"');
});
