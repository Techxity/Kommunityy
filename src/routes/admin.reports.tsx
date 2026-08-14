import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getFinancialReport,
  exportFinancialTransactions,
  listExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  uploadExpenseReceipt,
  getExpenseReceipt,
  removeExpenseReceipt,
  setExpensePolicy,
  EXPENSE_CATEGORY_LIST,
} from "@/lib/payments/reports.functions";
import { downloadCsv } from "@/lib/export-csv";
import { FileBarChart, Download, Banknote, Wallet, Receipt, Printer, Plus, Trash2, Scale, Pencil, Paperclip, Eye, X, Check } from "lucide-react";

// Reliable base64 → new-tab open (works for images and PDF).
function openBase64(mime: string, b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/admin/reports")({
  component: Reports,
});

type Report = Awaited<ReturnType<typeof getFinancialReport>>;
type Expense = Awaited<ReturnType<typeof listExpenses>>[number];

function money(currency: "NGN" | "USD", amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency === "NGN" ? "₦" : "$"}${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

// Range presets → {from, to} as YYYY-MM-DD (or null for open-ended).
function presetRange(preset: string): { from: string | null; to: string | null } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "month": return { from: iso(new Date(Date.UTC(y, now.getUTCMonth(), 1))), to: null };
    case "year": return { from: `${y}-01-01`, to: null };
    case "last12": { const d = new Date(Date.UTC(y, now.getUTCMonth() - 11, 1)); return { from: iso(d), to: null }; }
    default: return { from: null, to: null }; // all time
  }
}

