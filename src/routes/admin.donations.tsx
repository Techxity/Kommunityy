import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { donations as seedDonations } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/donations")({
  component: Donations,
});

interface DonationFormData {
  purpose: string;
  target: string;
  deadline: string;
}

interface Donation {
  id: string;
  purpose: string;
  target: number;
  collected: number;
  currency: string;
  deadline: string;
  status: string;
  payers?: { member: string; amount: number; date: string }[];
}

const samplePayers = [
  { member: "Adaeze Okafor", amount: 50000, date: "2025-05-12" },
  { member: "Tunde Bakare", amount: 25000, date: "2025-05-10" },
  { member: "Chiamaka Eze", amount: 100000, date: "2025-05-08" },
  { member: "Kola Salami", amount: 15000, date: "2025-05-05" },
];

function DonationModal({
  open,
  onOpenChange,
  title,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial: DonationFormData;
  onSave: (data: DonationFormData) => void;
}) {
  const [form, setForm] = useState(initial);

  // re-sync when modal opens with new initial values
  const [lastInitial, setLastInitial] = useState(initial);
  if (open && lastInitial !== initial) {
    setLastInitial(initial);
    setForm(initial);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <Field label="Purpose">
            <input
              className="input"
              placeholder="e.g. Borehole Repair Fund"
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            />
          </Field>
          <Field label="Target amount">
            <input
              className="input"
              type="number"
              placeholder="500000"
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
            />
          </Field>
          <Field label="Closing date">
            <input
              className="input"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => {
              if (!form.purpose || !form.target || !form.deadline) return;
              onSave(form);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Donations() {
  const [list, setList] = useState<Donation[]>(
    seedDonations.map((d) => ({ ...d, payers: samplePayers })),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DonationFormData>({
    purpose: "",
    target: "",
    deadline: "",
  });
  const [payersFor, setPayersFor] = useState<Donation | null>(null);

  const emptyForm: DonationFormData = { purpose: "", target: "", deadline: "" };

  const handleEdit = (d: Donation) => {
    setEditingId(d.id);
    setEditForm({
      purpose: d.purpose,
      target: String(d.target),
      deadline: d.deadline,
    });
    setEditOpen(true);
  };

  const handleEndDonation = (id: string) => {
    setList((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "Closed" } : d)),
    );
  };

  const handleCreate = (data: DonationFormData) => {
    setList((prev) => [
      ...prev,
      {
        id: `d${Date.now()}`,
        purpose: data.purpose,
        target: Number(data.target) || 0,
        collected: 0,
        currency: "NGN",
        deadline: data.deadline,
        status: "Active",
        payers: [],
      },
    ]);
  };

  const handleSaveEdit = (data: DonationFormData) => {
    if (!editingId) return;
    setList((prev) =>
      prev.map((d) =>
        d.id === editingId
          ? {
              ...d,
              purpose: data.purpose,
              target: Number(data.target) || 0,
              deadline: data.deadline,
            }
          : d,
      ),
    );
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Donations</h1>
          <p className="text-sm text-muted-foreground">
            Run goal-based fundraisers. Members are notified at start, during, and at close.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-soft"
        >
          <Plus className="h-4 w-4" /> New donation
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((d) => {
          const pct = d.target > 0 ? Math.min(100, Math.round((d.collected / d.target) * 100)) : 0;
          return (
            <div key={d.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{d.status}</p>
                  <h3 className="mt-1 font-display text-xl font-bold">{d.purpose}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Closes {d.deadline}</p>
                </div>
                <HeartHandshake className="h-5 w-5 text-accent" />
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">
                  ₦{d.collected.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  / ₦{d.target.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-accent" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-success">{pct}% raised</p>
              <div className="mt-5 flex gap-2">
                {d.status === "Active" ? (
                  <button
                    onClick={() => handleEndDonation(d.id)}
                    className="flex-1 rounded-full bg-secondary py-2 text-xs font-semibold"
                  >
                    End donation
                  </button>
                ) : (
                  <span className="flex-1 rounded-full bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
                    Closed
                  </span>
                )}
                <button
                  onClick={() => setPayersFor(d)}
                  className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground"
                >
                  View payers
                </button>
                <button
                  onClick={() => handleEdit(d)}
                  className="rounded-full bg-secondary p-2 text-xs font-semibold"
                  title="Edit donation"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DonationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create donation"
        initial={emptyForm}
        onSave={handleCreate}
      />

      <DonationModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit donation"
        initial={editForm}
        onSave={handleSaveEdit}
      />

      <Dialog open={!!payersFor} onOpenChange={(v) => !v && setPayersFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Payers — {payersFor?.purpose}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {payersFor && payersFor.payers && payersFor.payers.length > 0 ? (
              <div className="divide-y divide-border rounded-xl border border-border">
                {payersFor.payers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{p.member}</p>
                      <p className="text-xs text-muted-foreground">{p.date}</p>
                    </div>
                    <p className="font-display text-sm font-bold">
                      ₦{p.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
                  <p className="text-sm font-semibold">Total</p>
                  <p className="font-display text-sm font-bold">
                    ₦
                    {payersFor.payers
                      .reduce((s, p) => s + p.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No payments yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
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
