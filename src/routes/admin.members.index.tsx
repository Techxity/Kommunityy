import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listMembers, updateMember, setMembersStatus, bulkCreateMembers } from "@/lib/membership/members.functions";
import { listMyChapters } from "@/lib/membership/chapters.functions";
import { sendInvites } from "@/lib/membership/invites.functions";
import { resendMemberInvite } from "@/lib/membership/member-accounts.functions";
import {
  Search,
  Upload,
  Send,
  Edit2,
  UserX,
  UserCheck,
  Plus,
  X,
  ClipboardList,
  SlidersHorizontal,
  Inbox,
  Save,
  KeyRound,
  FileUp,
  Check,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/members/")({
  component: MembersPage,
});

type Member = Awaited<ReturnType<typeof listMembers>>[number];
type Chapter = { id: string; name: string };

function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [query, setQuery] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [chapterFilter, setChapterFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Member | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState("");

  async function sendAccountInvite(memberId: string) {
    setInvitingId(memberId);
    setInviteNote("");
    try {
      const res = await resendMemberInvite({ data: { memberId } });
      if (!res.created) setInviteNote(res.reason ?? "Couldn't send an invite right now.");
      else if (!res.emailSent) setInviteNote(`Invite created, but email didn't send. Link: ${res.link}`);
      else setInviteNote("Account invite sent.");
      refresh();
    } catch (err: any) {
      setInviteNote(err?.message ?? "Couldn't send an invite right now.");
    } finally {
      setInvitingId(null);
      setTimeout(() => setInviteNote(""), 6000);
    }
  }

  function refresh() {
    listMembers({ data: {} }).then((all) => {
      setMembers(all.filter((m) => m.status === "active" || m.status === "inactive"));
    });
    listMembers({ data: { status: "pending" } }).then((rows) => setPendingCount(rows.length));
  }

  useEffect(() => {
    refresh();
    listMyChapters().then((rows) => setChapters(rows.map((c) => ({ id: c.id, name: c.name }))));
  }, []);

  const chapterNames = useMemo(() => Array.from(new Set(members.map((m) => m.chapter).filter(Boolean))), [members]);
  const countries = useMemo(() => Array.from(new Set(members.map((m) => m.country).filter(Boolean))), [members]);
  const roles = useMemo(() => Array.from(new Set(members.map((m) => m.role).filter(Boolean))), [members]);
  const statuses = useMemo(() => Array.from(new Set(members.map((m) => m.status).filter(Boolean))), [members]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesQuery = [m.name, m.email, m.role].some((f) => (f ?? "").toLowerCase().includes(query.toLowerCase()));
      const matchesChapter = !chapterFilter || m.chapter === chapterFilter;
      const matchesCountry = !countryFilter || m.country === countryFilter;
      const matchesRole = !roleFilter || m.role === roleFilter;
      const matchesStatus = !statusFilter || m.status === statusFilter;
      return matchesQuery && matchesChapter && matchesCountry && matchesRole && matchesStatus;
    });
  }, [members, query, chapterFilter, countryFilter, roleFilter, statusFilter]);

  const activeCount = members.filter((m) => m.status === "active").length;
  const inactiveCount = members.filter((m) => m.status === "inactive").length;

  const clearFilters = () => {
    setChapterFilter("");
    setCountryFilter("");
    setRoleFilter("");
    setStatusFilter("");
  };
  const hasFilters = chapterFilter || countryFilter || roleFilter || statusFilter;

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function setStatus(ids: Set<string> | string[], status: "active" | "inactive") {
    const idList = Array.from(ids instanceof Set ? ids : new Set(ids));
    if (idList.length === 0) return;
    await setMembersStatus({ data: { ids: idList, status } });
    refresh();
  }

  async function saveEdit(updated: Member) {
    await updateMember({
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email || undefined,
        phone: updated.phone || undefined,
        whatsapp: updated.whatsapp || undefined,
        dob: updated.dob || undefined,
        role: updated.role || undefined,
        country: updated.country || undefined,
        chapterId: updated.chapterId || null,
        status: updated.status as "pending" | "active" | "inactive" | "rejected",
      },
    });
    setEditing(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">Manage everyone in your community.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendingCount > 0 && (
            <Link
              to="/admin/members/pending"
              className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/20"
            >
              <Inbox className="h-4 w-4" /> {pendingCount} pending
            </Link>
          )}
          <Link
            to="/admin/onboarding"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" /> Onboarding form
          </Link>
          <button onClick={() => setShowBulkUpload(true)} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-soft hover:bg-muted">
            <FileUp className="h-4 w-4" /> Bulk upload
          </button>
          <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90">
            <Plus className="h-4 w-4" /> Invite members
          </button>
        </div>
      </header>

      {inviteNote && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground break-all">{inviteNote}</p>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or role…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
            />
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showFilters || hasFilters
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {hasFilters && <span className="rounded-full bg-primary px-1.5 py-0 text-[10px] font-bold text-primary-foreground">{[chapterFilter, countryFilter, roleFilter, statusFilter].filter(Boolean).length}</span>}
          </button>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">Active {activeCount}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Inactive {inactiveCount}</span>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 px-4 py-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Chapter</label>
              <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring">
                <option value="">All chapters</option>
                {chapterNames.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Country</label>
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring">
                <option value="">All countries</option>
                {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Role</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring">
                <option value="">All roles</option>
                {roles.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring">
                <option value="">All statuses</option>
                {statuses.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
              </select>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="mb-0.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              <span>{allFilteredSelected ? "Deselect all" : `Select all ${filtered.length}`}</span>
              {selected.size > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {selected.size} selected
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <button
                disabled={selected.size === 0}
                onClick={() => { setStatus(selected, "inactive"); setSelected(new Set()); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-muted-foreground"
              >
                <UserX className="h-3 w-3" /> Disable selected
              </button>
              <button
                disabled={selected.size === 0}
                onClick={() => { setStatus(selected, "active"); setSelected(new Set()); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-40"
              >
                <UserCheck className="h-3 w-3" /> Enable selected
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Chapter</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const checked = selected.has(m.id);
                const isActive = m.status === "active";
                return (
                  <tr key={m.id} className={`border-t border-border hover:bg-muted/30 ${checked ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(m.id)}
                        aria-label={`Select ${m.name}`}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-accent text-xs font-bold text-primary-foreground">
                          {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{m.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.chapter}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.joined}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setEditing(m)}
                          title="Edit member"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setStatus([m.id], isActive ? "inactive" : "active")}
                          title={isActive ? "Disable member" : "Enable member"}
                          className={`rounded-md p-1.5 ${
                            isActive
                              ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              : "text-success hover:bg-success/10"
                          }`}
                        >
                          {isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        </button>
                        {isActive && !m.hasAccount && (
                          <button
                            onClick={() => sendAccountInvite(m.id)}
                            title={m.email ? "Send account setup invite" : "Add an email first to invite them"}
                            disabled={!m.email || invitingId === m.id}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No members match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditMemberModal
          member={editing}
          chapters={chapters}
          roles={roles}
          countries={countries}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onDone={() => {
            setShowBulkUpload(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// Minimal CSV parser — handles quoted fields containing commas (the common
// case when exporting a roster from Excel/Sheets), no external dependency.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "member name"],
  email: ["email", "email address"],
  phone: ["phone", "phone number"],
  whatsapp: ["whatsapp", "whatsapp number"],
  role: ["role", "position"],
  chapter: ["chapter"],
  dob: ["dob", "date of birth", "birthday"],
};

type BulkRow = { name: string; email: string; phone?: string; whatsapp?: string; role?: string; chapter?: string; dob?: string };

function parseBulkCsv(text: string): { rows: BulkRow[]; invalidCount: number; headerError: string | null } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], invalidCount: 0, headerError: "The file looks empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const colIndex: Partial<Record<keyof typeof COLUMN_ALIASES, number>> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx !== -1) (colIndex as any)[key] = idx;
  }
  if (colIndex.name == null || colIndex.email == null) {
    return {
      rows: [],
      invalidCount: 0,
      headerError: 'First row must be a header with at least "Name" and "Email" columns.',
    };
  }

  let invalidCount = 0;
  const rows: BulkRow[] = [];
  for (const line of table.slice(1)) {
    const get = (key: keyof typeof COLUMN_ALIASES) => {
      const idx = (colIndex as any)[key];
      return idx == null ? "" : (line[idx] ?? "").trim();
    };
    const name = get("name");
    const email = get("email");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalidCount++;
      continue;
    }
    const dobRaw = get("dob");
    rows.push({
      name,
      email,
      phone: get("phone") || undefined,
      whatsapp: get("whatsapp") || undefined,
      role: get("role") || undefined,
      chapter: get("chapter") || undefined,
      dob: /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : undefined,
    });
  }
  return { rows, invalidCount, headerError: null };
}

function BulkUploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof bulkCreateMembers>> | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");
    file.text().then((content) => {
      const parsed = parseBulkCsv(content);
      setRows(parsed.rows);
      setInvalidCount(parsed.invalidCount);
      setParseError(parsed.headerError);
    });
    e.target.value = "";
  }

  async function submit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await bulkCreateMembers({ data: { rows } });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't create members. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-3xl border border-border bg-card p-7 shadow-elegant">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold">Bulk upload members</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a CSV with a header row (Name, Email required — Phone, WhatsApp, Role, Chapter, Date of Birth optional).
              Everyone's added as an active member right away and gets an email to set up their login — no join form, no approval step.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 space-y-4">
          {!result && (
            <>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-6 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-4 w-4" /> {fileName || "Upload a .csv file"}
                <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
              </label>

              {parseError && (
                <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> {parseError}
                </p>
              )}

              {rows.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} member{rows.length === 1 ? "" : "s"} ready to create.
                    {invalidCount > 0 && ` ${invalidCount} row${invalidCount === 1 ? "" : "s"} skipped (missing name or a valid email).`}
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/70 text-left uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Chapter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.email}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{r.chapter || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 50 && (
                      <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                        + {rows.length - 50} more not shown
                      </p>
                    )}
                  </div>
                </>
              )}

              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
                <button
                  onClick={submit}
                  disabled={rows.length === 0 || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> {submitting ? "Creating…" : `Create ${rows.length || ""} member${rows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}

          {result && (
            <>
              <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                <p className="flex items-center gap-1.5 font-semibold"><Check className="h-4 w-4" /> Created {result.created} member{result.created === 1 ? "" : "s"}.</p>
                <p className="mt-1 text-xs text-success/90">{result.emailsSent} login email{result.emailsSent === 1 ? "" : "s"} sent.</p>
                {result.skipped > 0 && (
                  <p className="mt-1 text-xs text-success/90">{result.skipped} skipped — already a member (matched by email).</p>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={onDone} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null);
  const [error, setError] = useState("");

  function parseEmails(raw: string): string[] {
    const found = raw.match(/[^\s,;<>()"]+@[^\s,;<>()"]+\.[^\s,;<>()"]+/g) ?? [];
    return Array.from(new Set(found.map((e) => e.trim().toLowerCase())));
  }

  const emails = parseEmails(text);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((content) => {
      setText((prev) => (prev ? `${prev}\n${content}` : content));
    });
    e.target.value = "";
  }

  async function send() {
    if (emails.length === 0) return;
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await sendInvites({ data: { emails } });
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't send invites. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 shadow-elegant">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold">Invite members</h3>
            <p className="mt-1 text-sm text-muted-foreground">Paste emails or upload a CSV. Each valid email receives the join-form link.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="jane@example.com, john@example.com…"
            className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
          />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-6 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="h-4 w-4" /> Upload a .csv or .txt file
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
          {emails.length > 0 && (
            <p className="text-xs text-muted-foreground">{emails.length} valid email{emails.length === 1 ? "" : "s"} found.</p>
          )}
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {result && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              Sent {result.sent} invite{result.sent === 1 ? "" : "s"}.
              {result.failed.length > 0 && ` ${result.failed.length} failed: ${result.failed.join(", ")}`}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Close</button>
            <button
              onClick={send}
              disabled={emails.length === 0 || sending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send invites"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditMemberModal({
  member,
  chapters,
  roles,
  countries,
  onClose,
  onSave,
}: {
  member: Member;
  chapters: Chapter[];
  roles: string[];
  countries: string[];
  onClose: () => void;
  onSave: (m: Member) => void;
}) {
  const [draft, setDraft] = useState<Member>(member);
  const update = <K extends keyof Member>(k: K, v: Member[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-elegant">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold">Edit member</h3>
            <p className="mt-1 text-sm text-muted-foreground">Update profile details for {member.name}.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => update("name", e.target.value)} className="input" />
          </Field>
          <Field label="Email">
            <input value={draft.email} onChange={(e) => update("email", e.target.value)} className="input" />
          </Field>
          <Field label="Phone">
            <input value={draft.phone} onChange={(e) => update("phone", e.target.value)} className="input" />
          </Field>
          <Field label="WhatsApp">
            <input value={draft.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} className="input" />
          </Field>
          <Field label="Date of birth">
            <input type="date" value={draft.dob} onChange={(e) => update("dob", e.target.value)} className="input" />
          </Field>
          <Field label="Role">
            <input list="role-options" value={draft.role} onChange={(e) => update("role", e.target.value)} className="input" />
            <datalist id="role-options">
              {roles.map((r) => (<option key={r} value={r} />))}
            </datalist>
          </Field>
          <Field label="Chapter">
            <select value={draft.chapterId} onChange={(e) => update("chapterId", e.target.value)} className="input">
              <option value="">No chapter</option>
              {chapters.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </Field>
          <Field label="Country">
            <input list="country-options" value={draft.country} onChange={(e) => update("country", e.target.value)} className="input" />
            <datalist id="country-options">
              {countries.map((c) => (<option key={c} value={c} />))}
            </datalist>
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={(e) => update("status", e.target.value)} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancel</button>
          <button
            onClick={() => onSave(draft)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Save className="h-3.5 w-3.5" /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label}
      <div className="[&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-border [&_.input]:bg-background [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm [&_.input]:font-normal [&_.input]:normal-case [&_.input]:tracking-normal [&_.input]:text-foreground [&_.input]:outline-none focus-within:[&_.input]:border-ring">
        {children}
      </div>
    </label>
  );
}
