import { createFileRoute, redirect } from "@tanstack/react-router";
import { MemberShell } from "@/components/member-shell";
import { me } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/member")({
  head: () => ({ meta: [{ title: "Member Portal — Kinfolk" }] }),
  beforeLoad: async () => {
    // Real member accounts exist now (created via the "set your password"
    // invite email sent when an admin approves a join application). We
    // still don't restrict this route to isMember-only, though — community
    // admins can view their own member portal too, which is intentional.
    const user = await me();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: MemberShell,
});
