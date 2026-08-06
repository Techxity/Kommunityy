import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Cake, Send, Sparkles, Check } from "lucide-react";
import { getMyCommunity } from "@/lib/payments/communities.functions";
import { getBirthdayMessages, saveBirthdayMessage, listMembersWithBirthdays, sendBirthdayEmails } from "@/lib/membership/birthdays.functions";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const Route = createFileRoute("/admin/birthdays")({
  component: Birthdays,
});

type Member = { id: string; name: string; email: string; dob: string };

function isTodayBirthday(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  return d.getUTCDate() === now.getDate() && d.getUTCMonth() === now.getMonth();
}

function Birthdays() {
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [communityName, setCommunityName] = useState("");
  const [active, setActive] = useState(MONTHS[new Date().getMonth()]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);

  useEffect(() => {
    listMembersWithBirthdays().then(setMembers);
    getBirthdayMessages().then(setMessages);
    getMyCommunity().then((c) => setCommunityName(c?.name ?? ""));
  }, []);

  const thisMonth = members.filter((m) => new Date(m.dob).getUTCMonth() === MONTHS.indexOf(active));
  const today = members.filter((m) => isTodayBirthday(m.dob) && m.email);

  async function sendToday() {
    if (today.length === 0) return;
    setSending(true);
    try {
      await sendBirthdayEmails({ data: { memberIds: today.map((m) => m.id) } });
      setLastRun(new Date().toISOString());
      setJustSent(true);
      setTimeout(() => setJustSent(false), 2200);
    } catch (err: any) {
      alert(err?.message ?? "Couldn't send birthday emails.");
    } finally {
      setSending(false);
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
            {sending ? "Sending…" : justSent ? "Sent" : `Send today's emails (${today.length})`}
          </button>
          {lastRun && (
            <p className="text-[11px] text-muted-foreground">
              Last manual run: {new Date(lastRun).toLocaleString()}
            </p>
          )}
        </div>
      </header>

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
                  <p className="text-xs text-primary-foreground/70">{m.email}</p>
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
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Cake className="h-4 w-4 text-accent" />
              {active} celebrations · {thisMonth.length} {thisMonth.length === 1 ? "member" : "members"}
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
                      <p className="text-xs text-muted-foreground">{new Date(m.dob).toLocaleDateString(undefined, { month: "long", day: "numeric", timeZone: "UTC" })}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{m.email}</span>
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
