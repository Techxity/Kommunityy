// Call Tree state — prototype in-memory store with localStorage persistence
import { useSyncExternalStore } from "react";

export type FeedbackStatus = "doing_great" | "not_sure" | "needs_help";

export type Feedback = {
  status: FeedbackStatus;
  notes?: string;
  submittedAt: string;
};

export type Pairing = {
  id: string;
  // Member IDs from mock-data.members (strings). Triad supported via memberC.
  memberAId: string;
  memberBId: string;
  memberCId?: string;
  // One feedback token per member (single-use update key).
  tokenA: string;
  tokenB: string;
  tokenC?: string;
  feedbackA?: Feedback;
  feedbackB?: Feedback;
  feedbackC?: Feedback;
  emailedAt?: string;
};

export type CallTreeSession = {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  chapterId?: string;
  createdAt: string;
  activatedAt?: string;
  closedAt?: string;
  pairings: Pairing[];
};

const KEY = "kinfolk_call_tree_sessions_v1";

function load(): CallTreeSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CallTreeSession[]) : [];
  } catch {
    return [];
  }
}

let sessions: CallTreeSession[] = load();
const listeners = new Set<() => void>();
const emit = () => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(sessions));
  }
  listeners.forEach((l) => l());
};

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pair(memberIds: string[]): Pairing[] {
  const ids = shuffle(memberIds);
  const out: Pairing[] = [];
  for (let i = 0; i < ids.length; i += 2) {
    const a = ids[i];
    const b = ids[i + 1];
    if (b === undefined) {
      // odd one out → append as triad to the last pair
      if (out.length > 0) {
        const last = out[out.length - 1];
        last.memberCId = a;
        last.tokenC = `t_${rand()}${rand()}`;
      } else {
        // single member: solo pairing
        out.push({
          id: `p_${rand()}`,
          memberAId: a,
          memberBId: a,
          tokenA: `t_${rand()}${rand()}`,
          tokenB: `t_${rand()}${rand()}`,
        });
      }
    } else {
      out.push({
        id: `p_${rand()}`,
        memberAId: a,
        memberBId: b,
        tokenA: `t_${rand()}${rand()}`,
        tokenB: `t_${rand()}${rand()}`,
      });
    }
  }
  return out;
}

function update(id: string, fn: (s: CallTreeSession) => CallTreeSession) {
  sessions = sessions.map((s) => (s.id === id ? fn(s) : s));
  emit();
}

export const callTreeStore = {
  getAll: () => sessions,
  get: (id: string) => sessions.find((s) => s.id === id),
  findByToken: (token: string):
    | { session: CallTreeSession; pairing: Pairing; slot: "A" | "B" | "C"; memberId: string }
    | null => {
    for (const s of sessions) {
      for (const p of s.pairings) {
        if (p.tokenA === token) return { session: s, pairing: p, slot: "A", memberId: p.memberAId };
        if (p.tokenB === token) return { session: s, pairing: p, slot: "B", memberId: p.memberBId };
        if (p.tokenC && p.tokenC === token && p.memberCId)
          return { session: s, pairing: p, slot: "C", memberId: p.memberCId };
      }
    }
    return null;
  },
  create: (input: { name: string; chapterId?: string; memberIds: string[] }) => {
    const s: CallTreeSession = {
      id: `s_${rand()}`,
      name: input.name,
      status: "draft",
      chapterId: input.chapterId,
      createdAt: new Date().toISOString(),
      pairings: pair(input.memberIds),
    };
    sessions = [s, ...sessions];
    emit();
    return s.id;
  },
  regenerate: (sessionId: string, memberIds: string[]) =>
    update(sessionId, (s) => ({ ...s, pairings: pair(memberIds) })),
  swapMembers: (sessionId: string, pairingId: string, fromSlot: "A" | "B" | "C", targetPairingId: string, targetSlot: "A" | "B" | "C") =>
    update(sessionId, (s) => {
      const ps = s.pairings.slice();
      const a = ps.find((p) => p.id === pairingId);
      const b = ps.find((p) => p.id === targetPairingId);
      if (!a || !b) return s;
      const getId = (p: Pairing, slot: "A" | "B" | "C") =>
        slot === "A" ? p.memberAId : slot === "B" ? p.memberBId : p.memberCId;
      const setId = (p: Pairing, slot: "A" | "B" | "C", id: string | undefined) => {
        if (slot === "A") p.memberAId = id!;
        else if (slot === "B") p.memberBId = id!;
        else p.memberCId = id;
      };
      const tmp = getId(a, fromSlot);
      setId(a, fromSlot, getId(b, targetSlot));
      setId(b, targetSlot, tmp);
      return { ...s, pairings: ps };
    }),
  activate: (sessionId: string) =>
    update(sessionId, (s) => ({
      ...s,
      status: "active",
      activatedAt: new Date().toISOString(),
      pairings: s.pairings.map((p) => ({ ...p, emailedAt: new Date().toISOString() })),
    })),
  close: (sessionId: string) =>
    update(sessionId, (s) => ({ ...s, status: "closed", closedAt: new Date().toISOString() })),
  remove: (sessionId: string) => {
    sessions = sessions.filter((s) => s.id !== sessionId);
    emit();
  },
  submitFeedback: (token: string, status: FeedbackStatus, notes?: string) => {
    const hit = callTreeStore.findByToken(token);
    if (!hit) return false;
    update(hit.session.id, (s) => ({
      ...s,
      pairings: s.pairings.map((p) => {
        if (p.id !== hit.pairing.id) return p;
        const fb: Feedback = { status, notes, submittedAt: new Date().toISOString() };
        if (hit.slot === "A") return { ...p, feedbackA: fb };
        if (hit.slot === "B") return { ...p, feedbackB: fb };
        return { ...p, feedbackC: fb };
      }),
    }));
    return true;
  },
  subscribe: (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useCallTreeSessions(): CallTreeSession[] {
  return useSyncExternalStore(callTreeStore.subscribe, callTreeStore.getAll, callTreeStore.getAll);
}
