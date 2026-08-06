import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pathless layout for /admin/members and its children (e.g. /admin/members/pending).
// TanStack Router nests any `admin.members.*` route file under this one, so it
// must render an <Outlet /> or the child route's component never mounts —
// that was the bug behind the pending-approvals page showing nothing.
export const Route = createFileRoute("/admin/members")({
  component: () => <Outlet />,
});
