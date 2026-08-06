// Shared onboarding field catalogue — the fixed list an admin can pick from
// when building their community's join form. Used by both the admin form
// builder and the public join page (client + server), so it lives here
// rather than inside any one store.
export const FIELD_LIBRARY = [
  "Name", "Phone number", "Email", "Address", "WhatsApp Number",
  "Date of Birth", "Chapter", "Year of Graduation", "Year of joining group",
  "Matriculation number", "Who invited you?", "Occupation",
] as const;

export type FieldName = (typeof FIELD_LIBRARY)[number];

export const DEFAULT_FIELDS: FieldName[] = [
  "Name", "Email", "Phone number", "WhatsApp Number", "Chapter", "Date of Birth",
];
