import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Plus, Pencil, Power, X, Clock, Save } from "lucide-react";
import {
  listPlansForSuperAdmin,
  listModuleCatalog,
  addModuleToCatalog,
  removeModuleFromCatalog,
  createPlan,
  updatePlan,
  setPlanActive,
  getTrialSettings,
  updateTrialSettings,
} from "@/lib/payments/tiers.functions";

export const Route = createFileRoute("/super-admin/plans")({
  head: () => ({ meta: [{ title: "Plans & Modules — Super Admin" }] }),
  component: PlansPage,
});

type Plan = Awaited<ReturnType<typeof listPlansForSuperAdmin>>[number];

function PlansPage() {
  const [modules, setModules] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [newModule, setNewModule] = useState("");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [reassignFor, setReassignFor] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  // Trial defaults applied to every community that signs up without picking
  // a plan (platform_settings, a real singleton row — not local-only).
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState(14);
  const [trialTierId, setTrialTierId] = useState<string>("");
  const [requireCard, setRequireCard] = useState(false);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialSaved, setTrialSaved] = useState(false);

  async function saveTrial() {
    setTrialSaving(true);
    try {
      await updateTrialSettings({
        data: { enabled: trialEnabled, days: trialDays, tierId: trialTierId || null, requireCard },
      });
      setTrialSaved(true);
      setTimeout(() => setTrialSaved(false), 1500);
    } finally {
      setTrialSaving(false);
    }
  }

  function refresh() {
    listPlansForSuperAdmin().then((rows) => {
      setPlans(rows);
      if (!rows.some((p) => p.id === selectedTierId) && rows[0]) setSelectedTierId(rows[0].id);
    });
    listModuleCatalog().then(setModules);
    getTrialSettings().then((s) => {
      setTrialEnabled(s.enabled);
      setTrialDays(s.days);
      setTrialTierId(s.tierId ?? "");
      setRequireCard(s.requireCard);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const plan = plans.find((p) => p.id === selectedTierId) ?? plans[0];

  async function toggleModule(m: string) {
    if (!plan) return;
    const nextModules = plan.modules.includes(m) ? plan.modules.filter((x) => x !== m) : [...plan.modules, m];
    await updatePlan({ data: { id: plan.id, name: plan.name, priceNgn: plan.priceNgn, priceUsd: plan.priceUsd, maxMembers: plan.maxMembers, modules: nextModules } });
    refresh();
  }

  async function addModule() {
    const name = newModule.trim();
    if (!name || modules.includes(name)) return;
    await addModuleToCatalog({ data: { name } });
    setNewModule("");
    refresh();
  }

  async function removeModule(name: string) {
    await removeModuleFromCatalog({ data: { name } });
    refresh();
  }

  async function togglePlanActive(p: Plan) {
    setError("");
    if (p.active) {
      // Disabling — check whether communities need to be moved first.
      const res = await setPlanActive({ data: { id: p.id, active: false } });
      if (!res.ok && res.needsReassignment) {
        setReassignFor(p);
        return;
      }
      refresh();
    } else {
      await setPlanActive({ data: { id: p.id, active: true } });
      refresh();
    }
  }

  function savePlan(data: { name: string; priceUsd: number; priceNgn: number; maxMembers: number | null }, id?: string) {
    const run = id
      ? updatePlan({ data: { id, ...data, modules: plans.find((p) => p.id === id)?.modules ?? [] } })
      : createPlan({ data: { ...data, modules: [] } });
    run
      .then(() => {
        setEditing(null);
        setCreatingPlan(false);
        refresh();
      })
      .catch((err: any) => setError(err?.message ?? "Couldn't save plan."));
  }

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Plans & modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control what each subscription tier unlocks for community admins.</p>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Plans & modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control what each subscription tier unlocks for community admins.</p>
        </div>
        <button
          onClick={() => setCreatingPlan(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New plan tier
        </button>
      </div>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl border p-6 shadow-soft transition ${
              selectedTierId === p.id ? "border-primary bg-card ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/50"
            } ${!p.active ? "opacity-60" : ""}`}
          >
            <button onClick={() => setSelectedTierId(p.id)} className="block w-full text-left">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.name}</p>
                {!p.active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Disabled
                  </span>
                )}
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                ${p.priceUsd}
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">₦{p.priceNgn.toLocaleString()}/mo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Up to {p.maxMembers == null ? "unlimited" : p.maxMembers} members
              </p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.modules.length} modules</span>
                <span className="font-semibold">{p.activeSubscriptions} active</span>
              </div>
            </button>
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
              <button
                onClick={() => setEditing(p)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => togglePlanActive(p)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  !p.active
                    ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Power className="h-3 w-3" /> {!p.active ? "Enable" : "Disable"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Trial settings</p>
              <p className="text-xs text-muted-foreground">
                Applied to every newly provisioned community.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trialEnabled}
              onChange={(e) => setTrialEnabled(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Free trials enabled
          </label>
        </div>

        <div className={`mt-5 grid gap-4 sm:grid-cols-3 ${!trialEnabled ? "opacity-50" : ""}`}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trial duration (days)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              disabled={!trialEnabled}
              value={trialDays}
              onChange={(e) => setTrialDays(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Common: 7, 14, 30.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trial plan tier
            </label>
            <select
              disabled={!trialEnabled}
              value={trialTierId}
              onChange={(e) => setTrialTierId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed"
            >
              <option value="">No tier (trial gets no modules)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">Trials get every module on this tier.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Card on file
            </label>
            <label className="mt-1 flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
              <input
                type="checkbox"
                disabled={!trialEnabled}
                checked={requireCard}
                onChange={(e) => setRequireCard(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Require card to start trial
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">When off, no payment method is needed.</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {trialEnabled
              ? `New communities get a ${trialDays}-day${plans.find((p) => p.id === trialTierId) ? ` ${plans.find((p) => p.id === trialTierId)!.name}` : ""} trial${requireCard ? ", card required" : ", no card required"}.`
              : "Trials are off — new communities must pick a paid plan at signup."}
          </p>
          <button
            onClick={saveTrial}
            disabled={trialSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {trialSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {trialSaving ? "Saving…" : trialSaved ? "Saved" : "Save trial settings"}
          </button>
        </div>
      </div>

      {plan && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Editing</p>
              <p className="font-display text-xl font-bold">{plan.name} — module access</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const on = plan.modules.includes(m);
              return (
                <div
                  key={m}
                  className={`group flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                    on ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <span className={`grid h-6 w-6 place-items-center rounded-md ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="text-sm font-medium">{m}</span>
                    <input type="checkbox" checked={on} onChange={() => toggleModule(m)} className="sr-only" />
                  </label>
                  <button
                    onClick={() => removeModule(m)}
                    title="Remove module from catalog"
                    className="ml-2 grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
            <input
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addModule()}
              placeholder="New module name (e.g. Events, SMS Credits)"
              className="flex-1 min-w-[220px] rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={addModule}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add module
            </button>
          </div>
        </div>
      )}

      {(editing || creatingPlan) && (
        <PlanEditor
          initial={editing}
          existingNames={plans.filter((p) => p.id !== editing?.id).map((p) => p.name)}
          onCancel={() => {
            setEditing(null);
            setCreatingPlan(false);
          }}
          onSave={savePlan}
        />
      )}

      {reassignFor && (
        <ReassignModal
          plan={reassignFor}
          otherPlans={plans.filter((p) => p.id !== reassignFor.id && p.active)}
          onCancel={() => setReassignFor(null)}
          onConfirm={async (targetId) => {
            setError("");
            try {
              await setPlanActive({ data: { id: reassignFor.id, active: false, moveCommunitiesToTierId: targetId } });
              setReassignFor(null);
              refresh();
            } catch (err: any) {
              setError(err?.message ?? "Couldn't move communities.");
            }
          }}
        />
      )}
    </div>
  );
}

function ReassignModal({
  plan,
  otherPlans,
  onCancel,
  onConfirm,
}: {
  plan: Plan;
  otherPlans: Plan[];
  onCancel: () => void;
  onConfirm: (targetId: string) => void;
}) {
  const [target, setTarget] = useState(otherPlans[0]?.id ?? "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg font-bold">Move communities off {plan.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.activeSubscriptions} {plan.activeSubscriptions === 1 ? "community is" : "communities are"} currently on this plan. Pick where they should move before it's disabled.
        </p>
        {otherPlans.length === 0 ? (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            No other active plan to move them to — enable another plan first.
          </p>
        ) : (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {otherPlans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => target && onConfirm(target)}
            disabled={!target}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Move & disable
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanEditor({
  initial,
  existingNames,
  onCancel,
  onSave,
}: {
  initial: Plan | null;
  existingNames: string[];
  onCancel: () => void;
  onSave: (data: { name: string; priceUsd: number; priceNgn: number; maxMembers: number | null }, id?: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [priceUsd, setPriceUsd] = useState(initial?.priceUsd ?? 0);
  const [priceNgn, setPriceNgn] = useState(initial?.priceNgn ?? 0);
  const [unlimited, setUnlimited] = useState(initial?.maxMembers == null);
  const [limit, setLimit] = useState<number>(initial?.maxMembers ?? 100);

  const isNew = !initial;
  const conflict = existingNames.includes(name.trim());
  const canSave = name.trim().length > 0 && !conflict;

  function handleSave() {
    if (!canSave) return;
    onSave(
      {
        name: name.trim(),
        priceUsd: Number(priceUsd) || 0,
        priceNgn: Number(priceNgn) || 0,
        maxMembers: unlimited ? null : Number(limit) || 0,
      },
      initial?.id,
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{isNew ? "New plan tier" : `Edit ${initial?.name}`}</p>
          <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {conflict && <p className="mt-1 text-xs text-destructive">A plan with this name already exists.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly price (USD)</label>
              <input
                type="number"
                min={0}
                value={priceUsd}
                onChange={(e) => setPriceUsd(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly price (₦ NGN)</label>
              <input
                type="number"
                min={0}
                value={priceNgn}
                onChange={(e) => setPriceNgn(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member limit</label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="number"
                min={0}
                disabled={unlimited}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
                Unlimited
              </label>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isNew ? "Create plan" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
