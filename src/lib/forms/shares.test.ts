import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatCentimesField } from "@/domain/money/chf";

import { exactSharesBalance, reconcileShares } from "./shares";

const firstMember = "11111111-1111-4111-8111-111111111111";
const secondMember = "22222222-2222-4222-8222-222222222222";
const maxCentimes = 999_999_999_999_999;

describe("reconcileShares", () => {
  it("reports the running total while a share is still blank", () => {
    expect(reconcileShares("12.00", ["10.00", ""])).toEqual({
      amountCents: 1200,
      differenceCents: -200,
      filledShareCount: 1,
      shareCount: 2,
      sharesCents: 1000,
    });
  });

  it("reports how far a complete split is short of or over the amount", () => {
    expect(reconcileShares("12.00", ["10.00", "0.00"])?.differenceCents).toBe(
      -200,
    );
    expect(reconcileShares("12.00", ["10.00", "4.00"])?.differenceCents).toBe(
      200,
    );
  });

  it("cannot be read when the amount or a filled share is not CHF", () => {
    expect(reconcileShares("abc", ["7.00", "5.00"])).toBeNull();
    expect(reconcileShares("12.00", ["7.00", "5x"])).toBeNull();
  });

  it("keeps every reported total in safe integer centimes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: maxCentimes }),
        fc.integer({ min: 0, max: maxCentimes }),
        fc.integer({ min: 0, max: maxCentimes }),
        (amountCents, payerCents, otherCents) => {
          const reconciliation = reconcileShares(
            formatCentimesField(amountCents),
            [formatCentimesField(payerCents), formatCentimesField(otherCents)],
          );
          expect(reconciliation).not.toBeNull();
          expect(Number.isSafeInteger(reconciliation?.sharesCents)).toBe(true);
          expect(Number.isSafeInteger(reconciliation?.differenceCents)).toBe(
            true,
          );
        },
      ),
    );
  });
});

describe("exactSharesBalance", () => {
  it("uses the ledger allocation rule once both shares parse", () => {
    expect(
      exactSharesBalance({
        amountCents: 1200,
        memberIds: [firstMember, secondMember],
        payerMemberId: firstMember,
        sharesCents: [700, 500],
      }),
    ).toBe(true);
    expect(
      exactSharesBalance({
        amountCents: 1200,
        memberIds: [firstMember, secondMember],
        payerMemberId: firstMember,
        sharesCents: [700, 400],
      }),
    ).toBe(false);
  });
});
