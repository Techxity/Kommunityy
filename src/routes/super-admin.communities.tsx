import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MoreHorizontal, Plus, Filter } from "lucide-react";
import { communities } from "@/lib/platform-data";

export const Route = createFileRoute("/super-admin/communities")({
  head: () => ({ meta: [{ title: "Communities — Super Admin" }] }),
  component: Communities,
});

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-700",
  Trial: "bg-blue-500/10 text-blue-700",
  "Past Due": "bg-amber-500/10 text-amber-700",
  Suspended: "bg-rose-500/10 text-rose-700",
};

function Communities() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const filtered = communities.filter((c) => {
    const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase());
    const matchS = status === "All" || c.status === status;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Communities</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every workspace on Kinfolk, across {new Set(communities.map((c) => c.country)).size} countries.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Provision community
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full rounded-full border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", "Active", "Trial", "Past Due", "Suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Community</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Plan</th>
              <th className="px-5 py-3 text-right">Members</th>
              <th className="px-5 py-3 text-right">MRR</th>
              <th className="px-5 py-3 text-left">Country</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-5 py-3">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.id} · {c.owner}</p>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{c.type}</td>
                <td className="px-5 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.plan}</span></td>
                <td className="px-5 py-3 text-right tabular-nums">{c.members.toLocaleString()}</td>
                <td className="px-5 py-3 text-right tabular-nums">${c.mrr}</td>
                <td className="px-5 py-3 text-muted-foreground">{c.country}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[c.status] ?? "bg-muted"}`}>{c.status}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
