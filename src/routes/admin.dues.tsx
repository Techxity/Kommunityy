import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getMyDuesPlan, saveDuesPlan, listDuesPayments, getDuesArrears, sendDuesReminders, getMyDuesInfo, getActiveDuesPlanId, recordDuesPayment, deleteRecordedDuesPayment } from "@/lib/payments/dues.functions";
import { listDuesRates, saveDuesRate, deleteDuesRate } from "@/lib/payments/dues-rates.functions";
import { getDashboardStats } from "@/lib/payments/communities.functions";
import { getMyMembershipHere, joinMyCommunityAsMember } from "@/lib/membership/members.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banknote, Calendar, Users, Settings, AlertTriangle, Bell, TrendingUp, UserPlus, CreditCard, Loader2, NotebookPen, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/dues")({
  beforeLoad: () => requireModule("Dues"),
  component: Dues,
});

type Plan = Awaited<ReturnType<typeof getMyDuesPlan>>;
type Payment = Awaited<ReturnType<typeof listDuesPayments>>[number];
type Arrears = Awaited<ReturnType<typeof getDuesArrears>>;
type DuesRate = Awaited<ReturnType<typeof listDuesRates>>[number];

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
  // Record payment dialog: null = closed, otherwise the member to start on.
  const [recordFor, setRecordFor] = useState<{ memberId: string } | null>(null);

  async function removeRecorded(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this recorded payment? The member will owe these periods again.")) return;
    try {
      await deleteRecordedDuesPayment({ data: { id } });
      refresh();
    } catch (err: any) {
      setRemindMsg(err?.message ?? "Couldn't delete the payment.");
    }
  }

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dues</h1>
          <p className="text-sm text-muted-foreground">
            Manage community dues and view payment history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {plan && (
          <Button onClick={() => setRecordFor({ memberId: "" })} className="gap-2">
            <NotebookPen className="h-4 w-4" />
            Record payment
          </Button>
        )}
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
        </div>
      </header>

      {recordFor && plan && (
        <RecordPaymentDialog
          members={arrears?.members ?? []}
          initialMemberId={recordFor.memberId}
          interval={plan.interval}
          onClose={() => setRecordFor(null)}
          onSaved={() => { setRecordFor(null); refresh(); }}
        />
      )}

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

      <MyDuesCard />

      {plan && <RatesCard interval={plan.interval} defaultLabel={currentDuesValue} onChanged={refresh} />}

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
                        <div className="text-xs text-muted-foreground">
                          {d.email || (d.phone ? d.phone : "No email on file")}
                          {d.rateName ? ` · ${d.rateName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">{d.periodsBehind} {plan.interval.replace("ly", "")}{d.periodsBehind === 1 ? "" : "s"}</td>
                      <td className="px-4 py-3 font-semibold">{d.amountLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.lastPaidAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.lastRemindedAt)}</td>
                      <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={() => setRecordFor({ memberId: d.memberId })}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          <NotebookPen className="h-3 w-3" /> Record
                        </button>
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
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.member}</div>
                    {d.note && <div className="text-xs text-muted-foreground">{d.note}</div>}
                  </td>
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
                    {d.recorded && <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">recorded</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.recorded && (
                      <button onClick={() => removeRecorded(d.id)} title="Delete recorded payment" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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

// Named prices members can be put on. The plan's amount stays the default for
// anyone without a rate or a custom amount.
function RatesCard({ interval, defaultLabel, onChanged }: { interval: string; defaultLabel: string; onChanged: () => void }) {
  const empty = { name: "", amountNgn: "", amountUsd: "" };
  const [rates, setRates] = useState<DuesRate[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => listDuesRates().then(setRates).catch(() => setRates([]));
  useEffect(() => {
    load();
  }, []);

  function cancelEdit() {
    setEditId(null);
    setForm(empty);
    setError("");
  }

  async function submit() {
    if (!form.name.trim()) return setError("Give the rate a name.");
    if (!form.amountNgn && !form.amountUsd) return setError("Set an amount in at least one currency.");
    setBusy(true);
    setError("");
    try {
      await saveDuesRate({
        data: {
          id: editId ?? undefined,
          name: form.name,
          amountNgn: form.amountNgn ? Number(form.amountNgn) : null,
          amountUsd: form.amountUsd ? Number(form.amountUsd) : null,
        },
      });
      cancelEdit();
      load();
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save the rate.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: DuesRate) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${r.name}"? ${r.memberCount} member${r.memberCount === 1 ? "" : "s"} will go back to the default amount.`)) return;
    try {
      await deleteDuesRate({ data: { id: r.id } });
      load();
      onChanged();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't delete the rate.");
    }
  }

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold">Rates</h2>
        <p className="text-xs text-muted-foreground">
          For communities where members pay different amounts, per {interval.replace("ly", "")}. Assign rates on the Members page. Anyone without one pays the default ({defaultLabel}).
        </p>
      </div>
      <div className="grid gap-2 border-b border-border p-4 md:grid-cols-12">
        <input aria-label="Rate name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name, e.g. 2-bed flat" className={`${inputClass} md:col-span-5`} />
        <input aria-label="Amount in naira" value={form.amountNgn} onChange={(e) => setForm((f) => ({ ...f, amountNgn: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" placeholder="Amount ₦" className={`${inputClass} md:col-span-3`} />
        <input aria-label="Amount in dollars" value={form.amountUsd} onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" placeholder="Amount $" className={`${inputClass} md:col-span-2`} />
        <div className="flex gap-2 md:col-span-2">
          <Button onClick={submit} disabled={busy} className="flex-1 gap-1">
            {editId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editId ? "Save" : "Add"}
          </Button>
          {editId && (
            <button onClick={cancelEdit} title="Cancel" className="inline-flex items-center justify-center rounded-lg border border-border px-2 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="px-4 pt-2 text-xs text-destructive">{error}</p>}
      {rates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Members</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className={`border-t border-border ${editId === r.id ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5">
                    {[r.amountNgn ? `₦${r.amountNgn.toLocaleString()}` : null, r.amountUsd ? `$${r.amountUsd.toLocaleString()}` : null].filter(Boolean).join(" / ")}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.memberCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <button
                        onClick={() => { setEditId(r.id); setForm({ name: r.name, amountNgn: r.amountNgn ? String(r.amountNgn) : "", amountUsd: r.amountUsd ? String(r.amountUsd) : "" }); setError(""); }}
                        title="Edit"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(r)} title="Delete" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Records a bank transfer or cash payment against a member. Arrears count whole
// periods, so the amount is what lands in the report and each period is treated
// as fully paid whatever was received.
function RecordPaymentDialog({
  members,
  initialMemberId,
  interval,
  onClose,
  onSaved,
}: {
  members: Arrears["members"];
  initialMemberId: string;
  interval: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initial = members.find((m) => m.memberId === initialMemberId);
  const initialPeriods = Math.min(12, Math.max(1, initial?.periodsBehind ?? 1));
  const [memberId, setMemberId] = useState(initialMemberId);
  const [periods, setPeriods] = useState(initialPeriods);
  const [amount, setAmount] = useState(initial ? String(initial.unitAmount * initialPeriods) : "");
  const [currency, setCurrency] = useState<"NGN" | "USD">(initial?.currency ?? "NGN");
  const [paidOn, setPaidOn] = useState(today);
  const [fromMonth, setFromMonth] = useState(today.slice(0, 7));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const unit = interval.replace("ly", "");
  const selected = members.find((m) => m.memberId === memberId);

  function pickMember(id: string) {
    setMemberId(id);
    const m = members.find((x) => x.memberId === id);
    if (!m) return;
    const p = Math.min(12, Math.max(1, m.periodsBehind));
    setPeriods(p);
    setCurrency(m.currency);
    setAmount(String(m.unitAmount * p));
  }

  function pickPeriods(p: number) {
    setPeriods(p);
    if (selected) setAmount(String(selected.unitAmount * p));
  }

  async function submit() {
    if (!memberId) return setError("Choose a member.");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter the amount received.");
    setBusy(true);
    setError("");
    try {
      await recordDuesPayment({
        data: { memberId, periods, amount: amt, currency, paidOn, periodStart: `${fromMonth}-01`, note: note.trim() || null },
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't record the payment.");
      setBusy(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Record a payment</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          For money paid straight into your bank account or in cash. The member is marked as paid and the amount goes into your financial report.
        </p>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Member">
              <select value={memberId} onChange={(e) => pickMember(e.target.value)} className={inputClass}>
                <option value="">Choose a member…</option>
                {members.map((m) => (<option key={m.memberId} value={m.memberId}>{m.name}</option>))}
              </select>
            </Field>
          </div>
          <Field label={`Number of ${unit}s`}>
            <select value={periods} onChange={(e) => pickPeriods(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </Field>
          <Field label="Starting from">
            <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Amount received">
            <div className="flex gap-2">
              <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
                <option value="NGN">₦</option>
                <option value="USD">$</option>
              </select>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputClass} />
            </div>
          </Field>
          <Field label="Date received">
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Note (optional)">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. GTBank transfer, ref 12345" className={inputClass} />
            </Field>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Each {unit} chosen counts as fully paid, even if the amount received is less.</p>
        {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex items-center justify-end">
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Record payment"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MyDuesCard() {
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [dues, setDues] = useState<Awaited<ReturnType<typeof getMyDuesInfo>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    getMyMembershipHere().then((s) => setIsMember(s.isMember)).catch(() => setIsMember(false));
    getMyDuesInfo().then(setDues).catch(() => {});
  }
  useEffect(load, []);

  async function join() {
    setBusy(true);
    setMsg("");
    try {
      await joinMyCommunityAsMember();
      load();
    } catch (e: any) {
      setMsg(e?.message ?? "Couldn't add you as a member.");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setMsg("");
    try {
      const planId = await getActiveDuesPlanId();
      if (planId) navigate({ to: "/pay-dues/$planId", params: { planId }, search: dues?.payToken ? { m: dues.payToken } : {} });
      else setMsg("No active dues plan to pay yet.");
    } catch (e: any) {
      setMsg(e?.message ?? "Couldn't start payment.");
    } finally {
      setBusy(false);
    }
  }

  if (isMember === null) return null;

  const amountLabel = dues?.plan
    ? [dues.plan.amountNgn ? `₦${dues.plan.amountNgn.toLocaleString()}` : null, dues.plan.amountUsd ? `$${dues.plan.amountUsd.toLocaleString()}` : null]
        .filter(Boolean)
        .join(" / ")
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">My dues</h2>
          <p className="text-xs text-muted-foreground">Pay your own dues to this community — not just set them up for others.</p>
        </div>
        {isMember ? (
          <div className="flex flex-wrap items-center gap-3">
            {amountLabel && (
              <span className="text-sm">
                <span className="font-semibold">{amountLabel}</span>{" "}
                <span className="text-muted-foreground">{dues?.plan ? `· ${dues.plan.interval}` : ""}</span>
              </span>
            )}
            <Button onClick={pay} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay my dues
            </Button>
          </div>
        ) : (
          <Button onClick={join} disabled={busy} variant="outline" className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add me as a member
          </Button>
        )}
      </div>
      {!isMember && (
        <p className="mt-2 text-xs text-muted-foreground">You've set up dues but aren't a member yet. Add yourself to pay your own dues and appear in the members list.</p>
      )}
      {isMember && dues?.coverage?.nextDue && (
        <p className="mt-2 text-xs text-muted-foreground">You're paid through — next due from {dues.coverage.nextDue}.</p>
      )}
      {msg && <p className="mt-2 text-xs text-destructive">{msg}</p>}
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
