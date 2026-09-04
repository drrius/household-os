import { describe, expect, it } from "vitest";
import { parseRefundForm } from "@/lib/forms/money-refund";
import { parseRecurringRuleForm } from "@/lib/forms/money-recurring";
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
function data(values: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({
    amount: "10.01",
    [`allocation:${a}`]: "5.01",
    [`allocation:${b}`]: "5.00",
    eventId: a,
    idempotencyKey: b,
    occurredOn: "2027-02-28",
    description: "Returned groceries",
    refundSplit: "original",
    payerMemberId: a,
    splitMode: "equal",
    scheduleKind: "monthly",
    dayOfMonth: "31",
    ...values,
  }).forEach(([key, value]) => form.set(key, value));
  return form;
}
describe("Money workflow forms", () => {
  const remaining = [
    { memberId: a, allocatedCents: 501 },
    { memberId: b, allocatedCents: 500 },
  ];
  it("submits the displayed refund allocations unchanged on retries", () => {
    const parsed = parseRefundForm(data(), remaining);
    expect(parsed.allocations).toEqual(remaining);
    expect(parsed.amountCents).toBe(1001);
    expect(parseRefundForm(data(), remaining)).toEqual(parsed);
  });
  it("rejects over-refunds, excessive shares, and mismatched shares", () => {
    expect(() =>
      parseRefundForm(data({ amount: "10.02" }), remaining),
    ).toThrow();
    expect(() =>
      parseRefundForm(
        data({ [`allocation:${a}`]: "5.02", [`allocation:${b}`]: "4.99" }),
        remaining,
      ),
    ).toThrow(/exceeds/);
    expect(() =>
      parseRefundForm(data({ [`allocation:${a}`]: "5.00" }), remaining),
    ).toThrow(/add up/);
  });
  it("retains month-end intent and rejects misaligned next dates", () => {
    expect(parseRecurringRuleForm(data(), [a, b]).schedule).toEqual({
      kind: "monthly",
      dayOfMonth: 31,
    });
    expect(() =>
      parseRecurringRuleForm(data({ occurredOn: "2027-03-28" }), [a, b]),
    ).toThrow(/next draft date/);
    expect(
      parseRecurringRuleForm(
        data({ scheduleKind: "weekly", occurredOn: "2027-03-01" }),
        [a, b],
      ).schedule,
    ).toEqual({ kind: "weekly", isoWeekday: 1 });
  });
});
