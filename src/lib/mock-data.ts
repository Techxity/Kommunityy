// Centralized mock data for the frontend prototype
export const community = {
  name: "Crestwood Estate Residents",
  id: "CRE-2024-001",
  type: "Estate",
  plan: "Enterprise",
  trialDaysLeft: 9,
  memberCount: 247,
  activeMembers: 231,
};

export const members = [
  { id: "1", name: "Adaeze Okafor", email: "adaeze@example.com", phone: "+234 803 111 2233", whatsapp: "+234 803 111 2233", dob: "1988-03-12", status: "active", joined: "2023-04-12", role: "President", chapter: "Lagos Chapter", country: "Nigeria" },
  { id: "2", name: "Tunde Bakare", email: "tunde@example.com", phone: "+234 802 555 8899", whatsapp: "+234 802 555 8899", dob: "1979-11-02", status: "active", joined: "2022-01-08", role: "Treasurer", chapter: "London Chapter", country: "United Kingdom" },
  { id: "3", name: "Chiamaka Eze", email: "chiamaka@example.com", phone: "+234 805 222 1010", whatsapp: "+234 805 222 1010", dob: "1992-07-21", status: "active", joined: "2024-02-19", role: "Secretary", chapter: "Enugu Chapter", country: "Nigeria" },
  { id: "4", name: "Femi Adeyemi", email: "femi@example.com", phone: "+234 809 444 7700", whatsapp: "+234 809 444 7700", dob: "1985-05-30", status: "active", joined: "2023-09-30", role: "Member", chapter: "Lagos Chapter", country: "Nigeria" },
  { id: "5", name: "Ngozi Umeh", email: "ngozi@example.com", phone: "+234 701 333 9911", whatsapp: "+234 701 333 9911", dob: "1990-12-04", status: "inactive", joined: "2021-06-14", role: "Member", chapter: "Abuja Chapter", country: "Nigeria" },
  { id: "6", name: "Kola Salami", email: "kola@example.com", phone: "+234 706 999 1212", whatsapp: "+234 706 999 1212", dob: "1995-08-18", status: "active", joined: "2024-08-01", role: "Member", chapter: "Houston Chapter", country: "United States" },
  { id: "7", name: "Amaka Ibe", email: "amaka@example.com", phone: "+234 803 770 4321", whatsapp: "+234 803 770 4321", dob: "1987-02-25", status: "active", joined: "2022-11-22", role: "PRO", chapter: "Port Harcourt Chapter", country: "Nigeria" },
  { id: "8", name: "Yusuf Bello", email: "yusuf@example.com", phone: "+234 808 110 4567", whatsapp: "+234 808 110 4567", dob: "1983-09-09", status: "active", joined: "2023-03-15", role: "Member", chapter: "Abuja Chapter", country: "Nigeria" },
  { id: "9", name: "Amina Bello", email: "amina@example.com", phone: "+234 701 222 3344", whatsapp: "+234 701 222 3344", dob: "1993-01-15", status: "active", joined: "2024-01-10", role: "Member", chapter: "Lagos Chapter", country: "Nigeria" },
  { id: "10", name: "David Okonkwo", email: "david@example.com", phone: "+1 713 555 0198", whatsapp: "+1 713 555 0198", dob: "1980-06-22", status: "inactive", joined: "2023-07-20", role: "Member", chapter: "Houston Chapter", country: "United States" },
  { id: "11", name: "Grace Adeleke", email: "grace@example.com", phone: "+234 805 333 4455", whatsapp: "+234 805 333 4455", dob: "1991-09-30", status: "active", joined: "2022-05-15", role: "Vice President", chapter: "Lagos Chapter", country: "Nigeria" },
  { id: "12", name: "James Osei", email: "james@example.com", phone: "+44 20 7946 0958", whatsapp: "+44 20 7946 0958", dob: "1984-12-12", status: "active", joined: "2024-03-01", role: "Member", chapter: "London Chapter", country: "United Kingdom" },
];

export const callTreePairs = [
  { caller: "Adaeze Okafor", callee: "Tunde Bakare", status: "Doing great", comment: "All well, family is fine." },
  { caller: "Chiamaka Eze", callee: "Femi Adeyemi", status: "Not bad", comment: "Recovering from a cold." },
  { caller: "Kola Salami", callee: "Amaka Ibe", status: "Sick", comment: "Visiting the clinic tomorrow." },
  { caller: "Yusuf Bello", callee: "Ngozi Umeh", status: "Pending", comment: "—" },
];

export const dues = {
  amount: 25000,
  currency: "NGN",
  frequency: "Monthly",
  startDate: "2024-01-01",
  nextDue: "2025-06-01",
};

export const duesHistory = [
  { id: "p1", member: "Adaeze Okafor", amount: 25000, date: "2025-05-01", status: "Paid" },
  { id: "p2", member: "Tunde Bakare", amount: 25000, date: "2025-05-03", status: "Paid" },
  { id: "p3", member: "Chiamaka Eze", amount: 25000, date: "2025-04-28", status: "Paid" },
  { id: "p4", member: "Femi Adeyemi", amount: 25000, date: "—", status: "Missed" },
  { id: "p5", member: "Kola Salami", amount: 25000, date: "2025-05-09", status: "Paid" },
];

export const donations = [
  { id: "d1", purpose: "Borehole Repair Fund", target: 1500000, collected: 920000, currency: "NGN", deadline: "2025-08-15", status: "Active" },
  { id: "d2", purpose: "Christmas Charity Drive", target: 500000, collected: 500000, currency: "NGN", deadline: "2024-12-20", status: "Closed" },
];

export const election = {
  year: 2026,
  status: "Live",
  endsAt: "2025-06-30",
  positions: [
    { role: "President", candidates: [
      { name: "Adaeze Okafor", votes: 124 },
      { name: "Tunde Bakare", votes: 87 },
    ]},
    { role: "Secretary", candidates: [
      { name: "Chiamaka Eze", votes: 142 },
      { name: "Amaka Ibe", votes: 65 },
    ]},
    { role: "Treasurer", candidates: [
      { name: "Yusuf Bello", votes: 98 },
      { name: "Kola Salami", votes: 102 },
    ]},
  ],
};

export const birthdayMessages: Record<string, string> = {
  January: "Wishing you a year of new beginnings and abundant blessings 🎉",
  February: "May your day be as warm as the love we share as a community ❤️",
  March: "Happy birthday! May this year bloom with grace and joy.",
  April: "Celebrating you today and always — happy birthday!",
  May: "May this new year of yours overflow with peace and laughter.",
  June: "Sunshine on your day — happy birthday from all of us!",
  July: "Wishing you health, wealth and many more years 🎂",
  August: "Cheers to you on your special day — keep shining!",
  September: "Happy birthday! May every dream you carry come alive.",
  October: "May the year ahead be your most beautiful chapter yet.",
  November: "Grateful to have you in our community — happy birthday!",
  December: "Ending the year celebrating you. Happy birthday!",
};

export const broadcasts = [
  { id: "b1", title: "Monthly General Meeting", date: "2025-05-20", reach: 231 },
  { id: "b2", title: "Security Update — June", date: "2025-05-30", reach: 228 },
];

export const stats = {
  totalMembers: 247,
  activeMembers: 231,
  birthdaysThisMonth: 14,
  messagesSentThisMonth: 86,
  duesCollectedMTD: 4_125_000,
  openDonations: 1,
  electionsLive: 1,
};
