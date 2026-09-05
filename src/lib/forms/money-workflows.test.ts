import fc from "fast-check";
import { chfAmountMessage } from "@/domain/money/chf";
import { FormFieldError } from "@/lib/forms/field-error";
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
  it("rejects a negative exact share even when the total and upper bounds match", () => {
    const form = data({
      amount: "10.00",
      refundSplit: "exact",
      [`allocation:${a}`]: "-0.01",
      [`allocation:${b}`]: "10.01",
    });
    expect(() =>
      parseRefundForm(form, [
        { memberId: a, allocatedCents: 2000 },
        { memberId: b, allocatedCents: 2000 },
      ]),
    ).toThrow(new FormFieldError(`allocation:${a}`, chfAmountMessage));
  });
  it("rejects arbitrary negative shares on either member without rejecting valid zero shares", () => {
    const chf = (cents: number) =>
      `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 1, max: 1000000 }),
        fc.boolean(),
        (amount, negative, swap) => {
          const first = swap ? b : a;
          const second = swap ? a : b;
          const available = [a, b].map((memberId) => ({
            memberId,
            allocatedCents: amount + negative,
          }));
          const form = data({
            amount: chf(amount),
            refundSplit: "exact",
            [`allocation:${first}`]: `-${chf(negative)}`,
            [`allocation:${second}`]: chf(amount + negative),
          });
          expect(() => parseRefundForm(form, available)).toThrow(
            new FormFieldError(`allocation:${first}`, chfAmountMessage),
          );
          form.set(`allocation:${first}`, "0.00");
          form.set(`allocation:${second}`, chf(amount));
          const result = parseRefundForm(form, available);
          expect(
            result.allocations.every((share) => share.allocatedCents >= 0),
          ).toBe(true);
          expect(
            result.allocations.reduce(
              (sum, share) => sum + share.allocatedCents,
              0,
            ),
          ).toBe(amount);
        },
      ),
    );
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
