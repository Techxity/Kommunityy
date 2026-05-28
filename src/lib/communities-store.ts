// In-memory community store (prototype-only).
import { useSyncExternalStore } from "react";
import { communities as seed } from "./platform-data";

export type Community = (typeof seed)[number] & { disabled?: boolean };

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
