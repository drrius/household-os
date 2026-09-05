import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { deriveMemberBalances } from "./balances";
import { projectFinancialEvent } from "./projection";
import type { OpeningBalanceEvent, ReversalEvent } from "./types";
import { asCentimeAmount, asFinancialEventId, asMemberId } from "./values";

const a = asMemberId("a");
const b = asMemberId("b");
function opening(id: string, cents: number, creditor = a): OpeningBalanceEvent {
  return {
    id: asFinancialEventId(id),
    type: "opening_balance",
    amountCents: asCentimeAmount(cents),
    payerMemberId: creditor,
    otherMemberId: creditor === a ? b : a,
  };
}
function reverse(event: OpeningBalanceEvent): ReversalEvent {
  return {
    id: asFinancialEventId(`reverse:${event.id}`),
    type: "reversal",
    amountCents: event.amountCents,
    relatedEventId: event.id,
    relatedLedgerEntries: projectFinancialEvent(event),
  };
}
describe("opening correction ledger", () => {
  it("changes creditor without treating the corrected starting amount as an expense allocation", () => {
    const original = opening("original", 1001);
    const replacement = opening("replacement", 2003, b);
    const ledger = [original, reverse(original), replacement].flatMap(
      projectFinancialEvent,
    );
    expect(deriveMemberBalances(ledger)).toEqual(
      new Map([
        [a, -2003],
        [b, 2003],
      ]),
    );
  });
  it("every append-only correction chain equals its final starting amount, including zero and creditor switches", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            cents: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
            switchCreditor: fc.boolean(),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        (changes) => {
          const events = changes.map((change, index) =>
            opening(String(index), change.cents, change.switchCreditor ? b : a),
          );
          const ledger = events.flatMap((event, index) =>
            index < events.length - 1
              ? [event, reverse(event)].flatMap(projectFinancialEvent)
              : projectFinancialEvent(event),
          );
          expect(deriveMemberBalances(ledger)).toEqual(
            deriveMemberBalances(projectFinancialEvent(events.at(-1)!)),
          );
          expect(
            ledger.reduce(
              (sum, entry) => sum + BigInt(entry.receivableDeltaCents),
              0n,
            ),
          ).toBe(0n);
        },
      ),
    );
  });
});
