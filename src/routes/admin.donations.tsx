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
  target_ngn: string;
  target_usd: string;
  deadline: string;
}

interface Payer {
  member: string;
  amount: number;
  currency: "NGN" | "USD";
  date: string;
}

interface Donation {
  id: string;
  purpose: string;
  target_ngn: number;
  target_usd: number;
  collected_ngn: number;
  collected_usd: number;
  deadline: string;
  status: string;
  payers?: Payer[];
}

const fmt = (amount: number, currency: "NGN" | "USD") =>
  currency === "NGN"
    ? `₦${amount.toLocaleString()}`
    : `$${amount.toLocaleString()}`;

// Community-level accepted currencies (would come from communities table).
const ACCEPT_NGN = true;
const ACCEPT_USD = true;

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
          <div className="md:col-span-2">
            <Field label="Purpose">
              <input
                className="input"
                placeholder="e.g. Borehole Repair Fund"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </Field>
          </div>
          {ACCEPT_NGN && (
            <Field label="Target (₦ NGN)">
              <input
                className="input"
                type="number"
                placeholder="500000"
                value={form.target_ngn}
                onChange={(e) => setForm((f) => ({ ...f, target_ngn: e.target.value }))}
              />
            </Field>
          )}
          {ACCEPT_USD && (
            <Field label="Target ($ USD)">
              <input
                className="input"
                type="number"
                placeholder="1000"
                value={form.target_usd}
                onChange={(e) => setForm((f) => ({ ...f, target_usd: e.target.value }))}
              />
            </Field>
          )}
          <div className="md:col-span-2">
            <Field label="Closing date">
              <input
                className="input"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Leave a currency blank to not accept donations in it. Members choose ₦ or $ when they pay.
        </p>
        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => {
              if (!form.purpose || !form.deadline) return;
              if (!form.target_ngn && !form.target_usd) return;
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
    seedDonations.map((d) => ({
      id: d.id,
      purpose: d.purpose,
      target_ngn: d.target,
      target_usd: 0,
      collected_ngn: d.collected,
      collected_usd: 0,
      deadline: d.deadline,
      status: d.status,
      payers: [],
    })),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DonationFormData>({
    purpose: "",
    target_ngn: "",
    target_usd: "",
    deadline: "",
  });
  const [payersFor, setPayersFor] = useState<Donation | null>(null);

  const emptyForm: DonationFormData = {
    purpose: "",
    target_ngn: "",
    target_usd: "",
    deadline: "",
  };

  const handleEdit = (d: Donation) => {
    setEditingId(d.id);
    setEditForm({
      purpose: d.purpose,
      target_ngn: d.target_ngn ? String(d.target_ngn) : "",
      target_usd: d.target_usd ? String(d.target_usd) : "",
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
        target_ngn: Number(data.target_ngn) || 0,
        target_usd: Number(data.target_usd) || 0,
        collected_ngn: 0,
        collected_usd: 0,
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
              target_ngn: Number(data.target_ngn) || 0,
              target_usd: Number(data.target_usd) || 0,
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
            Run goal-based fundraisers. Members pick ₦ or $ at checkout.
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
          const pctNgn =
            d.target_ngn > 0
              ? Math.min(100, Math.round((d.collected_ngn / d.target_ngn) * 100))
              : 0;
          const pctUsd =
            d.target_usd > 0
              ? Math.min(100, Math.round((d.collected_usd / d.target_usd) * 100))
              : 0;
          return (
            <div
              key={d.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {d.status}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold">{d.purpose}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Closes {d.deadline}</p>
                </div>
                <HeartHandshake className="h-5 w-5 text-accent" />
              </div>

              <div className="mt-5 space-y-3">
                {d.target_ngn > 0 && (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold">
                        ₦{d.collected_ngn.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / ₦{d.target_ngn.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-accent"
                        style={{ width: `${pctNgn}%` }}
                      />
                    </div>
                  </div>
                )}
                {d.target_usd > 0 && (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold">
                        ${d.collected_usd.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        / ${d.target_usd.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-accent"
                        style={{ width: `${pctUsd}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

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
                      {fmt(p.amount, p.currency)}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
                  <div className="text-sm font-semibold">Totals</div>
                  <div className="font-display text-sm font-bold space-x-3">
                    {(() => {
                      const ngn = payersFor.payers
                        .filter((p) => p.currency === "NGN")
                        .reduce((s, p) => s + p.amount, 0);
                      const usd = payersFor.payers
                        .filter((p) => p.currency === "USD")
                        .reduce((s, p) => s + p.amount, 0);
                      return (
                        <>
                          {ngn > 0 && <span>₦{ngn.toLocaleString()}</span>}
                          {usd > 0 && <span>${usd.toLocaleString()}</span>}
                        </>
                      );
                    })()}
                  </div>
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
