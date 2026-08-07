import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getMyDuesPlan, saveDuesPlan, listDuesPayments } from "@/lib/payments/dues.functions";
import { getDashboardStats } from "@/lib/payments/communities.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banknote, Calendar, Users, Settings } from "lucide-react";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/dues")({
  beforeLoad: () => requireModule("Dues"),
  component: Dues,
});

type Plan = Awaited<ReturnType<typeof getMyDuesPlan>>;
type Payment = Awaited<ReturnType<typeof listDuesPayments>>[number];

function Dues() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [activeMembers, setActiveMembers] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("Membership dues");
  const [interval, setInterval] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [amountNgn, setAmountNgn] = useState("");
  const [amountUsd, setAmountUsd] = useState("");

  function refresh() {
    getMyDuesPlan().then(setPlan);
    listDuesPayments().then(setHistory);
    getDashboardStats().then((s) => setActiveMembers(s.activeMembers));
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (open) {
      setName(plan?.name ?? "Membership dues");
      setInterval(plan?.interval ?? "monthly");
      setAmountNgn(plan?.amountNgn ? String(plan.amountNgn) : "");
      setAmountUsd(plan?.amountUsd ? String(plan.amountUsd) : "");
      setError("");
    }
  }, [open, plan]);

  async function save() {
    if (!amountNgn && !amountUsd) {
      setError("Set an amount in at least one currency.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveDuesPlan({
        data: {
          name,
          interval,
          amountNgn: amountNgn ? Number(amountNgn) : null,
          amountUsd: amountUsd ? Number(amountUsd) : null,
        },
      });
      setOpen(false);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save dues setup.");
    } finally {
      setSaving(false);
    }
  }

  const totalCollectedNgn = history.filter((h) => h.status === "paid" && h.currency === "NGN").reduce((s, h) => s + h.amount, 0);
  const totalCollectedUsd = history.filter((h) => h.status === "paid" && h.currency === "USD").reduce((s, h) => s + h.amount, 0);

  const currentDuesValue = plan
    ? [plan.amountNgn ? `₦${plan.amountNgn.toLocaleString()}` : null, plan.amountUsd ? `$${plan.amountUsd.toLocaleString()}` : null]
        .filter(Boolean)
        .join(" / ")
    : "Not set up";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Dues</h1>
          <p className="text-sm text-muted-foreground">
            Manage community dues and view payment history.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Dues setup
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Recurring dues setup</DialogTitle>
            </DialogHeader>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Plan name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </Field>
              </div>
              <Field label="Amount (₦ NGN)">
                <input
                  value={amountNgn}
                  onChange={(e) => setAmountNgn(e.target.value)}
                  type="number"
                  placeholder="5000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </Field>
              <Field label="Amount ($ USD)">
                <input
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  type="number"
                  placeholder="10"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Frequency">
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as typeof interval)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </Field>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Leave a currency blank to not accept dues in it. Saving replaces your current plan — past payment history stays intact.
            </p>
            {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <div className="mt-4 flex items-center justify-end">
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save dues setup"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 md:grid-cols-4">
        <Tile
          icon={Banknote}
          label="Current dues"
          value={currentDuesValue}
          sub={plan ? `${plan.interval.charAt(0).toUpperCase()}${plan.interval.slice(1)}` : "Set up your plan"}
        />
        <Tile
          icon={Calendar}
          label="Total collected"
          value={[totalCollectedNgn ? `₦${totalCollectedNgn.toLocaleString()}` : null, totalCollectedUsd ? `$${totalCollectedUsd.toLocaleString()}` : null].filter(Boolean).join(" / ") || "₦0"}
          sub="till date"
        />
        <Tile
          icon={Users}
          label="Active members"
          value={`${activeMembers}`}
          sub="in your community"
        />
        <Tile
          icon={Calendar}
          label="Payments recorded"
          value={`${history.length}`}
          sub="all time"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Payment history</h2>
          <span className="text-xs text-muted-foreground">{history.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{d.member}</td>
                  <td className="px-4 py-3">{d.currency === "NGN" ? "₦" : "$"}{d.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        d.status === "paid"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-4 w-4 text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
