import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseChfToCentimes } from "@/domain/money/chf";

import { errorField } from "./field-error";
import { parseGroceryForm } from "./grocery";
import {
  draftSplitDefaults,
  parseExpenseForm,
  parseOpeningBalanceForm,
  parseSettlementForm,
} from "./money";
import { parseRoutineForm, routineFormChangesSchedule } from "./routine";

const firstMember = "11111111-1111-4111-8111-111111111111";
const secondMember = "22222222-2222-4222-8222-222222222222";
const areaId = "33333333-3333-4333-8333-333333333333";
const idempotencyKey = "44444444-4444-4444-8444-444444444444";

describe("M7 form parsing", () => {
  it("parses Swiss comma amounts as integer centimes", () => {
    expect(parseChfToCentimes("12,34")).toBe(1234);
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
      /shares need to add up to the total/,
    );
  });

  it("names the control that rejected an amount instead of leaking storage words", () => {
    const shares = expenseForm("10.00", "exact");
    shares.set(`allocation:${firstMember}`, "6.00");
    shares.set(`allocation:${secondMember}`, "5.00");
    expect(
      errorField(
        captureError(() =>
          parseExpenseForm(shares, [firstMember, secondMember]),
        ),
      ),
    ).toBe(`allocation:${firstMember}`);

    const letters = expenseForm("abc", "equal");
    const failure = captureError(() =>
      parseExpenseForm(letters, [firstMember, secondMember]),
    );
    expect(errorField(failure)).toBe("amount");
    expect((failure as Error).message).toMatch(/two decimal/);

    const zero = expenseForm("0.00", "equal");
    expect(
      errorField(
        captureError(() => parseExpenseForm(zero, [firstMember, secondMember])),
      ),
    ).toBe("amount");
  });

  it("ignores the amount field for a full settlement", () => {
    const form = new FormData();
    form.set("mode", "full");
    form.set("occurredOn", "2026-08-12");
    form.set("idempotencyKey", idempotencyKey);
    expect(parseSettlementForm(form).amountCents).toBeNull();
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

  it("initializes exact split mode from a non-equal draft allocation", () => {
    expect(
      draftSplitDefaults(
        1_000,
        firstMember,
        [firstMember, secondMember],
        [
          { memberId: firstMember, allocatedCents: 500 },
          { memberId: secondMember, allocatedCents: 500 },
        ],
      ).mode,
    ).toBe("equal");
    expect(
      draftSplitDefaults(
        1_000,
        firstMember,
        [firstMember, secondMember],
        [
          { memberId: firstMember, allocatedCents: 700 },
          { memberId: secondMember, allocatedCents: 300 },
        ],
      ),
    ).toEqual({
      mode: "exact",
      allocationsByMemberId: {
        [firstMember]: 700,
        [secondMember]: 300,
      },
    });
  });

  it("does not treat a metadata-only routine edit as a schedule change", () => {
    const form = new FormData();
    form.set("title", "Clean the kitchen");
    form.set("areaId", areaId);
    form.set("assignmentPolicy", "assigned");
    form.set("memberId", firstMember);
    form.set("scheduleMode", "weekly");
    form.set("weeklyWeekday", "6");
    form.set("priority", "cleaning");
    const parsed = parseRoutineForm(form);
    expect(
      routineFormChangesSchedule(
        {
          scheduleKind: "calendar",
          scheduleRule: { weekday: 6, kind: "weekly" },
          assignmentPolicy: "assigned",
          assignedMemberId: firstMember,
          rotationAnchorMemberId: null,
        },
        parsed,
      ),
    ).toBe(false);
    form.set("weeklyWeekday", "1");
    expect(
      routineFormChangesSchedule(
        {
          scheduleKind: "calendar",
          scheduleRule: { kind: "weekly", weekday: 6 },
          assignmentPolicy: "assigned",
          assignedMemberId: firstMember,
          rotationAnchorMemberId: null,
        },
        parseRoutineForm(form),
      ),
    ).toBe(true);
  });

  it("treats weekday order as the same schedule", () => {
    const form = new FormData();
    form.set("title", "Walk the dog");
    form.set("areaId", areaId);
    form.set("assignmentPolicy", "shared");
    form.set("scheduleMode", "weekdays");
    form.append("weekdays", "1");
    form.append("weekdays", "5");
    form.set("priority", "pet_care");
    expect(
      routineFormChangesSchedule(
        {
          scheduleKind: "calendar",
          scheduleRule: { kind: "weekdays", days: [5, 1] },
          assignmentPolicy: "shared",
          assignedMemberId: null,
          rotationAnchorMemberId: null,
        },
        parseRoutineForm(form),
      ),
    ).toBe(false);
  });
});

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the parser to reject this form.");
}

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
