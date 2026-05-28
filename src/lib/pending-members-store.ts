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
      Country: "Nigeria",
      Role: "Member",
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
      Country: "Nigeria",
      Role: "Member",
    },
    chapterId: "ch2",
    status: "pending",
  },
  {
    id: "pm-seed-3",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    data: {
      Name: "Sarah Johnson",
      Email: "sarah@example.com",
      "Phone number": "+1 713 555 0142",
      "WhatsApp Number": "+1 713 555 0142",
      "Date of Birth": "1990-03-15",
      Country: "United States",
      Role: "Member",
    },
    chapterId: "ch6",
    status: "pending",
  },
  {
    id: "pm-seed-4",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    data: {
      Name: "Emeka Obi",
      Email: "emeka@example.com",
      "Phone number": "+234 803 444 5566",
      "WhatsApp Number": "+234 803 444 5566",
      "Date of Birth": "1985-07-10",
      Country: "Nigeria",
      Role: "Treasurer",
    },
    chapterId: "ch3",
    status: "pending",
  },
  {
    id: "pm-seed-5",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    data: {
      Name: "Olivia Thompson",
      Email: "olivia@example.com",
      "Phone number": "+44 20 7946 0123",
      "WhatsApp Number": "+44 20 7946 0123",
      "Date of Birth": "1992-11-28",
      Country: "United Kingdom",
      Role: "Secretary",
    },
    chapterId: "ch5",
    status: "pending",
  },
  {
    id: "pm-seed-6",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    data: {
      Name: "Nkechi Adeyemi",
      Email: "nkechi@example.com",
      "Phone number": "+234 805 777 8899",
      "WhatsApp Number": "+234 805 777 8899",
      "Date of Birth": "1988-01-20",
      Country: "Nigeria",
      Role: "Member",
    },
    chapterId: "ch1",
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
