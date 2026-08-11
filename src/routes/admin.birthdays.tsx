import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cake, Send, Sparkles, Check, Mail, MessageCircle } from "lucide-react";
import { getMyCommunity } from "@/lib/payments/communities.functions";
import { getBirthdayMessages, saveBirthdayMessage, listMembersWithBirthdays, sendBirthdayMessages } from "@/lib/membership/birthdays.functions";
import { requireModule } from "@/lib/module-gate";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const Route = createFileRoute("/admin/birthdays")({
  beforeLoad: () => requireModule("Birthdays"),
  component: Birthdays,
});

type Member = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  dob: string;
  lastSentAt: string | null;
  lastSentYear: number | null;
};
type SendResult = { emailSent: number; emailTotal: number; whatsappSent: number; whatsappTotal: number; whatsappConfigured: boolean };

function resultSummary(r: SendResult): string {
  const parts: string[] = [];
  if (r.emailTotal > 0) parts.push(`${r.emailSent}/${r.emailTotal} email`);
  if (r.whatsappTotal > 0) parts.push(`${r.whatsappSent}/${r.whatsappTotal} WhatsApp`);
  return parts.length > 0 ? `Sent ${parts.join(", ")}.` : "Nothing to send.";
}

// dob comes in as a plain "YYYY-MM-DD" string — parse the month/day
// straight out of it rather than through `new Date(dob)`. A bare date
// string parses as UTC midnight, but re-reading it with local accessors (or
// formatting without forcing UTC) can shift the calendar day by one
// depending on the viewer's timezone — which is exactly why a member born
// on the 7th could show up as the 6th.
function dobParts(dob: string): { month: number; day: number } {
  const [, month, day] = dob.split("-").map(Number);
  return { month: month || 0, day: day || 0 };
}

function isTodayBirthday(dob: string) {
  const { month, day } = dobParts(dob);
  const now = new Date();
  return day === now.getDate() && month === now.getMonth() + 1;
}

function formatDob(dob: string): string {
  const { month, day } = dobParts(dob);
  if (!month || !day) return "";
  return `${MONTHS[month - 1]} ${day}`;
}

