import { createFileRoute } from "@tanstack/react-router";
import { dues, duesHistory } from "@/lib/mock-data";
import { Banknote, Calendar, Bell } from "lucide-react";

export const Route = createFileRoute("/admin/dues")({
  component: Dues,
});

function Dues() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Dues</h1>
        <p className="text-sm text-muted-foreground">Set recurring community dues. Reminders go out 3, 2 and 1 day before each payment.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-2">
          <h2 className="font-display text-lg font-semibold">Recurring dues setup</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Amount">
              <div className="flex">
                <select className="rounded-l-lg border border-r-0 border-border bg-secondary px-3 text-sm">
                  <option>NGN ₦</option>
                  <option>USD $</option>
                </select>
                <input defaultValue={dues.amount} type="number" className="w-full rounded-r-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring" />
              </div>
            </Field>
            <Field label="Frequency">
              <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option>Monthly</option>
                <option>Quarterly</option>
                <option>Bi-annually</option>
                <option>Yearly</option>
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" defaultValue={dues.startDate} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="h-3 w-3" /> Auto reminders enabled (3, 2, 1 days before)</p>
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Save dues setup</button>
          </div>
        </div>

        <div className="space-y-4">
          <Tile icon={Banknote} label="Current dues" value={`₦${dues.amount.toLocaleString()}`} sub={dues.frequency} />
          <Tile icon={Calendar} label="Next due date" value={dues.nextDue} sub="Reminders auto-sent" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-lg font-semibold">Payment history</h2>
          <span className="text-xs text-muted-foreground">{duesHistory.length} records</span>
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
              {duesHistory.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{d.member}</td>
                  <td className="px-4 py-3">₦{d.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.date}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      d.status === "Paid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}>{d.status}</span>
                  </td>
                </tr>
              ))}
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

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Banknote; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-4 w-4 text-accent" />
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
