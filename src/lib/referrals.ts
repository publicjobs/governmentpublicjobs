import { format, startOfDay, subDays } from "date-fns";

/** Count successful referrals per calendar day for the last `days` days (newest first). */
export function referralsByDay(joinedAt: string[], days: number, now: Date = new Date()) {
  const counts = new Map<string, number>();
  for (const iso of joinedAt) {
    const key = format(new Date(iso), "yyyy-MM-dd");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const d = subDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    return { date: d, key, count: counts.get(key) ?? 0 };
  });
}

export function inviteLink(origin: string, code: string): string {
  return `${origin}/r/${encodeURIComponent(code)}`;
}
