import { useState } from "react";
import { KeyRound, Loader2, Check } from "lucide-react";
import { changePassword } from "@/lib/auth/auth.functions";

// Self-contained "change your password" card for any signed-in user — dropped
// into the member profile and admin settings pages.
export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    setSaving(true);
    try {
      await changePassword({ data: { currentPassword: current, newPassword: next } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => setDone(false), 4000);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent" />
        <h2 className="font-display text-lg font-bold">Change password</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        You'll stay signed in on this device; any other devices will be signed out.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Current password</label>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">New password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm new password</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {done && <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">Password updated.</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !current || !next || !confirm}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
