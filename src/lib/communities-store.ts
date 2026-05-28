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

const sampleSubmissions: Record<string, OnboardingSubmission> = {
  "CRE-2024-001": {
    submittedAt: "2024-01-12",
    contactName: "Adaeze Okafor",
    contactRole: "Estate Chairperson",
    contactEmail: "adaeze@crestwood.community",
    contactPhone: "+234 803 220 7741",
    address: "12 Crestwood Avenue, Lekki Phase 1, Lagos, Nigeria",
    website: "https://crestwoodestate.ng",
    foundedYear: 2014,
    expectedMembers: 260,
    primaryGoal: "Streamline dues collection and emergency call tree",
    collectsDues: "Yes",
    paymentProvider: "Paystack",
    agreedToTerms: true,
    notes: "Quarterly levy + occasional special assessments.",
  },
  "LSA-2023-018": {
    submittedAt: "2023-08-04",
    contactName: "Emeka Nwosu",
    contactRole: "Alumni President",
    contactEmail: "emeka@lsa08.org",
    contactPhone: "+234 805 118 9920",
    address: "Kings College Old Boys Hall, Lagos Island, Nigeria",
    foundedYear: 2008,
    expectedMembers: 420,
    primaryGoal: "Track members across chapters and run annual elections",
    collectsDues: "Yes",
    paymentProvider: "Flutterwave",
    agreedToTerms: true,
  },
  "GBO-2024-044": {
    submittedAt: "2025-05-09",
    contactName: "Linda Park",
    contactRole: "HOA Board Member",
    contactEmail: "linda@greenbriar.us",
    contactPhone: "+1 (415) 555-0188",
    address: "210 Greenbriar Lane, Palo Alto, CA 94301, USA",
    foundedYear: 2019,
    expectedMembers: 90,
    primaryGoal: "Member directory and newsletter broadcasts",
    collectsDues: "Planning to",
    paymentProvider: "Stripe",
    agreedToTerms: true,
    notes: "Currently using a shared spreadsheet — needs migration help.",
  },
};

let items: Community[] = seed.map((c) => ({
  ...c,
  onboarding: sampleSubmissions[c.id],
}));

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
const emailToCommunityId: Record<string, string> = {
  "adaeze@crestwood.community": "CRE-2024-001",
  "femi@crestwood.community": "CRE-2024-001",
};

export function communityIdForEmail(email: string): string | undefined {
  return emailToCommunityId[email.trim().toLowerCase()];
}

export function isCommunityDisabled(id: string | undefined): boolean {
  if (!id) return false;
  return !!items.find((c) => c.id === id)?.disabled;
}
