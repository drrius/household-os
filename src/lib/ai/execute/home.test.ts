import { beforeEach, expect, it, vi } from "vitest";
import fc from "fast-check";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({ requireMemberContext: vi.fn() }));
vi.mock("@/lib/home-records/commands", () => ({
  saveRecord: vi.fn(),
  archiveRecord: vi.fn(),
  chooseOption: vi.fn(),
  convertDecision: vi.fn(),
  setDecisionStatus: vi.fn(),
}));
import { requireMemberContext } from "@/lib/auth/member-context";
import { saveRecord } from "@/lib/home-records/commands";
import { parseRecord } from "@/domain/home-records/schema";
import { HOME_HANDLERS } from "./home";
const id = "11111111-1111-4111-8111-111111111111";
const context = {
  idempotencyKey: "ai:save_home_options:one",
  today: "2026-09-05",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMemberContext).mockResolvedValue({
    householdId: id,
  } as Awaited<ReturnType<typeof requireMemberContext>>);
  vi.mocked(saveRecord).mockImplementation(async (kind, form) => {
    parseRecord(kind, Object.fromEntries(form));
    return String(form.get("id"));
  });
});
it("preserves every integer-centime estimate through the UI command parser", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 2147483647 }),
      async (amount) => {
        await HOME_HANDLERS.save_home_options!(
          {
            identity: { mode: "create" },
            fields: {
              decision_id: id,
              title: "Option",
              estimated_amount_cents: amount,
            },
          },
          context,
        );
        const [kind, form] = vi.mocked(saveRecord).mock.calls.at(-1)!;
        expect(parseRecord(kind, Object.fromEntries(form))).toMatchObject({
          estimated_amount_cents: amount,
        });
      },
    ),
    { numRuns: 30 },
  );
});
it("passes the read version and keeps the existing identity on edits", async () => {
  await HOME_HANDLERS.save_home_contacts!(
    {
      identity: { mode: "update", id, updatedAt: "2026-09-05T10:00:00Z" },
      fields: { name: "Plumber" },
    },
    context,
  );
  const form = vi.mocked(saveRecord).mock.calls[0]![1];
  expect(form.get("id")).toBe(id);
  expect(form.get("version")).toBe("2026-09-05T10:00:00Z");
});
it("rejects malformed record fields through the existing parser", async () => {
  await expect(
    HOME_HANDLERS.save_home_inventory!(
      {
        identity: { mode: "create" },
        fields: {
          title: "Washer",
          purchased_on: "2026-09-05",
          warranty_until: "2025-09-05",
        },
      },
      context,
    ),
  ).rejects.toThrow("Warranty");
});
