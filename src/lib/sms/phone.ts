// Normalize a stored phone/WhatsApp value to Termii's required international
// format for Nigeria: 234XXXXXXXXXX (13 digits, no plus). Returns null for
// anything that isn't a plausible Nigerian mobile number, so the send pipeline
// can skip it (and never debit for it) rather than send to a bad address.
//
// Accepts the messy real-world inputs members enter: 0803..., +234 803...,
// 234803..., 803..., with spaces, dashes or parentheses.
export function normalizeNgPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Keep digits only (drops +, spaces, dashes, parentheses).
  let d = raw.replace(/\D/g, "");

  // Reduce to the 10-digit national significant number.
  if (d.startsWith("234")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);

  // A Nigerian mobile NSN is 10 digits starting with 7, 8, or 9.
  if (!/^[789]\d{9}$/.test(d)) return null;
  return `234${d}`;
}
