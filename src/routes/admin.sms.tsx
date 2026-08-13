import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSmsOverview, saveSmsSettings, startSmsTopup, verifySmsTopup } from "@/lib/sms/sms.functions";
import { MessageSquare, Wallet, Save, Loader2, Send, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/sms")({
  component: SmsPage,
});

type Overview = Awaited<ReturnType<typeof getSmsOverview>>;

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const TOPUP_PRESETS = [1000, 2000, 5000, 10000];

function SmsPage() {
  const [ov, setOv] = useState<Overview | null | undefined>(undefined);
  const [verifying, setVerifying] = useState(false);

  function refresh() {
    getSmsOverview().then(setOv);
  }

  useEffect(() => {
    // Returning from a Paystack top-up? Confirm it, then clean the URL.
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");
    if (ref) {
      setVerifying(true);
      verifySmsTopup({ data: { reference: ref } })
        .catch(() => {})
        .finally(() => {
          window.history.replaceState({}, "", "/admin/sms");
          setVerifying(false);
          refresh();
        });
    } else {
      refresh();
    }
  }, []);

  if (ov === undefined) return <div className="min-h-[40vh]" />;
  if (!ov) return <p className="text-sm text-muted-foreground">You don't manage a community yet.</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-accent text-primary-foreground">
          <MessageSquare className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">SMS</h1>
          <p className="text-sm text-muted-foreground">
            Reach members by text for birthdays, dues reminders and broadcasts. Prepaid and separate from your dues, donations and subscription.
          </p>
        </div>
      </header>

      {verifying && (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Confirming your top-up…
        </p>
      )}

      <WalletCard ov={ov} onChanged={refresh} />
      <SettingsCard ov={ov} onSaved={refresh} />
      <StatementCard ov={ov} />
    </div>
  );
}

function WalletCard({ ov, onChanged }: { ov: NonNullable<Overview>; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const low = ov.balanceKobo <= ov.settings.lowBalanceKobo;

  async function topUp() {
    const ngn = Number(amount);
    if (!ngn || ngn < 100) return setError("Enter at least ₦100.");
    setBusy(true);
    setError("");
    try {
      const { authorization_url } = await startSmsTopup({ data: { amountNgn: Math.round(ngn) } });
      window.location.href = authorization_url;
    } catch (err: any) {
      setError(err?.message ?? "Couldn't start the top-up.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className={`rounded-2xl border p-6 shadow-soft ${low ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 text-accent" /> SMS balance
        </div>
        <p className="mt-2 font-display text-3xl font-bold">{naira(ov.balanceKobo)}</p>
        {low && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Low balance — top up to keep sending.
          </p>
        )}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>Spent this month: <strong className="text-foreground">{naira(ov.spentMonthKobo)}</strong></span>
          <span>Sent: <strong className="text-foreground">{ov.sentMonth}</strong></span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-2">
        <p className="text-sm font-semibold">Top up wallet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You're credited the full amount — the card processing fee is added at checkout so your balance gets every naira.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPUP_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                amount === String(p) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
              }`}
            >
              ₦{p.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Custom amount"
              className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            onClick={topUp}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? "Redirecting…" : "Top up"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function SettingsCard({ ov, onSaved }: { ov: NonNullable<Overview>; onSaved: () => void }) {
  const s = ov.settings;
  const [enabled, setEnabled] = useState(s.enabled);
  const [senderId, setSenderId] = useState(s.senderId ?? "");
  const [route, setRoute] = useState<"dnd" | "generic">(s.route);
  const [chBirthdays, setChBirthdays] = useState(s.chBirthdays);
  const [chReminders, setChReminders] = useState(s.chReminders);
  const [chBroadcasts, setChBroadcasts] = useState(s.chBroadcasts);
  const [lowNgn, setLowNgn] = useState(String(Math.round(s.lowBalanceKobo / 100)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await saveSmsSettings({
        data: {
          enabled,
          senderId: senderId.trim() || null,
          route,
          chBirthdays,
          chReminders,
          chBroadcasts,
          lowBalanceNgn: Number(lowNgn) || 0,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">SMS settings</h2>
          <p className="text-xs text-muted-foreground">You control whether SMS is on and what it's used for.</p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} label="Enable SMS" />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Sender ID" hint="3–11 letters/numbers, approved by Termii (e.g. your community's short name).">
          <input
            value={senderId}
            onChange={(e) => setSenderId(e.target.value.slice(0, 11))}
            placeholder="e.g. IrewoleEst"
            className="input"
          />
        </Field>
        <Field label="Route" hint="DND reaches members on the Do-Not-Disturb list (recommended). Generic is promotional only.">
          <select value={route} onChange={(e) => setRoute(e.target.value as "dnd" | "generic")} className="input">
            <option value="dnd">DND (transactional — reaches everyone)</option>
            <option value="generic">Generic (promotional)</option>
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Use SMS for</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <CheckRow checked={chBirthdays} onChange={setChBirthdays} label="Birthday wishes" />
          <CheckRow checked={chReminders} onChange={setChReminders} label="Dues reminders" />
          <CheckRow checked={chBroadcasts} onChange={setChBroadcasts} label="Broadcasts" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Email still sends regardless — SMS is an added channel.</p>
      </div>

      <div className="mt-5 max-w-xs">
        <Field label="Low-balance alert (₦)" hint="We'll warn you when the balance drops below this.">
          <input value={lowNgn} onChange={(e) => setLowNgn(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="input" />
        </Field>
      </div>

      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Saved.</p>}

      <div className="mt-5 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

function StatementCard({ ov }: { ov: NonNullable<Overview> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-4">
          <h3 className="font-display text-sm font-semibold">Wallet statement</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {ov.ledger.map((l, i) => (
                <tr key={i} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium capitalize">{l.kind}</div>
                    <div className="text-xs text-muted-foreground">{l.at}</div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${l.deltaKobo >= 0 ? "text-success" : "text-foreground"}`}>
                    {l.deltaKobo >= 0 ? "+" : "−"}{naira(Math.abs(l.deltaKobo))}
                  </td>
                </tr>
              ))}
              {ov.ledger.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-sm text-muted-foreground">No wallet activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border p-4">
          <h3 className="font-display text-sm font-semibold">Recent messages</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {ov.messages.map((m, i) => (
                <tr key={i} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium capitalize">{m.channel} · {m.msisdn}</div>
                    <div className="text-xs text-muted-foreground">{m.segments} page{m.segments === 1 ? "" : "s"} · {m.at}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>{m.status}</span>
                    <div className="mt-0.5 text-xs text-muted-foreground">{naira(m.costKobo)}</div>
                  </td>
                </tr>
              ))}
              {ov.messages.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-sm text-muted-foreground">No messages sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium"
      aria-pressed={checked}
    >
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      {label}
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
