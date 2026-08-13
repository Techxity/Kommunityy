import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getFinancialReport, exportFinancialTransactions } from "@/lib/payments/reports.functions";
import { downloadCsv } from "@/lib/export-csv";
import { FileBarChart, Download, Banknote, Wallet, Receipt, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: Reports,
});

type Report = Awaited<ReturnType<typeof getFinancialReport>>;

function money(currency: "NGN" | "USD", amount: number): string {
  return `${currency === "NGN" ? "₦" : "$"}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => presetRange(preset), [preset]);

  useEffect(() => {
    setReport(undefined);
    getFinancialReport({ data: range }).then(setReport).catch(() => setReport(null));
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
      ) : report.summary.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No payments recorded in this period.</p>
        </div>
      ) : (
        <>
          {/* Summary per currency */}
          {report.summary.map((s) => (
            <div key={s.currency} className="space-y-3">
              <h2 className="font-display text-lg font-semibold">{s.currency} summary</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile icon={Banknote} label="Gross collected" value={money(s.currency, s.gross)} sub={`${s.count} payments`} />
                <Tile icon={Receipt} label="Platform fees" value={money(s.currency, s.fees)} sub="deducted" />
                <Tile icon={Wallet} label="Net to community" value={money(s.currency, s.net)} sub="after fees" strong />
                <Tile icon={Banknote} label="Dues / Donations" value={`${money(s.currency, s.duesGross)} / ${money(s.currency, s.donationsGross)}`} sub="gross split" />
              </div>
            </div>
          ))}

          {/* Monthly */}
          <Card title="Monthly breakdown">
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

          {/* Member contributions */}
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

          {/* All-time funds position */}
          {report.held.length > 0 && (
            <Card title="Funds position (all-time)" subtitle="Net collected to date, what's been paid out, and what's still held.">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Currency</th>
                    <th className="px-4 py-2.5 font-medium text-right">Net collected</th>
                    <th className="px-4 py-2.5 font-medium text-right">Paid out</th>
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
                      <td className="px-4 py-2.5 text-right">{money(h.currency, h.pending)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{money(h.currency, h.held)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
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
