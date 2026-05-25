// Mock data for the Super Admin (platform) portal

export const platformStats = {
  totalCommunities: 184,
  activeCommunities: 162,
  trialCommunities: 22,
  totalMembers: 41_290,
  mrrUSD: 38_540,
  arrUSD: 462_480,
  churnRate: 2.1,
  newCommunities30d: 17,
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
    activeSubscriptions: 74,
  },
  {
    tier: "Growth",
    priceMonthly: 99,
    memberLimit: 500,
    modules: ["Membership", "Birthdays", "Broadcasts", "Dues", "Call Tree", "Onboarding Form"],
    activeSubscriptions: 63,
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
    activeSubscriptions: 47,
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

export const communities = [
  { id: "CRE-2024-001", name: "Crestwood Estate Residents", type: "Estate", plan: "Enterprise", members: 247, status: "Active", country: "Nigeria", joined: "2024-01-12", mrr: 299, owner: "Adaeze Okafor" },
  { id: "LSA-2023-018", name: "Lagos Alumni Network '08", type: "Alumni", plan: "Growth", members: 412, status: "Active", country: "Nigeria", joined: "2023-08-04", mrr: 99, owner: "Emeka Nwosu" },
  { id: "GBO-2024-044", name: "Greenbriar Owners", type: "HOA", plan: "Starter", members: 87, status: "Trial", country: "USA", joined: "2025-05-09", mrr: 0, owner: "Linda Park" },
  { id: "OAK-2022-007", name: "Oakridge Tenants Union", type: "Tenant", plan: "Growth", members: 312, status: "Active", country: "UK", joined: "2022-11-18", mrr: 99, owner: "James Whitfield" },
  { id: "AKM-2024-091", name: "Akoma Mutual Society", type: "Association", plan: "Enterprise", members: 1180, status: "Active", country: "Ghana", joined: "2024-03-22", mrr: 299, owner: "Kwame Asante" },
  { id: "SVH-2025-002", name: "Silver Heights HOA", type: "HOA", plan: "Starter", members: 64, status: "Past Due", country: "Canada", joined: "2025-02-14", mrr: 29, owner: "Margaret Liu" },
  { id: "DLT-2023-051", name: "Delta Tech Cooperative", type: "Cooperative", plan: "Growth", members: 198, status: "Active", country: "Kenya", joined: "2023-12-01", mrr: 99, owner: "Sarah Mwangi" },
  { id: "BLM-2024-029", name: "Bloomsbury Tenants", type: "Tenant", plan: "Starter", members: 52, status: "Suspended", country: "UK", joined: "2024-06-30", mrr: 0, owner: "Oliver Bennett" },
  { id: "VRD-2025-011", name: "Verde Park Residents", type: "Estate", plan: "Trial", members: 41, status: "Trial", country: "Nigeria", joined: "2025-05-18", mrr: 0, owner: "Tochi Eze" },
];

export const platformAdmins = [
  { id: "u1", name: "Daniel Okeke", email: "daniel@kinfolk.app", role: "Super Admin", lastActive: "2 hours ago" },
  { id: "u2", name: "Priya Shah", email: "priya@kinfolk.app", role: "Billing Admin", lastActive: "Yesterday" },
  { id: "u3", name: "Marcus Bell", email: "marcus@kinfolk.app", role: "Support Admin", lastActive: "Just now" },
];

export const revenueByMonth = [
  { month: "Dec", usd: 28_900 },
  { month: "Jan", usd: 30_400 },
  { month: "Feb", usd: 32_100 },
  { month: "Mar", usd: 33_750 },
  { month: "Apr", usd: 36_200 },
  { month: "May", usd: 38_540 },
];

export const auditLog = [
  { id: "a1", actor: "Daniel Okeke", action: "Suspended community", target: "Bloomsbury Tenants", time: "12 min ago" },
  { id: "a2", actor: "Priya Shah", action: "Adjusted plan modules", target: "Growth tier", time: "2 hours ago" },
  { id: "a3", actor: "System", action: "Payment failed", target: "Silver Heights HOA", time: "5 hours ago" },
  { id: "a4", actor: "Marcus Bell", action: "Reset admin password", target: "Crestwood Estate", time: "Yesterday" },
  { id: "a5", actor: "Daniel Okeke", action: "Created plan tier", target: "Enterprise+", time: "3 days ago" },
];

export const supportTickets = [
  { id: "T-2041", community: "Crestwood Estate Residents", subject: "Election results not visible to members", priority: "High", status: "Open", opened: "1 day ago" },
  { id: "T-2040", community: "Greenbriar Owners", subject: "Trial extension request", priority: "Low", status: "Open", opened: "2 days ago" },
  { id: "T-2038", community: "Akoma Mutual Society", subject: "Bulk member import failed", priority: "Medium", status: "In Progress", opened: "3 days ago" },
  { id: "T-2035", community: "Lagos Alumni Network '08", subject: "WhatsApp broadcast delivery delay", priority: "Medium", status: "Resolved", opened: "5 days ago" },
];
