import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { formatCentimesField } from "@/domain/money/chf";
import { parseShoppingForm } from "./shopping";

const members: [string, string] = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
];
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    sessionId: "10000000-0000-4000-8000-000000000001",
    idempotencyKey: "20000000-0000-4000-8000-000000000001",
    occurredOn: "2026-09-05",
    ...values,
  }))
    result.set(key, value);
  return result;
}

describe("shopping checkout", () => {
  it("finishes without creating a financial proposal unless explicitly selected", () => {
    const parsed = parseShoppingForm(
      form({ receiptTotal: "42.10", amount: "30" }),
      members,
    );
    expect(parsed).toMatchObject({
      receiptTotalCents: 4210,
      createExpenseDraft: false,
      sharedAmountCents: null,
      payerMemberId: null,
      proposedAllocations: [],
    });
  });

  it("keeps the receipt total independent from the shared amount and exact split", () => {
    const parsed = parseShoppingForm(
      form({
        receiptTotal: "104.80",
        createExpenseDraft: "on",
        description: "Coop",
        amount: "80.01",
        payerMemberId: members[0],
        splitMode: "exact",
        [`allocation:${members[0]}`]: "30.01",
        [`allocation:${members[1]}`]: "50",
      }),
      members,
    );
    expect(parsed.receiptTotalCents).toBe(10480);
    expect(parsed.sharedAmountCents).toBe(8001);
    expect(parsed.proposedAllocations).toEqual([
      { memberId: members[0], allocatedCents: 3001 },
      { memberId: members[1], allocatedCents: 5000 },
    ]);
  });

  it("rejects non-household payers and unbalanced exact shares", () => {
    expect(() =>
      parseShoppingForm(
        form({
          createExpenseDraft: "on",
          description: "Shop",
          amount: "10",
          payerMemberId: "00000000-0000-4000-8000-000000000003",
          splitMode: "equal",
        }),
        members,
      ),
    ).toThrow("household member");
    expect(() =>
      parseShoppingForm(
        form({
          createExpenseDraft: "on",
          description: "Shop",
          amount: "10",
          payerMemberId: members[0],
          splitMode: "exact",
          [`allocation:${members[0]}`]: "6",
          [`allocation:${members[1]}`]: "6",
        }),
        members,
      ),
    ).toThrow("add up");
  });

  it.each(["-1", "1.001", "NaN", "Infinity"])(
    "rejects invalid receipt %s",
    (receiptTotal) => {
      expect(() =>
        parseShoppingForm(form({ receiptTotal }), members),
      ).toThrow();
    },
  );

  it("property: changing receipt amount never changes shared allocations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000000 }),
        fc.integer({ min: 0, max: 10000000 }),
        fc.boolean(),
        (shared, receipt, partnerPaid) => {
          const payer = partnerPaid ? members[1] : members[0];
          const parsed = parseShoppingForm(
            form({
              receiptTotal: formatCentimesField(receipt),
              createExpenseDraft: "on",
              description: "Groceries",
              amount: formatCentimesField(shared),
              payerMemberId: payer,
              splitMode: "equal",
            }),
            members,
          );
          expect(parsed.receiptTotalCents).toBe(receipt);
          expect(parsed.sharedAmountCents).toBe(shared);
          expect(
            parsed.proposedAllocations.reduce(
              (sum, entry) => sum + entry.allocatedCents,
              0,
            ),
          ).toBe(shared);
          expect(
            parsed.proposedAllocations.find((entry) => entry.memberId === payer)
              ?.allocatedCents,
          ).toBe(Math.ceil(shared / 2));
        },
      ),
    );
  });
});
