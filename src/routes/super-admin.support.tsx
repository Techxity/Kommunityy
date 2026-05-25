import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { supportTickets } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/support")({
  head: () => ({ meta: [{ title: "Support — Super Admin" }] }),
  component: Support,
});

const priorityStyles: Record<string, string> = {
  High: "bg-rose-500/10 text-rose-700",
  Medium: "bg-amber-500/10 text-amber-700",
  Low: "bg-sky-500/10 text-sky-700",
};
const statusStyles: Record<string, string> = {
  Open: "bg-rose-500/10 text-rose-700",
  "In Progress": "bg-amber-500/10 text-amber-700",
  Resolved: "bg-emerald-500/10 text-emerald-700",
};

function Support() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Support inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tickets raised by community admins.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Open" value={supportTickets.filter((t) => t.status === "Open").length} />
        <Card label="In progress" value={supportTickets.filter((t) => t.status === "In Progress").length} />
        <Card label="Resolved (7d)" value={supportTickets.filter((t) => t.status === "Resolved").length} />
      </div>

      <div className="space-y-3">
        {supportTickets.map((t) => (
          <div key={t.id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent"><LifeBuoy className="h-4 w-4" /></span>
              <div>
                <p className="font-display text-base font-bold">{t.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.community} · {t.id} · opened {t.opened}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityStyles[t.priority]}`}>{t.priority}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[t.status]}`}>{t.status}</span>
              <button className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">Open</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
