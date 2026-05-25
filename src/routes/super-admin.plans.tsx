import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { plans, allModules, type PlanTier } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/plans")({
  head: () => ({ meta: [{ title: "Plans & Modules — Super Admin" }] }),
  component: PlansPage,
});

function PlansPage() {
  const [selected, setSelected] = useState<PlanTier>("Growth");
  const plan = plans.find((p) => p.tier === selected)!;
  const [enabled, setEnabled] = useState<string[]>(plan.modules);

  function toggle(m: string) {
    setEnabled((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function selectTier(t: PlanTier) {
    setSelected(t);
    setEnabled(plans.find((p) => p.tier === t)!.modules);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Plans & modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control what each subscription tier unlocks for community admins.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New plan tier
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <button
            key={p.tier}
            onClick={() => selectTier(p.tier)}
            className={`rounded-2xl border p-6 text-left shadow-soft transition ${
              selected === p.tier ? "border-primary bg-card ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.tier}</p>
            <p className="mt-2 font-display text-3xl font-bold">${p.priceMonthly}<span className="text-base font-medium text-muted-foreground">/mo</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Up to {p.memberLimit === "Unlimited" ? "unlimited" : p.memberLimit} members</p>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{p.modules.length} modules</span>
              <span className="font-semibold">{p.activeSubscriptions} active</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Editing</p>
            <p className="font-display text-xl font-bold">{plan.tier} — module access</p>
          </div>
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Save changes</button>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allModules.map((m) => {
            const on = enabled.includes(m);
            return (
              <label key={m} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${on ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 place-items-center rounded-md ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-sm font-medium">{m}</span>
                </div>
                <input type="checkbox" checked={on} onChange={() => toggle(m)} className="sr-only" />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
