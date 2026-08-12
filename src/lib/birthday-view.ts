// Decides how a member's birthday appears on the admin dashboard's list:
//  - keep it only until 2 days after the birthday, then clear it;
//  - "Sent" once the message has gone out this year, "Scheduled" while it's
//    still upcoming/today-unsent, "Missed" if the day passed without a send.
// All math is in UTC to match the app's timezone-safe date handling. `now` is
// injectable for testing.
export type BirthdayLabel = "Sent" | "Scheduled" | "Missed";

export function birthdayView(
  dob: string,
  sentThisYear: boolean,
  now: Date = new Date(),
): { show: boolean; label: BirthdayLabel } {
  const [, month, day] = dob.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bday = Date.UTC(now.getUTCFullYear(), (month || 1) - 1, day || 1);
  const daysSince = Math.round((today - bday) / 86_400_000);
  const show = daysSince <= 2; // future, today, or up to 2 days after
  if (sentThisYear) return { show, label: "Sent" };
  if (daysSince > 0) return { show, label: "Missed" };
  return { show, label: "Scheduled" };
}
