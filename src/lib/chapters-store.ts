// Tiny in-memory chapters store shared across admin routes (prototype-only).
import { useSyncExternalStore } from "react";

export type Chapter = {
  id: string;
  name: string;
  region: string;
  coordinator: string;
  memberCount: number;
};

let chapters: Chapter[] = [
  { id: "ch1", name: "Lagos Chapter", region: "South West, Nigeria", coordinator: "Adaeze Okafor", memberCount: 84 },
  { id: "ch2", name: "Abuja Chapter", region: "North Central, Nigeria", coordinator: "Yusuf Bello", memberCount: 52 },
  { id: "ch3", name: "Port Harcourt Chapter", region: "South South, Nigeria", coordinator: "Amaka Ibe", memberCount: 39 },
  { id: "ch4", name: "Enugu Chapter", region: "South East, Nigeria", coordinator: "Chiamaka Eze", memberCount: 28 },
  { id: "ch5", name: "London Chapter", region: "United Kingdom", coordinator: "Tunde Bakare", memberCount: 21 },
  { id: "ch6", name: "Houston Chapter", region: "United States", coordinator: "Kola Salami", memberCount: 23 },
];

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export const chaptersStore = {
  getAll: () => chapters,
  add: (input: Omit<Chapter, "id" | "memberCount"> & { memberCount?: number }) => {
    chapters = [
      ...chapters,
      { id: `ch${Date.now()}`, memberCount: 0, ...input },
    ];
    emit();
  },
  update: (id: string, patch: Partial<Chapter>) => {
    chapters = chapters.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
  },
  remove: (id: string) => {
    chapters = chapters.filter((c) => c.id !== id);
    emit();
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useChapters(): Chapter[] {
  return useSyncExternalStore(chaptersStore.subscribe, chaptersStore.getAll, chaptersStore.getAll);
}
