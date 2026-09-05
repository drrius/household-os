import fc from "fast-check";
import { expect, it } from "vitest";
import { financialHistoryBefore } from "./history-cursor";
const cursor = {
  occurredOn: "2026-09-05",
  createdAt: "2026-09-05T10:00:00.123456+00:00",
  id: "11111111-1111-4111-8111-111111111111",
};
it("retains timestamp precision in the continuation boundary", () => {
  expect(financialHistoryBefore(cursor)).toContain(cursor.createdAt);
});
it("rejects injected filter syntax instead of widening a financial history query", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 40 }), (suffix) => {
      expect(() =>
        financialHistoryBefore({ ...cursor, id: `${cursor.id},${suffix}` }),
      ).toThrow();
      expect(() =>
        financialHistoryBefore({
          ...cursor,
          occurredOn: `${cursor.occurredOn})${suffix}`,
        }),
      ).toThrow();
    }),
  );
});
