import { expect, it } from "vitest";
import { parseCostRoute } from "./cost-route";
import { costExpenseHref, costTargetHref } from "@/domain/money/cost-target";
const id = "00000000-0000-4000-8000-000000000001";
const bookingId = "00000000-0000-4000-8000-000000000002";
it("keeps booking scope through cost and payment navigation", () => {
  const route = parseCostRoute(
    { kind: "project", id },
    { booking: bookingId, beforeOn: "2026-09-05", beforeId: id },
  );
  expect(route.before).toEqual({ occurred_on: "2026-09-05", id });
  expect(costTargetHref(route.target)).toBe(
    `/money/contexts/project/${id}?booking=${bookingId}`,
  );
  expect(costExpenseHref(route.target)).toBe(
    `/money/contexts/project/${id}/new?booking=${bookingId}`,
  );
});
it("rejects ambiguous, partial and foreign-kind route scopes", () => {
  for (const query of [
    { booking: [bookingId, id] },
    { beforeOn: "2026-09-05" },
    { beforeId: id },
    { beforeOn: "2026-02-31", beforeId: id },
  ]) {
    expect(() => parseCostRoute({ kind: "project", id }, query)).toThrow();
  }
  expect(() =>
    parseCostRoute({ kind: "asset", id }, { booking: bookingId }),
  ).toThrow();
  expect(() => parseCostRoute({ kind: "__proto__", id }, {})).toThrow();
  expect(() => costTargetHref({ kind: "project", id: "../../home" })).toThrow();
});
