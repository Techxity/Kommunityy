// In-memory community store (prototype-only).
import { useSyncExternalStore } from "react";
import { communities as seed } from "./platform-data";

export type OnboardingSubmission = {
  submittedAt: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  website?: string;
  foundedYear: number;
  expectedMembers: number;
  primaryGoal: string;
  collectsDues: "Yes" | "Not yet" | "Planning to";
  paymentProvider: string;
  agreedToTerms: boolean;
  notes?: string;
};

export type Community = (typeof seed)[number] & {
  disabled?: boolean;
  onboarding?: OnboardingSubmission;
};

let items: Community[] = seed.map((c) => ({ ...c }));

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const communitiesStore = {
  getAll: () => items,
  setDisabled: (id: string, disabled: boolean) => {
    items = items.map((c) => (c.id === id ? { ...c, disabled } : c));
    emit();
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useCommunities(): Community[] {
  return useSyncExternalStore(communitiesStore.subscribe, communitiesStore.getAll, communitiesStore.getAll);
}

// Demo: map demo emails to their community for the prototype login/join gate.
const emailToCommunityId: Record<string, string> = {};

export function communityIdForEmail(email: string): string | undefined {
  return emailToCommunityId[email.trim().toLowerCase()];
}

export function isCommunityDisabled(id: string | undefined): boolean {
  if (!id) return false;
  return !!items.find((c) => c.id === id)?.disabled;
}
