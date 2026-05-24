import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Console — Kinfolk" }] }),
  component: AdminShell,
});
