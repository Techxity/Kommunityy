import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/membership/members.functions";

export const Route = createFileRoute("/member/profile")({
  component: Profile,
});

type Me = Awaited<ReturnType<typeof getMyProfile>>;

function Profile() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    getMyProfile().then(setMe);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">My profile</h1>
        <p className="text-sm text-muted-foreground">Your details on file with your community.</p>
      </header>
      {!me ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <p className="text-sm text-muted-foreground">
            {me === undefined ? "Loading…" : "No profile data yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-accent text-xl font-bold text-primary-foreground">
              {me.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{me.name}</h2>
              <p className="text-sm text-muted-foreground">{me.role || "Member"} · member since {me.joined || "—"}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm md:grid-cols-2">
            <Item label="Email" value={me.email || "—"} />
            <Item label="Phone" value={me.phone || "—"} />
            <Item label="WhatsApp" value={me.whatsapp || "—"} />
            <Item label="Date of Birth" value={me.dob || "—"} />
            <Item label="Chapter" value={me.chapter || "—"} />
            <Item label="Joined" value={me.joined || "—"} />
            <Item label="Status" value={me.status} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
