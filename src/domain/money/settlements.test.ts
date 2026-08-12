import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { prepareSettlement, settlementAmount } from "./settlements";
import { asMemberId } from "./values";

describe("settlementAmount", () => {
  it("uses the complete outstanding balance for a full settlement", () => {
    expect(
      settlementAmount({
        outstandingCents: 2_345,
        mode: "full",
        requestedCents: null,
      }),
    ).toBe(2_345);
  });

  it("rejects a partial settlement above the outstanding balance", () => {
    expect(() =>
      settlementAmount({
        outstandingCents: 2_345,
        mode: "partial",
        requestedCents: 2_346,
      }),
    ).toThrow(/within the current balance/);
  });

  it("never lets a valid partial settlement flip the balance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (outstanding, requested) => {
          const bounded = (requested % outstanding) + 1;
          const amount = settlementAmount({
            outstandingCents: outstanding,
            mode: "partial",
            requestedCents: bounded,
          });
          expect(amount).toBeGreaterThan(0);
          expect(outstanding - amount).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

const debtorId = asMemberId("debtor");
const creditorId = asMemberId("creditor");

describe("prepareSettlement", () => {
  it("derives a full settlement from the locked debtor balance", () => {
    expect(
      prepareSettlement({
        balances: [
          { memberId: creditorId, receivableCents: 2_345 },
          { memberId: debtorId, receivableCents: -2_345 },
        ],
        payerMemberId: debtorId,
        mode: "full",
        requestedCents: 1,
      }),
    ).toEqual({ amountCents: 2_345, debtorMemberId: debtorId });
  });

  it("rejects a second full settlement against a zeroed ledger", () => {
    expect(() =>
      prepareSettlement({
        balances: [
          { memberId: creditorId, receivableCents: 0 },
          { memberId: debtorId, receivableCents: 0 },
        ],
        payerMemberId: debtorId,
        mode: "full",
        requestedCents: null,
      }),
    ).toThrow(/already settled up/);
  });

  it("never lets a derived settlement reverse who owes whom", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (outstanding) => {
        const posted = prepareSettlement({
          balances: [
            { memberId: creditorId, receivableCents: outstanding },
            { memberId: debtorId, receivableCents: -outstanding },
          ],
          payerMemberId: debtorId,
          mode: "full",
          requestedCents: outstanding + 1,
        });
        expect(posted.amountCents).toBe(outstanding);
        expect(-outstanding + posted.amountCents).toBe(0);
      }),
    );
  });
});