function formatSent(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Birthdays() {
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [communityName, setCommunityName] = useState("");
  const [active, setActive] = useState(MONTHS[new Date().getMonth()]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Previously these calls had no .catch() — if the request failed for any
  // reason (session hiccup, network blip), `members` silently stayed `[]`
  // forever with no visible error, which looked exactly like "no birthdays
  // this month" even when the dashboard's own count showed otherwise.
  function refreshMembers() {
    listMembersWithBirthdays()
      .then((rows) => {
        setMembers(rows);
        setLoadError(null);
      })
      .catch((err: any) => setLoadError(err?.message ?? "Couldn't load members."));
  }

  useEffect(() => {
    refreshMembers();
    getBirthdayMessages().then(setMessages).catch(() => {});
    getMyCommunity().then((c) => setCommunityName(c?.name ?? "")).catch(() => {});
  }, []);

  const thisMonth = members.filter((m) => dobParts(m.dob).month === MONTHS.indexOf(active) + 1);
  const today = members.filter((m) => isTodayBirthday(m.dob) && (m.email || m.whatsapp));

  async function sendToday() {
    if (today.length === 0) return;
    setSending(true);
    try {
      const result = await sendBirthdayMessages({ data: { memberIds: today.map((m) => m.id) } });
      setLastRun(new Date().toISOString());
      setLastResult(result);
      setJustSent(true);
      refreshMembers(); // reflect the new "Sent" badges/history right away
      setTimeout(() => setJustSent(false), 2200);
    } catch (err: any) {
      alert(err?.message ?? "Couldn't send birthday messages.");
    } finally {
      setSending(false);
    }
  }

  // Lets the admin resend to one specific person — e.g. their birthday's
  // already past "today" for the bulk button, or the first send just didn't
  // land — without needing to wait for the automated job. Sends on every
  // channel the member has on file (email and/or WhatsApp).
  async function resendTo(memberId: string) {
    setResendingId(memberId);
    try {
      await sendBirthdayMessages({ data: { memberIds: [memberId] } });
      setResentId(memberId);
      refreshMembers(); // reflect the new "Sent" badge/history right away
      setTimeout(() => setResentId(null), 2200);
    } catch (err: any) {
      alert(err?.message ?? "Couldn't send that birthday message.");
    } finally {
      setResendingId(null);
    }
  }

  async function saveMessage() {
    setSavingMessage(true);
    try {
      await saveBirthdayMessage({ data: { month: active as any, message: messages[active] ?? "" } });
    } finally {
      setSavingMessage(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Birthday messages</h1>
          <p className="text-sm text-muted-foreground">
            Pick a month's message, then send it to today's celebrants whenever you're ready.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={sendToday}
            disabled={today.length === 0 || sending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-40"
          >
            {justSent ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending…" : justSent ? "Sent" : `Send today's messages (${today.length})`}
          </button>
          {lastRun && (
            <p className="text-[11px] text-muted-foreground">
              Last manual run: {new Date(lastRun).toLocaleString()}
              {lastResult && ` — ${resultSummary(lastResult)}`}
            </p>
          )}
        </div>
      </header>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>Couldn't load members: {loadError}</span>
          <button onClick={refreshMembers} className="rounded-full border border-destructive/30 px-3 py-1 text-xs font-semibold hover:bg-destructive/10">
            Retry
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-primary/30 bg-gradient-hero p-5 text-primary-foreground shadow-elegant">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <h2 className="font-display text-lg font-bold">Today's celebrants</h2>
        </div>
        {today.length === 0 ? (
          <p className="mt-2 text-sm text-primary-foreground/80">No birthdays today — relax ☕</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {today.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="flex items-center gap-2 text-xs text-primary-foreground/70">
                    {m.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
                    {m.whatsapp && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</span>}
                  </p>
                </div>
                <Cake className="h-4 w-4 text-primary-foreground/80" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft md:col-span-1">
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-2">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => setActive(m)}
                className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  active === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 md:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Message for</p>
                <h2 className="font-display text-2xl font-bold">{active}</h2>
              </div>
              <button
                onClick={saveMessage}
                disabled={savingMessage}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                <Send className="h-3 w-3" /> {savingMessage ? "Saving…" : "Save"}
              </button>
            </div>
            <textarea
              rows={5}
              value={messages[active] ?? ""}
              onChange={(e) => setMessages({ ...messages, [active]: e.target.value })}
              className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Sent from {communityName || "your community"}. Tip: keep messages short, warm, and authentic.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <Cake className="h-4 w-4 text-accent" />
              {active} celebrations · {thisMonth.length} {thisMonth.length === 1 ? "member" : "members"}
              {(() => {
                const sentCount = thisMonth.filter((m) => m.lastSentYear === new Date().getFullYear()).length;
                return sentCount > 0 ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                    {sentCount} sent this year
                  </span>
                ) : null;
              })()}
            </div>
            {thisMonth.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No birthdays this month.</p>
            ) : (
              <ul className="space-y-2">
                {thisMonth.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                      {m.name.split(" ").map(p => p[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDob(m.dob)}
                        {m.lastSentAt && (
                          <span className="ml-2 inline-flex items-center gap-1 text-success">
                            <Check className="h-3 w-3" /> Sent {formatSent(m.lastSentAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      {m.email && <span title={m.email}><Mail className="h-3.5 w-3.5" /></span>}
                      {m.whatsapp && <span title={m.whatsapp}><MessageCircle className="h-3.5 w-3.5" /></span>}
                    </span>
                    <button
                      onClick={() => resendTo(m.id)}
                      disabled={(!m.email && !m.whatsapp) || resendingId === m.id}
                      title={m.email || m.whatsapp ? "Send this member their birthday message now" : "No email or WhatsApp number on file"}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      {resentId === m.id ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                      {resendingId === m.id ? "Sending…" : resentId === m.id ? "Sent" : "Send"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
