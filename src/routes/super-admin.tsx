import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminShell } from "@/components/super-admin-shell";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — Kinfolk" }] }),
  component: SuperAdminShell,
});
