// Route-level module gating: blocks a community admin from a feature page
// their plan doesn't include, redirecting to the subscription page instead.
// Add `beforeLoad: () => requireModule("Birthdays")` (etc.) to any gated
// route's createFileRoute config. Super admins and members never hit these
// routes (admin.tsx's own beforeLoad already restricts /admin to
// community_admin/super_admin), so this only needs to reason about modules.
import { redirect } from "@tanstack/react-router";
import { getMyModules } from "@/lib/payments/tiers.functions";

export async function requireModule(moduleName: string): Promise<void> {
  const modules = await getMyModules();
  if (!modules.includes(moduleName)) {
    throw redirect({ to: "/admin/subscription" });
  }
}
