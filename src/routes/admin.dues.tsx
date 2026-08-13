import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getMyDuesPlan, saveDuesPlan, listDuesPayments, getDuesArrears, sendDuesReminders } from "@/lib/payments/dues.functions";
import { getDashboardStats } from "@/lib/payments/communities.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banknote, Calendar, Users, Settings, AlertTriangle, Bell, TrendingUp } from "lucide-react";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/dues")({
  beforeLoad: () => requireModule("Dues"),
  component: Dues,
});

type Plan = Awaited<ReturnType<typeof getMyDuesPlan>>;
type Payment = Awaited<ReturnType<typeof listDuesPayments>>[number];
type Arrears = Awaited<ReturnType<typeof getDuesArrears>>;

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function Dues() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [activeMembers, setActiveMembers] = useState(0);
  const [arrears, setArrears] = useState<Arrears | null>(null);
  const [reminding, setReminding] = useState<string | "all" | null>(null);
  const [remindMsg, setRemindMsg] = useState("");
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
    getDuesArrears().then(setArrears);
  }

  async function remind(memberIds?: string[]) {
    setReminding(memberIds && memberIds.length === 1 ? memberIds[0] : "all");
    setRemindMsg("");
    try {
      const r = await sendDuesReminders({ data: memberIds ? { memberIds } : {} });
      const parts = [`${r.sent} email${r.sent === 1 ? "" : "s"} sent`];
      if (r.smsSent) parts.push(`${r.smsSent} text${r.smsSent === 1 ? "" : "s"} sent`);
      if (r.failed) parts.push(`${r.failed} failed`);
      if (r.skipped) parts.push(`${r.skipped} skipped (no email on file)`);
      setRemindMsg(parts.join(" · "));
      getDuesArrears().then(setArrears);
    } catch (err: any) {
      setRemindMsg(err?.message ?? "Couldn't send reminders.");
    } finally {
      setReminding(null);
    }
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

      {/* Arrears & defaulters */}
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Arrears &amp; defaulters</h2>
            <p className="text-xs text-muted-foreground">
              Members behind on dues, counting each {plan ? plan.interval.replace("ly", "") : "period"} since they joined.
            </p>
          </div>
          {arrears?.summary && arrears.summary.defaulters > 0 && (
            <Button
              onClick={() => remind()}
              disabled={reminding !== null}
              className="gap-2"
            >
              <Bell className="h-4 w-4" />
              {reminding === "all" ? "Sending…" : `Remind all (${arrears.summary.defaulters})`}
            </Button>
          )}
        </div>

        {!plan ? (
          <p className="p-6 text-sm text-muted-foreground">Set up a dues plan above to start tracking who's paid and who's behind.</p>
        ) : (
          <>
            <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-3">
              <MiniStat icon={TrendingUp} label="Collection rate" value={`${arrears?.summary?.collectionRate ?? 0}%`} tone="default" />
              <MiniStat icon={AlertTriangle} label="Defaulters" value={`${arrears?.summary?.defaulters ?? 0}`} tone={arrears?.summary && arrears.summary.defaulters > 0 ? "warn" : "default"} />
              <MiniStat icon={Banknote} label="Total outstanding" value={arrears?.summary?.totalOutstandingLabel ?? "—"} tone={arrears?.summary && (arrears.summary.outstandingNgn > 0 || arrears.summary.outstandingUsd > 0) ? "warn" : "default"} />
            </div>

            {remindMsg && <p className="px-4 pt-3 text-xs text-muted-foreground">{remindMsg}</p>}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Behind</th>
                    <th className="px-4 py-3 font-medium">Owed</th>
                    <th className="px-4 py-3 font-medium">Last paid</th>
                    <th className="px-4 py-3 font-medium">Last reminded</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(arrears?.defaulters ?? []).map((d) => (
                    <tr key={d.memberId} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.email || (d.phone ? d.phone : "No email on file")}</div>
                      </td>
                      <td className="px-4 py-3">{d.periodsBehind} {plan.interval.replace("ly", "")}{d.periodsBehind === 1 ? "" : "s"}</td>
                      <td className="px-4 py-3 font-semibold">{d.amountLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.lastPaidAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.lastRemindedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => remind([d.memberId])}
                          disabled={reminding !== null || !d.hasEmail}
                          title={d.hasEmail ? "Send a reminder email" : "No email on file for this member"}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                        >
                          <Bell className="h-3 w-3" /> {reminding === d.memberId ? "Sending…" : "Remind"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {arrears && arrears.defaulters.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Everyone's paid up. 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
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

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  tone: "default" | "warn";
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tone === "warn" ? "text-amber-600" : "text-accent"}`} /> {label}
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
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
