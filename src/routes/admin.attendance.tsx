import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  createAttendanceSession,
  getAttendanceData,
  getAttendanceTrend,
  saveAttendance,
} from "@/lib/membership/attendance.functions";
import { sendBroadcast } from "@/lib/membership/broadcasts.functions";
import { getSmsComposeInfo } from "@/lib/sms/sms.functions";
import { requireModule } from "@/lib/module-gate";

export const Route = createFileRoute("/admin/attendance")({
  beforeLoad: () => requireModule("Attendance"),
  component: Attendance,
});

type Status = "present" | "absent" | "excused" | null;
type AttendanceFilter = "all" | "present" | "absent" | "excused" | "unmarked";
type AttendanceData = Awaited<ReturnType<typeof getAttendanceData>>;
type AttendancePeriod = "week" | "month" | "quarter" | "year";
type AttendanceTrend = Awaited<ReturnType<typeof getAttendanceTrend>>;
type SmsInfo = Awaited<ReturnType<typeof getSmsComposeInfo>>;

function trendBucketLabel(date: string, period: AttendancePeriod) {
  const [year, month, day] = date.split("-").map(Number);
  if (period === "year") return String(year);
  if (period === "quarter") return `Q${Math.ceil(month / 3)} '${String(year).slice(-2)}`;
  const dateValue = new Date(year, month - 1, day, 12);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "short" }).format(dateValue);
  return period === "month" ? `${monthLabel} '${String(year).slice(-2)}` : `${monthLabel} ${day}`;
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Attendance() {
  const [data, setData] = useState<AttendanceData>({
    sessions: [],
    members: [],
    records: [],
    selectedSessionId: null,
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [meetingDate, setMeetingDate] = useState(todayDate);
  const [title, setTitle] = useState("Weekly gathering");
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [trendPeriod, setTrendPeriod] = useState<AttendancePeriod>("week");
  const [trend, setTrend] = useState<AttendanceTrend>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendRevision, setTrendRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [subject, setSubject] = useState("Thank you for joining us");
  const [body, setBody] = useState("");
  const [viaEmail, setViaEmail] = useState(true);
  const [viaSms, setViaSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [smsInfo, setSmsInfo] = useState<SmsInfo | null>(null);

  async function load(sessionId?: string | null) {
    const next = await getAttendanceData({ data: sessionId ? { sessionId } : {} });
    setData(next);
    setSelectedSessionId(next.selectedSessionId);
    setMarks(
      Object.fromEntries(next.records.map((record) => [record.memberId, record.status as Status])),
    );
    setLoading(false);
    setTrendRevision((revision) => revision + 1);
  }

  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    getAttendanceTrend({ data: { period: trendPeriod } })
      .then((next) => {
        if (!cancelled) setTrend(next);
      })
      .catch(() => {
        if (!cancelled) {
          setTrend([]);
          toast.error("Couldn't load the attendance summary.");
        }
      })
      .finally(() => {
        if (!cancelled) setTrendLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trendPeriod, trendRevision]);

  useEffect(() => {
    getSmsComposeInfo()
      .then(setSmsInfo)
      .catch(() => setSmsInfo(null));
    getAttendanceData({ data: {} })
      .then((next) => {
        setData(next);
        setSelectedSessionId(next.selectedSessionId);
        setMarks(
          Object.fromEntries(
            next.records.map((record) => [record.memberId, record.status as Status]),
          ),
        );
      })
      .catch(() => toast.error("Couldn't load attendance."))
      .finally(() => setLoading(false));
  }, []);

  const activeSession = data.sessions.find((session) => session.id === selectedSessionId) ?? null;
  const counts = data.members.reduce(
    (result, member) => {
      const status = marks[member.id];
      if (status) result[status] += 1;
      return result;
    },
    { present: 0, absent: 0, excused: 0 },
  );
  const markedCount = counts.present + counts.absent + counts.excused;
  const unmarkedCount = data.members.length - markedCount;
  const trendTotals = trend.reduce(
    (total, bucket) => ({
      meetings: total.meetings + bucket.meetings,
      marked: total.marked + bucket.marked,
      present: total.present + bucket.present,
      absent: total.absent + bucket.absent,
      excused: total.excused + bucket.excused,
    }),
    { meetings: 0, marked: 0, present: 0, absent: 0, excused: 0 },
  );
  const trendRate =
    trendTotals.marked > 0 ? Math.round((trendTotals.present / trendTotals.marked) * 100) : null;
  const filterLabels: Record<AttendanceFilter, string> = {
    all: "Everyone",
    present: "Present",
    absent: "Absent",
    excused: "Excused",
    unmarked: "Unmarked",
  };
  const audienceMembers = data.members.filter((member) => {
    if (filter === "all") return true;
    const status = marks[member.id] ?? null;
    return filter === "unmarked" ? status === null : status === filter;
  });
  const visibleMembers = audienceMembers.filter((member) =>
    member.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function createSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const session = await createAttendanceSession({
        data: { date: meetingDate, title: title.trim() || "Weekly gathering" },
      });
      await load(session.id);
      toast.success("Meeting session ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create this meeting.");
    }
  }

  async function saveMarks() {
    if (!selectedSessionId) return;
    setSaving(true);
    try {
      await saveAttendance({
        data: {
          sessionId: selectedSessionId,
          records: data.members.map((member) => ({
            memberId: member.id,
            status: marks[member.id] ?? null,
          })),
        },
      });
      setTrendRevision((revision) => revision + 1);
      toast.success("Attendance saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save attendance.");
    } finally {
      setSaving(false);
    }
  }

  async function sendGroupMessage() {
    if (!viaEmail && !viaSms) {
      toast.error("Choose Email or SMS.");
      return;
    }
    if (!subject.trim() || !body.trim() || audienceMembers.length === 0) return;
    setSending(true);
    try {
      const result = await sendBroadcast({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          viaEmail,
          viaSms,
          memberIds: audienceMembers.map((member) => member.id),
        },
      });
      const channels = [];
      if (viaEmail) channels.push(`emailed ${result.sent} of ${result.total}`);
      if (viaSms) channels.push(`texted ${result.smsSent}`);
      toast.success(`Message sent: ${channels.join("; ")}.`);
      setMessageOpen(false);
      setBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  }

  function exportCsv() {
    if (!activeSession) return;
    const rows = [
      ["Member", "Email", "Phone", "Attendance", "Meeting date"],
      ...audienceMembers.map((member) => [
        member.name,
        member.email,
        member.phone,
        marks[member.id] ?? "Unmarked",
        activeSession.date,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${activeSession.date}-${filter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-40" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Weekly gathering register and session history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="attendance-session">
            Meeting session
          </label>
          <select
            id="attendance-session"
            value={selectedSessionId ?? ""}
            onChange={(event) => load(event.target.value || null)}
            className="input min-w-48"
            disabled={data.sessions.length === 0}
          >
            {data.sessions.length === 0 ? <option value="">No sessions yet</option> : null}
            {data.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.date} · {session.title}
              </option>
            ))}
          </select>
          {activeSession && (
            <button
              onClick={exportCsv}
              title={`Export ${filterLabels[filter].toLowerCase()} members as CSV`}
              aria-label={`Export ${filterLabels[filter].toLowerCase()} members as CSV`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <section
        aria-label="Attendance trend"
        aria-busy={trendLoading}
        className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Attendance trend</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Present as a share of marked statuses (present, absent, or excused).
            </p>
          </div>
          <label className="grid w-full gap-1 text-xs font-medium text-muted-foreground sm:w-auto">
            Group by
            <select
              aria-label="Attendance trend period"
              value={trendPeriod}
              onChange={(event) => setTrendPeriod(event.target.value as AttendancePeriod)}
              className="input w-full sm:min-w-40"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Summary icon={CalendarDays} label="Meetings" value={trendTotals.meetings} />
          <Summary icon={Check} label="Present" value={trendTotals.present} />
          <Summary icon={CalendarDays} label="Absent" value={trendTotals.absent} />
          <Summary icon={ClipboardCheck} label="Excused" value={trendTotals.excused} />
          <Summary icon={Users} label="Marked statuses" value={trendTotals.marked} />
          <Summary
            icon={TrendingUp}
            label="Present of marked"
            value={trendRate === null ? "—" : `${trendRate}%`}
          />
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">
            Most recent 12 {trendPeriod === "week" ? "weeks" : `${trendPeriod}s`}
          </h3>
          {trend.some((bucket) => bucket.marked > 0) ? (
            <div className="space-y-3">
              {trend.map((bucket) => {
                const rate =
                  bucket.marked > 0 ? Math.round((bucket.present / bucket.marked) * 100) : null;
                const label = trendBucketLabel(bucket.date, trendPeriod);
                return (
                  <div
                    key={bucket.date}
                    className="grid grid-cols-[3.75rem_minmax(0,1fr)_3rem] items-center gap-3 sm:grid-cols-[5rem_minmax(0,1fr)_3.5rem]"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div
                      role="progressbar"
                      aria-label={
                        rate === null
                          ? `${label}: no attendance marked`
                          : `${label}: ${rate}% present among marked statuses`
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={rate ?? 0}
                      className="h-2.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${rate ?? 0}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-medium tabular-nums">
                      {rate === null ? "—" : `${rate}%`}
                    </span>
                    <p className="col-span-3 -mt-2 text-right text-xs text-muted-foreground sm:col-span-1 sm:col-start-2">
                      {bucket.present} present of {bucket.marked} marked
                      {" · "}
                      {bucket.meetings} {bucket.meetings === 1 ? "meeting" : "meetings"}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-5 text-center text-sm text-muted-foreground">
              {trendLoading
                ? "Loading attendance trend…"
                : "No marked attendance in this period yet."}
            </p>
          )}
        </div>
      </section>

      <form
        onSubmit={createSession}
        className="flex flex-wrap items-end gap-3 border-b border-border pb-5"
      >
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Meeting date
          <input
            type="date"
            value={meetingDate}
            onChange={(event) => setMeetingDate(event.target.value)}
            className="input min-w-40"
            required
          />
        </label>
        <label className="grid min-w-52 flex-1 gap-1 text-xs font-medium text-muted-foreground">
          Meeting name
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className="input"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Open session
        </button>
      </form>

      {activeSession ? (
        <>
          <section
            aria-label="Attendance summary"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <Summary icon={Users} label="Active members" value={data.members.length} />
            <Summary icon={Check} label="Present" value={counts.present} />
            <Summary icon={CalendarDays} label="Absent" value={counts.absent} />
            <Summary
              icon={ClipboardCheck}
              label="Marked"
              value={`${markedCount} / ${data.members.length}`}
            />
          </section>

          <div
            className="flex flex-wrap items-center gap-1 border-b border-border pb-3"
            role="group"
            aria-label="Filter by attendance status"
          >
            {(
              [
                ["all", "Everyone", data.members.length],
                ["present", "Present", counts.present],
                ["absent", "Absent", counts.absent],
                ["excused", "Excused", counts.excused],
                ["unmarked", "Unmarked", unmarkedCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  filter === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label} <span className="ml-1 tabular-nums">{count}</span>
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {audienceMembers.length} {filterLabels[filter].toLowerCase()} members
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="font-display text-xl font-semibold">{activeSession.title}</h2>
              <p className="text-sm text-muted-foreground">
                {activeSession.date} · {counts.excused} excused
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMessageOpen((open) => !open)}
                disabled={audienceMembers.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <Mail className="h-4 w-4" /> Message group
              </button>
              <label className="relative">
                <span className="sr-only">Search members</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a member"
                  className="input pl-9"
                />
              </label>
              <button
                onClick={saveMarks}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save register"}
              </button>
            </div>
          </div>

          {messageOpen && (
            <section className="space-y-3 border-b border-border pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Message {filterLabels[filter].toLowerCase()}</h3>
                  <p className="text-xs text-muted-foreground">
                    To {audienceMembers.length} members with this attendance status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageOpen(false)}
                  aria-label="Close message composer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                  Subject
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    maxLength={200}
                    className="input"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground md:row-span-2">
                  Message
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={10000}
                    rows={4}
                    className="input resize-y"
                    placeholder="Write your message…"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={viaEmail}
                      onChange={(event) => setViaEmail(event.target.checked)}
                    />
                    <Mail className="h-4 w-4" /> Email
                  </label>
                  <label
                    className="inline-flex items-center gap-2 text-sm"
                    title={
                      !smsInfo?.available
                        ? "Enable SMS and the broadcasts channel in SMS settings first."
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={viaSms}
                      onChange={(event) => setViaSms(event.target.checked)}
                      disabled={!smsInfo?.available}
                    />
                    <MessageSquare className="h-4 w-4" /> SMS
                  </label>
                  {!smsInfo?.available && (
                    <Link to="/admin/sms" className="text-xs text-muted-foreground underline">
                      Configure SMS
                    </Link>
                  )}
                </div>
              </div>
              {viaSms && smsInfo?.available && (
                <p className="text-xs text-muted-foreground">
                  SMS uses the community wallet. Opted-out numbers and messages beyond the available
                  balance are skipped.
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={sendGroupMessage}
                  disabled={
                    sending ||
                    !subject.trim() ||
                    !body.trim() ||
                    (!viaEmail && !viaSms) ||
                    audienceMembers.length === 0
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />{" "}
                  {sending ? "Sending…" : `Send to ${audienceMembers.length}`}
                </button>
              </div>
            </section>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((member) => (
                  <tr key={member.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-3 font-medium">{member.name}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Attendance for ${member.name}`}
                        value={marks[member.id] ?? ""}
                        onChange={(event) =>
                          setMarks((current) => ({
                            ...current,
                            [member.id]: (event.target.value || null) as Status,
                          }))
                        }
                        className="input max-w-48"
                      >
                        <option value="">Unmarked</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {visibleMembers.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-10 text-center text-muted-foreground">
                      No members match that search.
                    </td>
                  </tr>
                )}
                {data.members.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-10 text-center text-muted-foreground">
                      Add active members before taking attendance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center border-y border-dashed border-border text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-lg font-semibold">No meetings recorded</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a date above to open the first register.
          </p>
        </div>
      )}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 border-l-2 border-primary/40 py-2 pl-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
