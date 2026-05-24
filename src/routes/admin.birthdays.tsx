import { createFileRoute } from "@tanstack/react-router";
import { birthdayMessages, members } from "@/lib/mock-data";
import { useState } from "react";
import { Cake, Send } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const Route = createFileRoute("/admin/birthdays")({
  component: Birthdays,
});

function Birthdays() {
  const [messages, setMessages] = useState(birthdayMessages);
  const [active, setActive] = useState("May");

  const thisMonth = members.filter((m) => new Date(m.dob).getMonth() === MONTHS.indexOf(active));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Birthday messages</h1>
        <p className="text-sm text-muted-foreground">Configure a heartfelt message for each month. Sent automatically via WhatsApp + email on the day.</p>
      </header>

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
              <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                <Send className="h-3 w-3" /> Save & schedule
              </button>
            </div>
            <textarea
              rows={5}
              value={messages[active]}
              onChange={(e) => setMessages({ ...messages, [active]: e.target.value })}
              className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
            />
            <p className="mt-2 text-xs text-muted-foreground">Tip: keep messages short, warm, and authentic.</p>
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
                      {m.name.split(" ").map(p=>p[0]).join("").slice(0,2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(m.dob).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
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
