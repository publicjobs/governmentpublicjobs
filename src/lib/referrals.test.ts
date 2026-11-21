import { describe, expect, it } from "vitest";
import { inviteLink, referralsByDay } from "./referrals";

describe("referrals", () => {
  it("counts each successful referral on the day the friend joined", () => {
    const now = new Date(2026, 10, 20, 15, 0);
    const days = referralsByDay(
      [new Date(2026, 10, 20, 9).toISOString(), new Date(2026, 10, 20, 11).toISOString(), new Date(2026, 10, 18, 8).toISOString()],
      3,
      now,
    );
    expect(days.map((d) => d.count)).toEqual([2, 0, 1]);
  });

  it("builds a short invite link with the code", () => {
    expect(inviteLink("https://example.com", "ab12cd34")).toBe("https://example.com/r/ab12cd34");
  });
});