const PRESETS = [
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "last12", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

function Reports() {
  const [preset, setPreset] = useState("year");
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => presetRange(preset), [preset]);

  function load() {
    getFinancialReport({ data: range }).then(setReport).catch(() => setReport(null));
    listExpenses({ data: range }).then(setExpenses).catch(() => setExpenses([]));
  }

  useEffect(() => {
    setReport(undefined);
    load();
  }, [range.from, range.to]);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await exportFinancialTransactions({ data: range });
      downloadCsv(
        `financial-transactions-${preset}`,
        ["Date", "Type", "Name", "Email", "Currency", "Gross", "Platform fee", "Net", "Reference"],
        rows.map((r) => [r.date, r.type, r.name, r.email, r.currency, r.gross, r.fee, r.net, r.reference]),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 print:block">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-accent text-primary-foreground print:hidden">
            <FileBarChart className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Financial report</h1>
            <p className="text-sm text-muted-foreground">What your community collected, net of platform fees — ready for your records or an AGM.</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={exportCsv} disabled={exporting} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            <Download className="h-4 w-4" /> {exporting ? "Preparing…" : "Export CSV"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${preset === p.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {report === undefined ? (
        <div className="min-h-[30vh]" />
      ) : !report ? (
        <p className="text-sm text-muted-foreground">You don't manage a community yet.</p>
      ) : (
        <>
          {/* Income vs expenses — net position (surplus/deficit) */}
          {report.netPosition.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Income vs expenses</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {report.netPosition.map((np) => (
                  <NetCard key={np.currency} np={np} />
                ))}
              </div>
            </div>
          )}

          {/* Income summary per currency */}
          {report.summary.map((s) => (
            <div key={s.currency} className="space-y-3">
              <h2 className="font-display text-lg font-semibold">{s.currency} income</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile icon={Banknote} label="Gross collected" value={money(s.currency, s.gross)} sub={`${s.count} payments`} />
                <Tile icon={Receipt} label="Platform fees" value={money(s.currency, s.fees)} sub="deducted" />
                <Tile icon={Wallet} label="Net to community" value={money(s.currency, s.net)} sub="after fees" strong />
                <Tile icon={Banknote} label="Dues / Donations" value={`${money(s.currency, s.duesGross)} / ${money(s.currency, s.donationsGross)}`} sub="gross split" />
              </div>
            </div>
          ))}

          {/* Expenses management + breakdown */}
          <ExpensesSection expenses={expenses} report={report} onChanged={load} />

          {report.monthly.length > 0 && (
          <Card title="Monthly income breakdown">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Month</th>
                  <th className="px-4 py-2.5 font-medium">Currency</th>
                  <th className="px-4 py-2.5 font-medium text-right">Dues</th>
                  <th className="px-4 py-2.5 font-medium text-right">Donations</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">{monthLabel(m.month)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.currency}</td>
                    <td className="px-4 py-2.5 text-right">{money(m.currency, m.dues)}</td>
                    <td className="px-4 py-2.5 text-right">{money(m.currency, m.donations)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{money(m.currency, m.dues + m.donations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          )}

          {report.members.length > 0 && (
          <Card title="Dues contributions by member" subtitle="Who paid, and how much, in this period.">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium text-right">Periods</th>
                  <th className="px-4 py-2.5 font-medium text-right">Payments</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total paid</th>
                  <th className="px-4 py-2.5 font-medium">Last payment</th>
                </tr>
              </thead>
              <tbody>
                {report.members.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{m.name}</div>
                      {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{m.periods}</td>
                    <td className="px-4 py-2.5 text-right">{m.payments}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{money(m.currency, m.total)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.lastPaid}</td>
                  </tr>
                ))}
                {report.members.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No dues payments in this period.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
          )}

          {/* All-time funds position */}
          {report.held.length > 0 && (
            <Card
              title="Funds position (all-time)"
              subtitle={report.expensePolicy.reduceHeld
                ? "Net collected minus paid out and all recorded expenses = currently held."
                : "Net collected to date, what's been paid out, and what's still held. (Expenses are shown but not deducted — toggle that on above.)"}
            >
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Currency</th>
                    <th className="px-4 py-2.5 font-medium text-right">Net collected</th>
                    <th className="px-4 py-2.5 font-medium text-right">Paid out</th>
                    <th className="px-4 py-2.5 font-medium text-right">Expenses</th>
                    <th className="px-4 py-2.5 font-medium text-right">Pending payout</th>
                    <th className="px-4 py-2.5 font-medium text-right">Currently held</th>
                  </tr>
                </thead>
                <tbody>
                  {report.held.map((h, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium">{h.currency}</td>
                      <td className="px-4 py-2.5 text-right">{money(h.currency, h.net)}</td>
                      <td className="px-4 py-2.5 text-right">{money(h.currency, h.paidOut)}</td>
                      <td className={`px-4 py-2.5 text-right ${report.expensePolicy.reduceHeld ? "text-destructive" : "text-muted-foreground"}`}>{money(h.currency, h.expenses)}</td>
                      <td className="px-4 py-2.5 text-right">{money(h.currency, h.pending)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{money(h.currency, h.held)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {report.summary.length === 0 && expenses.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No income or expenses recorded in this period yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NetCard({ np }: { np: { currency: "NGN" | "USD"; incomeNet: number; expenses: number; net: number } }) {
  const surplus = np.net >= 0;
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${surplus ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Scale className={`h-3.5 w-3.5 ${surplus ? "text-emerald-600" : "text-destructive"}`} /> {np.currency} · {surplus ? "Surplus" : "Deficit"}
      </div>
      <p className={`mt-1.5 font-display text-2xl font-bold ${surplus ? "text-emerald-700" : "text-destructive"}`}>{money(np.currency, np.net)}</p>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Income (net): <span className="font-medium text-foreground">{money(np.currency, np.incomeNet)}</span></span>
        <span>Expenses: <span className="font-medium text-foreground">{money(np.currency, np.expenses)}</span></span>
      </div>
    </div>
  );
}

function ExpensesSection({ expenses, report, onChanged }: { expenses: Expense[]; report: NonNullable<Report>; onChanged: () => void }) {
  const empty = { amount: "", currency: "NGN" as "NGN" | "USD", category: "General", description: "", spentAt: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [policyBusy, setPolicyBusy] = useState(false);

  function startEdit(e: Expense) {
    setEditId(e.id);
    setForm({ amount: String(e.amount), currency: e.currency, category: e.category, description: e.description, spentAt: e.spentAt });
    setError("");
    if (typeof window !== "undefined") window.scrollTo({ top: window.scrollY });
  }
  function cancelEdit() {
    setEditId(null);
    setForm(empty);
    setError("");
  }

  async function submit() {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    setBusy(true);
    setError("");
    try {
      const payload = { amount: amt, currency: form.currency, category: form.category, description: form.description.trim() || undefined, spentAt: form.spentAt };
      if (editId) await updateExpense({ data: { id: editId, ...payload } });
      else await addExpense({ data: payload });
      cancelEdit();
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save expense.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePolicy(next: boolean) {
    setPolicyBusy(true);
    try {
      await setExpensePolicy({ data: { reduceHeld: next } });
      onChanged();
    } finally {
      setPolicyBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Expenses</h2>
          <p className="text-xs text-muted-foreground">Record what the community spent — with optional evidence — so it sits beside income for this period.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            role="switch"
            aria-checked={report.expensePolicy.reduceHeld}
            disabled={policyBusy}
            onClick={() => togglePolicy(!report.expensePolicy.reduceHeld)}
            className={`relative h-5 w-9 rounded-full transition ${report.expensePolicy.reduceHeld ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${report.expensePolicy.reduceHeld ? "left-[1.125rem]" : "left-0.5"}`} />
          </button>
          Deduct expenses from funds position
        </label>
      </div>

      {/* Add / edit form */}
      <div className="grid gap-2 border-b border-border p-4 md:grid-cols-12">
        <input type="date" value={form.spentAt} onChange={(e) => setForm((f) => ({ ...f, spentAt: e.target.value }))} className="rp-in md:col-span-2" />
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="rp-in md:col-span-2">
          {EXPENSE_CATEGORY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="rp-in md:col-span-3" />
        <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as "NGN" | "USD" }))} className="rp-in md:col-span-1">
          <option value="NGN">₦</option>
          <option value="USD">$</option>
        </select>
        <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" placeholder="Amount" className="rp-in md:col-span-2" />
        <div className="flex gap-2 md:col-span-2">
          <button onClick={submit} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {editId ? <><Check className="h-4 w-4" /> Save</> : <Plus className="h-4 w-4" />}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="inline-flex items-center justify-center rounded-lg border border-border px-2 text-muted-foreground hover:bg-muted" title="Cancel">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {error && <p className="px-4 pt-2 text-xs text-destructive">{error}</p>}

      {/* List */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium">Evidence</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <ExpenseRow key={e.id} e={e} editing={editId === e.id} onEdit={() => startEdit(e)} onChanged={onChanged} />
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No expenses recorded for this period. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <style>{`.rp-in{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.6rem;font-size:0.875rem;outline:none}.rp-in:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

function ExpenseRow({ e, editing, onEdit, onChanged }: { e: Expense; editing: boolean; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 3.3 * 1024 * 1024) return alert("File too large (max ~3MB).");
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) return alert("Please use a PNG, JPG, WebP, or PDF.");
    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadExpenseReceipt({ data: { id: e.id, name: file.name, mime: file.type as any, dataBase64 } });
      onChanged();
    } catch {
      alert("Upload failed. Try a smaller file.");
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    const r = await getExpenseReceipt({ data: { id: e.id } });
    if (r) openBase64(r.mime, r.dataBase64);
  }

  return (
    <tr className={`border-t border-border ${editing ? "bg-primary/5" : ""}`}>
      <td className="px-4 py-2.5 text-muted-foreground">{e.spentAt}</td>
      <td className="px-4 py-2.5">{e.category}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{e.description || "—"}</td>
      <td className="px-4 py-2.5">
        {e.hasReceipt ? (
          <span className="inline-flex items-center gap-2">
            <button onClick={view} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Eye className="h-3.5 w-3.5" /> View</button>
            <button onClick={() => removeExpenseReceipt({ data: { id: e.id } }).then(onChanged)} title="Remove evidence" className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Attach"}
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(ev) => onFile(ev.target.files?.[0])} />
          </label>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold">{money(e.currency, e.amount)}</td>
      <td className="px-4 py-2.5 text-right">
        <span className="inline-flex items-center gap-2">
          <button onClick={onEdit} title="Edit" className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => deleteExpense({ data: { id: e.id } }).then(onChanged)} title="Delete" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </span>
      </td>
    </tr>
  );
}

function Tile({ icon: Icon, label, value, sub, strong }: { icon: typeof Banknote; label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${strong ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
      <Icon className="h-4 w-4 text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
