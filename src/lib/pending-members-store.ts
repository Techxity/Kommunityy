// Pending member submissions from the public join form. Prototype-only in-memory store.
import { useSyncExternalStore } from "react";

export type PendingMember = {
  id: string;
  submittedAt: string; // ISO
  data: Record<string, string>;
  chapterId?: string;
  status: "pending" | "approved" | "rejected";
};

let pending: PendingMember[] = [
  {
    id: "pm-seed-1",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    data: {
      Name: "Ifeoma Nwosu",
      Email: "ifeoma@example.com",
      "Phone number": "+234 802 818 7711",
      "WhatsApp Number": "+234 802 818 7711",
      "Date of Birth": "1991-04-22",
    },
    chapterId: "ch1",
    status: "pending",
  },
  {
    id: "pm-seed-2",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    data: {
      Name: "Bayo Akinwale",
      Email: "bayo@example.com",
      "Phone number": "+234 706 119 0098",
      "WhatsApp Number": "+234 706 119 0098",
      "Date of Birth": "1986-09-09",
    },
    chapterId: "ch2",
    status: "pending",
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const pendingMembersStore = {
  getAll: () => pending,
  add: (input: { data: Record<string, string>; chapterId?: string }) => {
    pending = [
      {
        id: `pm-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        data: input.data,
        chapterId: input.chapterId,
        status: "pending",
      },
      ...pending,
    ];
    emit();
  },
  setStatus: (id: string, status: PendingMember["status"]) => {
    pending = pending.map((p) => (p.id === id ? { ...p, status } : p));
    emit();
  },
  remove: (id: string) => {
    pending = pending.filter((p) => p.id !== id);
    emit();
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function usePendingMembers(): PendingMember[] {
  return useSyncExternalStore(pendingMembersStore.subscribe, pendingMembersStore.getAll, pendingMembersStore.getAll);
}
