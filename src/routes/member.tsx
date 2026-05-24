import { createFileRoute } from "@tanstack/react-router";
import { MemberShell } from "@/components/member-shell";

export const Route = createFileRoute("/member")({
  head: () => ({ meta: [{ title: "Member Portal — Kinfolk" }] }),
  component: MemberShell,
});
