import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listBanks,
  resolveAccount,
  saveCommunityBank,
} from "@/lib/payments/bank.functions";
import { requestPayout } from "@/lib/payments/payouts.functions";
import { Button } from "@/components/ui/button";
import { Banknote, Landmark, Clock, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/payouts")({
  component: PayoutsPage,
});

type Source = "dues" | "donations";
type Balance = { currency: "NGN" | "USD"; source: Source; collected: number; paid_out: number; pending_out: number; available: number };
type Community = {
  id: string;
  name: string;
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  paystack_recipient_code: string | null;
};
type Payout = {
  id: string;
  amount: number;
  currency: "NGN" | "USD";
  source: Source;
  status: string;
  method: string | null;
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
  failed_reason: string | null;
};

const sym = (c: "NGN" | "USD") => (c === "NGN" ? "₦" : "$");

function PayoutsPage() {
  const [community, setCommunity] = useState<Community | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: c } = await supabase
        .from("communities")
        .select("id, name, bank_name, bank_code, account_number, account_name, paystack_recipient_code")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!c) return setLoading(false);
      setCommunity(c as Community);

      const [{ data: bal }, { data: pos }] = await Promise.all([
        supabase.from("community_balances_by_source").select("*").eq("community_id", c.id),
        supabase
          .from("payouts")
          .select("id, amount, currency, source, status, method, requested_at, paid_at, notes, failed_reason")
          .eq("community_id", c.id)
          .order("requested_at", { ascending: false }),
      ]);
      setBalances((bal ?? []) as Balance[]);
      setPayouts((pos ?? []) as Payout[]);
      setLoading(false);
    })();
  }, [refreshTick]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!community) return <p className="text-sm text-muted-foreground">No community found.</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Money you've collected, minus our platform fee. Add a bank account to request payouts.
        </p>
      </header>

      <BalancesGrid balances={balances} community={community} onRefresh={() => setRefreshTick((t) => t + 1)} />

      <BankSection community={community} onSaved={() => setRefreshTick((t) => t + 1)} />

      <PayoutHistory payouts={payouts} />
    </div>
  );
}

