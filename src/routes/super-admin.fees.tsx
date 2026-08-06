import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { listSubscriptionTiers, updateTierFee } from "@/lib/payments/tiers.functions";
import { Button } from "@/components/ui/button";
import { Percent } from "lucide-react";

export const Route = createFileRoute("/super-admin/fees")({
  component: FeesPage,
});

type Tier = {
  id: string;
  name: string;
  platform_fee_pct: number;
  monthly_price_ngn: number;
  monthly_price_usd: number;
};

function FeesPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const data = await listSubscriptionTiers();
    setTiers((data ?? []) as Tier[]);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (t: Tier) => {
    setBusy(t.id);
    setMsg(null);
    try {
      await updateTierFee({ data: { tier_id: t.id, platform_fee_pct: t.platform_fee_pct } });
      setMsg(`Saved ${t.name}: ${t.platform_fee_pct}%`);
    } catch (e: any) {
      setMsg(e.message ?? "Could not save");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Platform fees</h1>
        <p className="text-sm text-muted-foreground">
          Each subscription tier sets the percentage we keep from every payment a community on
          that tier collects.
        </p>
      </header>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div>Tier</div>
          <div>Platform fee %</div>
          <div></div>
        </div>
        {tiers.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border p-4 last:border-0"
          >
            <div>
              <p className="font-display text-base font-bold">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                ₦{Number(t.monthly_price_ngn).toLocaleString()} / $
                {Number(t.monthly_price_usd).toLocaleString()} per month
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                value={t.platform_fee_pct}
                onChange={(e) =>
                  setTiers((prev) =>
                    prev.map((x) =>
                      x.id === t.id ? { ...x, platform_fee_pct: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" onClick={() => save(t)} disabled={busy === t.id}>
              {busy === t.id ? "…" : "Save"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
