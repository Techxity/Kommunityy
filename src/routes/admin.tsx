import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { me } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — Kommunity" }] }),
  beforeLoad: async () => {
    const user = await me();
    if (!user || (!user.isSuperAdmin && !user.communityAdminOf)) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: AdminShell,
});