function BalancesGrid({
  balances,
  community,
  onRefresh,
}: {
  balances: Balance[];
  community: Community;
  onRefresh: () => void;
}) {
  const combos: { currency: "NGN" | "USD"; source: Source }[] = [
    { currency: "NGN", source: "dues" },
    { currency: "NGN", source: "donations" },
    { currency: "USD", source: "dues" },
    { currency: "USD", source: "donations" },
  ];
  const get = (currency: "NGN" | "USD", source: Source): Balance =>
    balances.find((b) => b.currency === currency && b.source === source) ?? {
      currency,
      source,
      collected: 0,
      paid_out: 0,
      pending_out: 0,
      available: 0,
    };
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {combos.map((c) => (
        <BalanceCard
          key={`${c.currency}-${c.source}`}
          b={get(c.currency, c.source)}
          community={community}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

function BalanceCard({
  b,
  community,
  onRefresh,
}: {
  b: Balance;
  community: Community;
  onRefresh: () => void;
}) {
  const reqFn = useServerFn(requestPayout);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasBank = !!community.bank_code && !!community.account_number;

  const submit = async () => {
    setErr(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr("Enter a valid amount");
    setBusy(true);
    try {
      await reqFn({
        data: { community_id: community.id, currency: b.currency, source: b.source, amount: amt },
      });
      setAmount("");
      onRefresh();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-primary" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {b.currency} · {b.source}
        </p>
      </div>
      <p className="mt-2 font-display text-3xl font-bold">
        {sym(b.currency)}
        {Number(b.available).toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">Available to withdraw</p>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Collected" value={`${sym(b.currency)}${Number(b.collected).toLocaleString()}`} />
        <Stat label="Pending" value={`${sym(b.currency)}${Number(b.pending_out).toLocaleString()}`} />
        <Stat label="Paid out" value={`${sym(b.currency)}${Number(b.paid_out).toLocaleString()}`} />
      </dl>

      <div className="mt-5 flex gap-2">
        <input
          className="input flex-1"
          type="number"
          placeholder={`Amount in ${b.currency}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!hasBank || Number(b.available) <= 0}
        />
        <Button onClick={submit} disabled={busy || !hasBank || Number(b.available) <= 0}>
          {busy ? "…" : "Request payout"}
        </Button>
      </div>
      {!hasBank && <p className="mt-2 text-xs text-muted-foreground">Add bank details below first.</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

      <style>{`.input{border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function BankSection({ community, onSaved }: { community: Community; onSaved: () => void }) {
  const listBanksFn = useServerFn(listBanks);
  const resolveFn = useServerFn(resolveAccount);
  const saveFn = useServerFn(saveCommunityBank);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState(community.bank_code ?? "");
  const [accountNumber, setAccountNumber] = useState(community.account_number ?? "");
  const [resolvedName, setResolvedName] = useState(community.account_name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listBanksFn({ data: { currency: "NGN" } })
      .then(setBanks)
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (bankCode && /^\d{10}$/.test(accountNumber)) {
      resolveFn({ data: { bank_code: bankCode, account_number: accountNumber } })
        .then((r) => {
          setResolvedName(r.account_name);
          setErr(null);
        })
        .catch((e) => {
          setResolvedName("");
          setErr(e.message);
        });
    } else {
      setResolvedName("");
    }
  }, [bankCode, accountNumber]);

  const save = async () => {
    setMsg(null);
    setErr(null);
    setBusy(true);
    try {
      const bank = banks.find((b) => b.code === bankCode);
      if (!bank) throw new Error("Pick a bank");
      const r = await saveFn({
        data: {
          community_id: community.id,
          bank_name: bank.name,
          bank_code: bankCode,
          account_number: accountNumber,
        },
      });
      setMsg(
        r.recipient_code
          ? "Saved. Payouts via Paystack are ready."
          : "Saved. Paystack Transfers not enabled — payouts will be manual.",
      );
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Bank details</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Funds are sent to this account when the super admin approves your payout.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="Bank">
          <select
            className="input"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          >
            <option value="">Select bank…</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account number">
          <input
            className="input"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
            maxLength={10}
          />
        </Field>
        <Field label="Account name">
          <input className="input" value={resolvedName} readOnly placeholder="Auto-resolved" />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={busy || !resolvedName}>
          {busy ? "Saving…" : "Save bank details"}
        </Button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid var(--color-border);background:var(--color-background);padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-ring)}`}</style>
    </section>
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

function statusBadge(s: string) {
  const map: Record<string, { c: string; Icon: typeof Clock }> = {
    requested: { c: "bg-yellow-100 text-yellow-900", Icon: Clock },
    approved: { c: "bg-blue-100 text-blue-900", Icon: Clock },
    paid: { c: "bg-green-100 text-green-900", Icon: CheckCircle2 },
    failed: { c: "bg-red-100 text-red-900", Icon: XCircle },
    rejected: { c: "bg-red-100 text-red-900", Icon: XCircle },
  };
  const { c, Icon } = map[s] ?? map.requested;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>
      <Icon className="h-3 w-3" /> {s}
    </span>
  );
}

function PayoutHistory({ payouts }: { payouts: Payout[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="border-b border-border p-6">
        <h2 className="font-display text-lg font-bold">Payout history</h2>
      </div>
      {payouts.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No payouts yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="font-display text-sm font-bold">
                  {sym(p.currency)}
                  {Number(p.amount).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested {new Date(p.requested_at).toLocaleDateString()}
                  {p.paid_at && ` • Paid ${new Date(p.paid_at).toLocaleDateString()}`}
                  {p.method && ` • via ${p.method.replace("_", " ")}`}
                </p>
                {p.failed_reason && (
                  <p className="text-xs text-destructive">{p.failed_reason}</p>
                )}
              </div>
              {statusBadge(p.status)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
