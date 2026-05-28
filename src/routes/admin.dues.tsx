import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { dues, duesHistory } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Banknote, Calendar, Bell, Settings } from "lucide-react";

export const Route = createFileRoute("/admin/dues")({
  component: Dues,
});

function Dues() {
  const [open, setOpen] = useState(false);

  const totalCollected = duesHistory
    .filter((d) => d.status === "Paid")
    .reduce((sum, d) => sum + d.amount, 0);

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
              <Field label="Amount">
                <div className="flex">
                  <select className="rounded-l-lg border border-r-0 border-border bg-secondary px-3 text-sm">
                    <option>NGN ₦</option>
                    <option>USD $</option>
                  </select>
                  <input
                    defaultValue={dues.amount}
                    type="number"
                    className="w-full rounded-r-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
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
                <input
                  type="date"
                  defaultValue={dues.startDate}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Bell className="h-3 w-3" /> Auto reminders (3, 2, 1 days before)
              </p>
              <Button onClick={() => setOpen(false)}>Save dues setup</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6 md:grid-cols-4">
        <Tile
          icon={Banknote}
          label="Current dues"
          value={`₦${dues.amount.toLocaleString()}`}
          sub={`${dues.frequency} • Next: ${dues.nextDue}`}
        />
        <Tile
          icon={Calendar}
          label="Total collected"
          value={`₦${totalCollected.toLocaleString()}`}
          sub="till date"
        />
        <Tile
          icon={Banknote}
          label="Active members"
          value={`${duesHistory.length}`}
          sub="on dues roster"
        />
        <Tile
          icon={Calendar}
          label="Overdue"
          value={`${duesHistory.filter((d) => d.status === "Missed").length}`}
          sub="members"
        />
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        d.status === "Paid"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {d.status}
                    </span>
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
