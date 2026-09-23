export const FLAME_REWARDS = [{ days: 5, amount: 150 }, { days: 10, amount: 300 }] as const;

export function krasnoyarskDay(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Krasnoyarsk", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function previousDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(days: string[], today: string) {
  let cursor = days[0] === today ? today : previousDay(today);
  let streak = 0;
  for (const day of days) {
    if (day !== cursor) break;
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export function milestoneForStreak(streak: number) {
  return FLAME_REWARDS.find((reward) => reward.days === streak) ?? null;
}
