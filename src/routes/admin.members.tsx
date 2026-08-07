import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireModule } from "@/lib/module-gate";

// Pathless layout for /admin/members and its children (e.g. /admin/members/pending).
// TanStack Router nests any `admin.members.*` route file under this one, so it
// must render an <Outlet /> or the child route's component never mounts —
// that was the bug behind the pending-approvals page showing nothing.
// The module gate lives here too, so it covers both children in one place.
export const Route = createFileRoute("/admin/members")({
  beforeLoad: () => requireModule("Membership"),
  component: () => <Outlet />,
});
