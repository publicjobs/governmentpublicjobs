export type PayPeriod = "hour" | "day" | "week" | "month" | string;

const WORK_DAYS_PER_MONTH = 26;

export function formatKsh(amount: number): string {
  return `KSh ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function formatPay(amount: number, period: PayPeriod): string {
  return `${formatKsh(amount)} / ${period}`;
}

/** Convert any pay period to an approximate daily amount (8-hour day, 6-day week, 26-day month). */
export function dailyEquivalent(amount: number, period: PayPeriod): number {
  switch (period) {
    case "hour":
      return amount * 8;
    case "week":
      return amount / 6;
    case "month":
      return amount / WORK_DAYS_PER_MONTH;
    default:
      return amount;
  }
}

/** A job "meets your pay" when its daily equivalent is at least the user's expected daily pay. */
export function meetsExpectedPay(
  amount: number,
  period: PayPeriod,
  expectedDaily: number | null | undefined,
): boolean {
  if (!expectedDaily || expectedDaily <= 0) return false;
  return dailyEquivalent(amount, period) >= expectedDaily;
}
