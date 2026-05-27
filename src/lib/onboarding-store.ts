// Shared onboarding form configuration — drives both the admin editor and the public join page.
import { useSyncExternalStore } from "react";

export const FIELD_LIBRARY = [
  "Name", "Phone number", "Email", "Address", "WhatsApp Number",
  "Date of Birth", "Chapter", "Year of Graduation", "Year of joining group",
  "Matriculation number", "Who invited you?", "Occupation",
] as const;

export type FieldName = (typeof FIELD_LIBRARY)[number];

let activeFields: FieldName[] = [
  "Name", "Email", "Phone number", "WhatsApp Number", "Chapter", "Date of Birth",
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const onboardingStore = {
  getAll: () => activeFields,
  set: (fields: FieldName[]) => {
    activeFields = fields;
    emit();
  },
  toggle: (f: FieldName) => {
    activeFields = activeFields.includes(f)
      ? activeFields.filter((x) => x !== f)
      : [...activeFields, f];
    emit();
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useOnboardingFields(): FieldName[] {
  return useSyncExternalStore(onboardingStore.subscribe, onboardingStore.getAll, onboardingStore.getAll);
}
