import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  parseChfToCentimes,
  parseExpenseForm,
  parseGroceryForm,
  parseMealForm,
  parseOpeningBalanceForm,
  parseRoutineForm,
  parseSettlementForm,
} from "./m7";

const firstMember = "11111111-1111-4111-8111-111111111111";
const secondMember = "22222222-2222-4222-8222-222222222222";
const areaId = "33333333-3333-4333-8333-333333333333";
const idempotencyKey = "44444444-4444-4444-8444-444444444444";

describe("M7 form parsing", () => {
  it("parses CHF without floating-point arithmetic", () => {
    expect(parseChfToCentimes("12")).toBe(1200);
    expect(parseChfToCentimes("12.3")).toBe(1230);
    expect(parseChfToCentimes("12,34")).toBe(1234);
    expect(() => parseChfToCentimes("12.345")).toThrow(/two decimal/);
  });

  it("round-trips household amounts as exact centimes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999_999 }), (centimes) => {
        const amount = `${Math.floor(centimes / 100)}.${String(centimes % 100).padStart(2, "0")}`;
        expect(parseChfToCentimes(amount)).toBe(centimes);
      }),
    );
  });

  it("maps a weekly assigned routine to the database schedule contract", () => {
    const form = new FormData();
    form.set("title", "Clean the kitchen");
    form.set("areaId", areaId);
    form.set("assignmentPolicy", "assigned");
    form.set("memberId", firstMember);
    form.set("scheduleMode", "weekly");
    form.set("weeklyWeekday", "6");
    form.set("priority", "cleaning");

    expect(parseRoutineForm(form)).toMatchObject({
      assignmentPolicy: "assigned",
      assignedMemberId: firstMember,
      rotationAnchorMemberId: null,
      scheduleKind: "calendar",
      scheduleRule: { kind: "weekly", weekday: 6 },
    });
  });

  it("rejects an exact split that does not equal the expense", () => {
    const form = expenseForm("10.00", "exact");
    form.set(`allocation:${firstMember}`, "6.00");
    form.set(`allocation:${secondMember}`, "5.00");
    expect(() => parseExpenseForm(form, [firstMember, secondMember])).toThrow(
      /sum to the event amount/,
    );
  });

  it("normalizes grocery fields without combining quantity and unit", () => {
    const form = new FormData();
    form.set("name", "  Oat milk  ");
    form.set("quantity", " 2 ");
    form.set("unit", "cartons");
    expect(parseGroceryForm(form)).toEqual({
      name: "Oat milk",
      quantity: "2",
      unit: "cartons",
      categoryId: null,
      note: null,
    });
  });

  it("parses meal placement and optional library save", () => {
    const form = new FormData();
    form.set("title", "Pasta");
    form.set("date", "2026-08-14");
    form.set("slot", "dinner");
    form.set("recipeUrl", "https://example.test/pasta");
    form.set("saveToLibrary", "on");
    form.set("idempotencyKey", idempotencyKey);
    expect(parseMealForm(form)).toMatchObject({
      title: "Pasta",
      date: "2026-08-14",
      slot: "dinner",
      saveToLibrary: true,
    });
  });

  it("parses opening and partial settlement events in integer centimes", () => {
    const opening = new FormData();
    opening.set("creditorMemberId", firstMember);
    opening.set("amount", "12.34");
    opening.set("occurredOn", "2026-08-12");
    opening.set("idempotencyKey", idempotencyKey);
    expect(parseOpeningBalanceForm(opening).amountCents).toBe(1234);

    const settlement = new FormData();
    settlement.set("mode", "partial");
    settlement.set("amount", "4.56");
    settlement.set("occurredOn", "2026-08-12");
    settlement.set("idempotencyKey", idempotencyKey);
    expect(parseSettlementForm(settlement).amountCents).toBe(456);
  });

  it("assigns every odd centime to the payer share under 50/50", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000_001 }), (amountCents) => {
        const form = expenseForm(
          `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`,
          "equal",
        );
        const parsed = parseExpenseForm(form, [firstMember, secondMember]);
        const payer = parsed.allocations.find(
          (allocation) => allocation.memberId === firstMember,
        );
        const other = parsed.allocations.find(
          (allocation) => allocation.memberId === secondMember,
        );
        expect(payer?.allocatedCents).toBe(Math.ceil(amountCents / 2));
        expect(other?.allocatedCents).toBe(Math.floor(amountCents / 2));
        expect(
          parsed.allocations.reduce(
            (total, allocation) => total + allocation.allocatedCents,
            0,
          ),
        ).toBe(amountCents);
      }),
    );
  });
});

function expenseForm(amount: string, splitMode: "equal" | "exact"): FormData {
  const form = new FormData();
  form.set("description", "Groceries");
  form.set("amount", amount);
  form.set("payerMemberId", firstMember);
  form.set("splitMode", splitMode);
  form.set("occurredOn", "2026-08-12");
  form.set("idempotencyKey", idempotencyKey);
  return form;
}
