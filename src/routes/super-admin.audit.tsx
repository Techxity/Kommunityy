import { createFileRoute } from "@tanstack/react-router";
import { auditLog } from "@/lib/platform-data";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/super-admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Super Admin" }] }),
  component: Audit,
});

function Audit() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">A tamper-evident record of every action across the platform.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <ul className="divide-y divide-border">
          {auditLog.map((a) => (
            <li key={a.id} className="flex items-start gap-4 px-5 py-4">
              <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><ScrollText className="h-4 w-4" /></span>
              <div className="flex-1">
                <p className="text-sm"><span className="font-semibold">{a.actor}</span> {a.action.toLowerCase()} <span className="font-semibold">{a.target}</span></p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.time} · entry {a.id}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
