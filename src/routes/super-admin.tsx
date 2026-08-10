import { createFileRoute, redirect } from "@tanstack/react-router";
import { SuperAdminShell } from "@/components/super-admin-shell";
import { me } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — Kommunity" }] }),
  beforeLoad: async () => {
    const user = await me();
    if (!user) throw redirect({ to: "/login" });
    if (!user.isSuperAdmin) throw redirect({ to: "/admin" });
    return { user };
  },
  component: SuperAdminShell,
});
