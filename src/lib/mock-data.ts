// Centralized frontend data. Cleared for a fresh start — no seeded members,
// dues, donations, elections, or broadcasts. Shapes/types are preserved so
// the UI renders empty states instead of crashing.
export const community = {
  name: "",
  id: "",
  type: "",
  plan: "",
  trialDaysLeft: 0,
  memberCount: 0,
  activeMembers: 0,
};

export const members: {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  dob: string;
  status: string;
  joined: string;
  role: string;
  chapter: string;
  country: string;
}[] = [];

export const callTreePairs: {
  caller: string;
  callee: string;
  status: string;
  comment: string;
}[] = [];

export const dues = {
  amount: 0,
  currency: "NGN",
  frequency: "",
  startDate: "",
  nextDue: "",
};

export const duesHistory: {
  id: string;
  member: string;
  amount: number;
  date: string;
  status: string;
}[] = [];

export const donations: {
  id: string;
  purpose: string;
  target: number;
  collected: number;
  currency: string;
  deadline: string;
  status: string;
}[] = [];

export const election = {
  year: new Date().getFullYear(),
  status: "None",
  endsAt: "",
  positions: [] as { role: string; candidates: { name: string; votes: number }[] }[],
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

export const broadcasts: { id: string; title: string; date: string; reach: number }[] = [];

export const stats = {
  totalMembers: 0,
  activeMembers: 0,
  birthdaysThisMonth: 0,
  messagesSentThisMonth: 0,
  duesCollectedMTD: 0,
  openDonations: 0,
  electionsLive: 0,
};
