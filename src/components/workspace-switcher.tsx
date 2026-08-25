import { useEffect, useState } from "react";
import { ChevronsUpDown, Plus, Check, X, Loader2, Building2 } from "lucide-react";
import { listMyWorkspaces, setActiveWorkspace } from "@/lib/membership/members.functions";
import { createAnotherCommunity, getCommunityCreationEligibility } from "@/lib/auth/auth.functions";

type Workspace = Awaited<ReturnType<typeof listMyWorkspaces>>[number];

const TYPES = ["Community of Tenants", "Alumni group", "Fellowship", "Religious Community", "Estate", "Cooperative", "Others"];

// Unified switcher shown in every console. Lists every community the account
// administers (Admin), is an active member of (Member), plus the platform
// console for super admins. Selecting one pins that community server-side and
// jumps to the right console. Also offers "Create another community" for admins
// who qualify (i.e. already have a community on a paid plan).
export function WorkspaceSwitcher({ current }: { current: "admin" | "member" | "super" }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listMyWorkspaces().then(setWorkspaces).catch(() => {});
    getCommunityCreationEligibility().then((r) => setCanCreate(r.canCreate)).catch(() => {});
  }, []);

  if (workspaces.length === 0) return null;
  if (workspaces.length < 2 && !canCreate) return null;

  const keyFor = (w: Workspace) => `${w.role}:${w.communityId ?? "platform"}`;
  const selected =
    (current === "super"
      ? workspaces.find((w) => w.role === "super")
      : workspaces.find((w) => w.role === current && w.active) ?? workspaces.find((w) => w.role === current)) ??
    workspaces[0];

  const roleLabel = (r: Workspace["role"]) => (r === "admin" ? "Admin" : r === "member" ? "Member" : "Platform");

  async function onSelect(w: Workspace) {
    if (busy || keyFor(w) === keyFor(selected)) return setOpen(false);
    setBusy(true);
    try {
      if (w.role === "super") {
        window.location.assign("/super-admin");
        return;
      }
      await setActiveWorkspace({ data: { communityId: w.communityId as string } });
      window.location.assign(w.role === "admin" ? "/admin" : "/member");
    } catch {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-label="Switch workspace"
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-2.5 text-xs font-semibold text-foreground outline-none hover:bg-muted focus:border-ring disabled:opacity-60"
      >
        <span className="max-w-[10rem] truncate">{selected.role === "super" ? selected.name : `${selected.name} · ${roleLabel(selected.role)}`}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="max-h-72 overflow-y-auto py-1">
              {workspaces.map((w) => {
                const active = keyFor(w) === keyFor(selected);
                return (
                  <button
                    key={keyFor(w)}
                    onClick={() => onSelect(w)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${active ? "font-semibold" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{w.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{roleLabel(w.role)}</span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
            {canCreate && (
              <div className="border-t border-border">
                <button
                  onClick={() => { setOpen(false); setShowCreate(true); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-accent hover:bg-muted"
                >
                  <Plus className="h-4 w-4" /> Create another community
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateCommunityModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (name.trim().length < 2) return setError("Enter a community name.");
    setCreating(true);
    setError("");
    try {
      const r = await createAnotherCommunity({ data: { communityName: name.trim(), communityType: type || undefined } });
      // Pin the new community and land in its admin console.
      await setActiveWorkspace({ data: { communityId: r.communityId } });
      window.location.assign("/admin");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't create the community.");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Building2 className="h-5 w-5 text-accent" /> Create another community
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">You'll be the admin. It starts on a free trial, and you can switch between your communities any time.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Community name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Ikoyi Landlords Association"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Type <span className="text-muted-foreground">(optional)</span></label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring">
              <option value="">Select a type…</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button
            onClick={create}
            disabled={creating || name.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "Creating…" : "Create community"}
          </button>
        </div>
      </div>
    </div>
  );
}
