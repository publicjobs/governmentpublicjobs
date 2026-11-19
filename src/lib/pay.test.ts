import { describe, expect, it } from "vitest";
import { dailyEquivalent, formatPay, meetsExpectedPay } from "./pay";

describe("pay helpers", () => {
  it("formats Kenyan shillings with the pay period", () => {
    expect(formatPay(15000, "month")).toBe("KSh 15,000 / month");
  });

  it("converts monthly pay to a daily amount over 26 working days", () => {
    expect(dailyEquivalent(26000, "month")).toBe(1000);
  });

  it("flags a job that meets the expected daily pay", () => {
    expect(meetsExpectedPay(700, "day", 600)).toBe(true);
    expect(meetsExpectedPay(500, "day", 600)).toBe(false);
  });
});
