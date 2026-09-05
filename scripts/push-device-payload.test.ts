import { expect, it } from "vitest";
import { buildPushPayload } from "../supabase/functions/_shared/push-payload.ts";
it("device tests have fixed safe copy and settings URL", () => {
  expect(
    buildPushPayload({
      id: "job",
      kind: "device_test",
      test_subscription_id: "device",
      activity_kind: "https://evil.example",
      entity_type: "financial_event",
    }),
  ).toEqual({
    title: "Household OS test",
    body: "Push is working on this device.",
    url: "/home/notifications",
    notificationId: "job",
    icon: "/icons/icon-192.png",
  });
});
it("ordinary delivery payloads remain unchanged", () => {
  expect(
    buildPushPayload({
      id: "notice",
      kind: "partner_notice",
      activity_kind: "expense_posted",
      entity_type: "financial_event",
    }),
  ).toMatchObject({
    title: "Expense posted",
    url: "/money",
    notificationId: "notice",
  });
  expect(
    buildPushPayload({
      id: "digest",
      kind: "household_digest",
      activity_kind: null,
      entity_type: null,
    }),
  ).toMatchObject({ title: "Household digest", url: "/" });
});
