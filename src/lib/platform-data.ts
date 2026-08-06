// Data for the Super Admin (platform) portal. Cleared for a fresh start —
// no seeded communities, admins, revenue history, audit log, or tickets.
// Plan tier definitions (pricing/module config) are kept since they're
// product configuration, not placeholder records; their subscription counts
// are zeroed.

export const platformStats = {
  totalCommunities: 0,
  activeCommunities: 0,
  trialCommunities: 0,
  totalMembers: 0,
  mrrUSD: 0,
  arrUSD: 0,
  churnRate: 0,
  newCommunities30d: 0,
};

export type PlanTier = "Starter" | "Growth" | "Enterprise";

export const plans: {
  tier: PlanTier;
  priceMonthly: number;
  memberLimit: number | "Unlimited";
  modules: string[];
  activeSubscriptions: number;
}[] = [
  {
    tier: "Starter",
    priceMonthly: 29,
    memberLimit: 100,
    modules: ["Membership", "Birthdays", "Broadcasts"],
    activeSubscriptions: 0,
  },
  {
    tier: "Growth",
    priceMonthly: 99,
    memberLimit: 500,
    modules: ["Membership", "Birthdays", "Broadcasts", "Dues", "Call Tree", "Onboarding Form"],
    activeSubscriptions: 0,
  },
  {
    tier: "Enterprise",
    priceMonthly: 299,
    memberLimit: "Unlimited",
    modules: [
      "Membership",
      "Birthdays",
      "Broadcasts",
      "Dues",
      "Call Tree",
      "Onboarding Form",
      "Donations",
      "Elections",
      "Custom Roles",
      "Priority Support",
    ],
    activeSubscriptions: 0,
  },
];

export const allModules = [
  "Membership",
  "Birthdays",
  "Broadcasts",
  "Dues",
  "Call Tree",
  "Onboarding Form",
  "Donations",
  "Elections",
  "Custom Roles",
  "Priority Support",
];

export const communities: {
  id: string;
  name: string;
  type: string;
  plan: string;
  members: number;
  status: string;
  country: string;
  joined: string;
  mrr: number;
  owner: string;
}[] = [];

export const platformAdmins: {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
}[] = [];

export const revenueByMonth: { month: string; usd: number }[] = [];

export const auditLog: {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}[] = [];

export const supportTickets: {
  id: string;
  community: string;
  subject: string;
  priority: string;
  status: string;
  opened: string;
}[] = [];
