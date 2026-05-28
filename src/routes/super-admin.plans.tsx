import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus, Pencil, Power, X, Clock, Save } from "lucide-react";
import { plans as seedPlans, allModules as seedModules } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/plans")({
  head: () => ({ meta: [{ title: "Plans & Modules — Super Admin" }] }),
  component: PlansPage,
});

type Plan = {
  tier: string;
  priceMonthly: number;
  memberLimit: number | "Unlimited";
  modules: string[];
  activeSubscriptions: number;
  disabled?: boolean;
};

function PlansPage() {
  const [modules, setModules] = useState<string[]>(seedModules);
  const [plans, setPlans] = useState<Plan[]>(seedPlans.map((p) => ({ ...p })));
  const [selectedTier, setSelectedTier] = useState<string>("Growth");
  const [newModule, setNewModule] = useState("");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const plan = plans.find((p) => p.tier === selectedTier) ?? plans[0];

  function toggleModule(m: string) {
    setPlans((prev) =>
      prev.map((p) =>
        p.tier === plan.tier
          ? { ...p, modules: p.modules.includes(m) ? p.modules.filter((x) => x !== m) : [...p.modules, m] }
          : p,
      ),
    );
  }

  function addModule() {
    const name = newModule.trim();
    if (!name || modules.includes(name)) return;
    setModules((m) => [...m, name]);
    setNewModule("");
  }

  function removeModule(name: string) {
    setModules((m) => m.filter((x) => x !== name));
    setPlans((prev) => prev.map((p) => ({ ...p, modules: p.modules.filter((x) => x !== name) })));
  }

  function togglePlanDisabled(tier: string) {
    setPlans((prev) => prev.map((p) => (p.tier === tier ? { ...p, disabled: !p.disabled } : p)));
  }

  function savePlan(updated: Plan, originalTier?: string) {
    setPlans((prev) => {
      if (originalTier && originalTier !== updated.tier) {
        return prev.map((p) => (p.tier === originalTier ? updated : p));
      }
      if (prev.some((p) => p.tier === updated.tier)) {
        return prev.map((p) => (p.tier === updated.tier ? updated : p));
      }
      return [...prev, updated];
    });
    if (originalTier === selectedTier) setSelectedTier(updated.tier);
    setEditing(null);
    setCreatingPlan(false);
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.tier}
            className={`relative rounded-2xl border p-6 shadow-soft transition ${
              selectedTier === p.tier ? "border-primary bg-card ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/50"
            } ${p.disabled ? "opacity-60" : ""}`}
          >
            <button onClick={() => setSelectedTier(p.tier)} className="block w-full text-left">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.tier}</p>
                {p.disabled && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Disabled
                  </span>
                )}
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                ${p.priceMonthly}
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Up to {p.memberLimit === "Unlimited" ? "unlimited" : p.memberLimit} members
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
                onClick={() => togglePlanDisabled(p.tier)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  p.disabled
                    ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Power className="h-3 w-3" /> {p.disabled ? "Enable" : "Disable"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Editing</p>
            <p className="font-display text-xl font-bold">{plan.tier} — module access</p>
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

      {(editing || creatingPlan) && (
        <PlanEditor
          initial={editing}
          existingTiers={plans.map((p) => p.tier)}
          onCancel={() => {
            setEditing(null);
            setCreatingPlan(false);
          }}
          onSave={savePlan}
        />
      )}
    </div>
  );
}

function PlanEditor({
  initial,
  existingTiers,
  onCancel,
  onSave,
}: {
  initial: Plan | null;
  existingTiers: string[];
  onCancel: () => void;
  onSave: (p: Plan, originalTier?: string) => void;
}) {
  const [tier, setTier] = useState(initial?.tier ?? "");
  const [price, setPrice] = useState(initial?.priceMonthly ?? 0);
  const [unlimited, setUnlimited] = useState(initial?.memberLimit === "Unlimited");
  const [limit, setLimit] = useState<number>(typeof initial?.memberLimit === "number" ? initial.memberLimit : 100);

  const isNew = !initial;
  const conflict = isNew ? existingTiers.includes(tier.trim()) : tier.trim() !== initial?.tier && existingTiers.includes(tier.trim());
  const canSave = tier.trim().length > 0 && !conflict;

  function handleSave() {
    if (!canSave) return;
    onSave(
      {
        tier: tier.trim(),
        priceMonthly: Number(price) || 0,
        memberLimit: unlimited ? "Unlimited" : Number(limit) || 0,
        modules: initial?.modules ?? [],
        activeSubscriptions: initial?.activeSubscriptions ?? 0,
        disabled: initial?.disabled ?? false,
      },
      initial?.tier,
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{isNew ? "New plan tier" : `Edit ${initial?.tier}`}</p>
          <button onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier name</label>
            <input
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {conflict && <p className="mt-1 text-xs text-destructive">A plan with this name already exists.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly price (USD)</label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
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
