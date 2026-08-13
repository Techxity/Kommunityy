import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Megaphone, Send, Mail, MessageSquare, AlertTriangle } from "lucide-react";
import { listBroadcasts, sendBroadcast } from "@/lib/membership/broadcasts.functions";
import { listMembers } from "@/lib/membership/members.functions";
import { getSmsComposeInfo } from "@/lib/sms/sms.functions";
import { segmentInfo } from "@/lib/sms/segments";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/broadcast")({
  beforeLoad: () => requireModule("Broadcasts"),
  component: Broadcast,
});

const TEMPLATES = [
  { name: "Meeting reminder", body: "Dear member, this is a friendly reminder that our monthly meeting takes place on…" },
  { name: "Welcome new members", body: "Please join us in welcoming our newest members to the community…" },
  { name: "Holiday greetings", body: "Wishing you and your loved ones a peaceful and joyful holiday season…" },
];

type Broadcast = { id: string; title: string; date: string; reach: number };
type SmsInfo = Awaited<ReturnType<typeof getSmsComposeInfo>>;

function Broadcast() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [sms, setSms] = useState<SmsInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ sent: number; total: number; smsSent: number } | null>(null);

  function refresh() {
    listBroadcasts().then(setBroadcasts);
    listMembers({ data: { status: "active" } }).then((rows) => setActiveCount(rows.length));
    getSmsComposeInfo().then(setSms).catch(() => setSms(null));
  }

  useEffect(() => {
    refresh();
  }, []);

  const seg = segmentInfo(body);
  const smsCostKobo = sms ? seg.pages * sms.ratePerPageKobo * sms.recipients : 0;
  const smsAffordable = sms ? smsCostKobo <= sms.balanceKobo : true;

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    if (!viaEmail && !viaSms) return setError("Pick at least one channel.");
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await sendBroadcast({ data: { subject, body, viaEmail, viaSms } });
      setResult(res);
      setSubject("");
      setBody("");
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't send broadcast.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Broadcasts</h1>
        <p className="text-sm text-muted-foreground">Send a single message to every active member by email, SMS, or both.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft md:col-span-2">
          <h2 className="font-display text-lg font-semibold">New broadcast</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="A clear, descriptive subject"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
                placeholder="Write your message…"
              />
              {viaSms && body.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{seg.units} chars · {seg.pages} page{seg.pages === 1 ? "" : "s"} · {seg.encoding === "unicode" ? "Unicode (70/page)" : "Plain (160/page)"}</span>
                  {seg.encoding === "unicode" && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> A special character (emoji/curly quote) is halving the page size — remove it to send cheaper.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Channels */}
            <div>
              <p className="text-sm font-medium">Send via</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ChannelChip icon={Mail} label="Email" checked={viaEmail} onChange={setViaEmail} />
                <ChannelChip
                  icon={MessageSquare}
                  label="SMS"
                  checked={viaSms}
                  onChange={setViaSms}
                  disabled={!sms?.available}
                  disabledHint={sms && !sms.available ? "Enable SMS + the broadcasts channel on the SMS page first." : undefined}
                />
              </div>
              {viaSms && sms?.available && (
                <p className={`mt-2 text-xs ${smsAffordable ? "text-muted-foreground" : "text-destructive"}`}>
                  SMS estimate: {seg.pages} page{seg.pages === 1 ? "" : "s"} × {sms.recipients} member{sms.recipients === 1 ? "" : "s"} ≈{" "}
                  <span className="font-semibold">₦{(smsCostKobo / 100).toLocaleString()}</span>
                  {" "}(balance ₦{(sms.balanceKobo / 100).toLocaleString()})
                  {!smsAffordable && " — not enough balance; only what the balance covers will send. "}
                  {!smsAffordable && <Link to="/admin/sms" className="font-semibold underline">Top up</Link>}
                </p>
              )}
            </div>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            {result && (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                {viaEmail && `Emailed ${result.sent} of ${result.total} members.`}
                {result.smsSent > 0 && ` Texted ${result.smsSent}.`}
              </p>
            )}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">To <span className="font-semibold text-foreground">{activeCount} active members</span>.</p>
              <button
                onClick={send}
                disabled={sending || !subject.trim() || !body.trim() || (!viaEmail && !viaSms)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send broadcast"}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Templates</p>
            <div className="mt-3 space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { setSubject(t.name); setBody(t.body); }}
                  className="block w-full rounded-xl border border-border p-3 text-left text-sm hover:border-primary hover:bg-primary/5"
                >
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Recently sent</p>
            <ul className="mt-3 space-y-3">
              {broadcasts.length === 0 && (
                <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
              )}
              {broadcasts.map((b) => (
                <li key={b.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <Megaphone className="mt-0.5 h-4 w-4 text-accent" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{b.date} · reached {b.reach}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ChannelChip({
  icon: Icon,
  label,
  checked,
  onChange,
  disabled,
  disabledHint,
}: {
  icon: typeof Mail;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked && !disabled ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
