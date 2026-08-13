// SMS segmentation — the single source of truth for both the composer's live
// counter and the wallet's billing. GSM-7 messages fit 160 chars on one page
// (153 per part once concatenated); a single non-GSM character forces the whole
// message to Unicode (UCS-2), dropping the limit to 70 (67 per part). See
// docs/sms-wallet-architecture.md §8a.

// The GSM 03.38 basic character set (each counts as 1). Characters outside this
// (plus the extension set below) force Unicode encoding.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Extension chars are GSM-encodable but take 2 septets each.
const GSM_EXTENSION = "^{}\\[~]|€";

const GSM_BASIC_SET = new Set(GSM_BASIC.split(""));
const GSM_EXT_SET = new Set(GSM_EXTENSION.split(""));

export type Encoding = "gsm7" | "unicode";

export type SegmentInfo = {
  encoding: Encoding;
  /** Effective character units (GSM extension chars count as 2). */
  units: number;
  /** Max units on a single page for this encoding. */
  perPage: number;
  pages: number;
  /** Units left before the next page starts. */
  unitsLeftOnPage: number;
};

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM_BASIC_SET.has(ch) && !GSM_EXT_SET.has(ch)) return false;
  }
  return true;
}

// GSM-7 septet count: basic chars = 1, extension chars = 2.
function gsm7Units(text: string): number {
  let n = 0;
  for (const ch of text) n += GSM_EXT_SET.has(ch) ? 2 : 1;
  return n;
}

export function segmentInfo(text: string): SegmentInfo {
  const gsm = isGsm7(text);
  const encoding: Encoding = gsm ? "gsm7" : "unicode";
  // Unicode counts by UTF-16 code units (what UCS-2 SMS billing uses); a
  // surrogate pair (e.g. an emoji) is 2 units.
  const units = gsm ? gsm7Units(text) : text.length;

  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;

  let pages: number;
  let perPage: number;
  if (units === 0) {
    pages = 0;
    perPage = single;
  } else if (units <= single) {
    pages = 1;
    perPage = single;
  } else {
    pages = Math.ceil(units / multi);
    perPage = multi;
  }

  const unitsLeftOnPage = perPage === 0 ? 0 : (pages <= 1 ? single - units : pages * perPage - units);
  return { encoding, units, perPage, pages, unitsLeftOnPage: Math.max(0, unitsLeftOnPage) };
}

// Convenience: how many billable pages a message is (0 for empty).
export function pageCount(text: string): number {
  return segmentInfo(text).pages;
}
