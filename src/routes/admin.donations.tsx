import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { donations } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<DonationFormData>({
    purpose: "",
    target: "",
    deadline: "",
  });

  const handleEdit = (d: (typeof donations)[0]) => {
    setEditForm({
      purpose: d.purpose,
      target: String(d.target),
      deadline: d.deadline,
    });
    setEditOpen(true);
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-soft">
              <Plus className="h-4 w-4" /> New donation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Create donation</DialogTitle>
            </DialogHeader>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <Field label="Purpose">
                <input className="input" placeholder="e.g. Borehole Repair Fund" />
              </Field>
              <Field label="Target amount">
                <input className="input" type="number" placeholder="500000" />
              </Field>
              <Field label="Closing date">
                <input className="input" type="date" />
              </Field>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setCreateOpen(false)}>Start collection</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {donations.map((d) => {
          const pct = Math.min(100, Math.round((d.collected / d.target) * 100));
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
                  <button className="flex-1 rounded-full bg-secondary py-2 text-xs font-semibold">
                    End donation
                  </button>
                ) : (
                  <span className="flex-1 rounded-full bg-muted py-2 text-center text-xs font-semibold text-muted-foreground">
                    Closed
                  </span>
                )}
                <button className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground">
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
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit donation"
        initial={editForm}
        onSave={(data) => {
          console.log("Save edit", data);
        }}
      />

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
