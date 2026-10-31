// Shared onboarding field catalogue — the fixed list an admin can pick from
// when building their community's join form. Used by both the admin form
// builder and the public join page (client + server), so it lives here
// rather than inside any one store.
export const FIELD_LIBRARY = [
  "Name", "Phone number", "Email", "Address", "WhatsApp Number",
  "Date of Birth", "Gender", "Chapter", "Year of Graduation", "Year of joining group",
  "Matriculation number", "Who invited you?", "Occupation",
] as const;

export type FieldName = (typeof FIELD_LIBRARY)[number];

// Allowed values for members.gender (mirrors the column's CHECK constraint).
export const GENDER_OPTIONS = ["Male", "Female"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

// Lenient parse for spreadsheet imports ("m", "FEMALE", …). Anything
// unrecognised is dropped rather than guessed at.
export function parseGender(v?: string | null): Gender | undefined {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "m" || s === "male") return "Male";
  if (s === "f" || s === "female") return "Female";
  return undefined;
}

export const DEFAULT_FIELDS: FieldName[] = [
  "Name", "Email", "Phone number", "WhatsApp Number", "Chapter", "Date of Birth",
];
