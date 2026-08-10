import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { platformAdmins } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/admins")({
  head: () => ({ meta: [{ title: "Platform Admins — Super Admin" }] }),
  component: Admins,
});

function Admins() {
  const [admins, setAdmins] = useState(platformAdmins);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Support Admin" });

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setAdmins([...admins, { id: `u${admins.length + 1}`, ...form, lastActive: "Pending invite" }]);
    setForm({ name: "", email: "", role: "Support Admin" });
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Platform admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage who has access to the Kommunity control center.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Invite admin
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["Super Admin", "Billing Admin", "Support Admin"] as const).map((r) => (
          <div key={r} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <Shield className="h-5 w-5 text-accent" />
            <p className="mt-3 font-display text-lg font-bold">{r}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r === "Super Admin" && "Full access to every community, plan, and billing record."}
              {r === "Billing Admin" && "Manage plans, invoices, and revenue. Read-only on communities."}
              {r === "Support Admin" && "Handle tickets and impersonate community admins for support."}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Last active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3 font-semibold">{a.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{a.email}</td>
                <td className="px-5 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{a.role}</span></td>
                <td className="px-5 py-3 text-muted-foreground">{a.lastActive}</td>
                <td className="px-5 py-3 text-right">
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={invite} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="font-display text-xl font-bold">Invite a platform admin</p>
            <p className="mt-1 text-sm text-muted-foreground">They will get an email to set their password.</p>
            <div className="mt-4 space-y-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option>Super Admin</option>
                <option>Billing Admin</option>
                <option>Support Admin</option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Send invite</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
