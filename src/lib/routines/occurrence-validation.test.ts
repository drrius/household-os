import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ info: vi.fn(), read: vi.fn() }));
const household = "f0000000-0000-4000-8000-000000000001";
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: async () => ({
    householdId: "f0000000-0000-4000-8000-000000000001",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    storage: { from: () => ({ info: mock.info }) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: mock.read }) }),
      }),
    }),
  }),
}));
import {
  validateCompletionPhoto,
  validateRescheduleDate,
} from "./occurrence-validation";
beforeEach(() => vi.resetAllMocks());
it("rejects PDFs, different purposes, and another household before storage lookup", async () => {
  for (const path of [
    `${household}/receipts/${household}.jpg`,
    `${household}/completions/${household}.pdf`,
    `f0000000-0000-4000-8000-000000000002/completions/${household}.jpg`,
  ])
    await expect(validateCompletionPhoto(path)).rejects.toMatchObject({
      field: "photoPath",
    });
  expect(mock.info).not.toHaveBeenCalled();
});
it("requires an existing image with a supported storage MIME type", async () => {
  const path = `${household}/completions/${household}.jpg`;
  mock.info.mockResolvedValue({ data: null, error: {} });
  await expect(validateCompletionPhoto(path)).rejects.toMatchObject({
    field: "photoPath",
  });
  mock.info.mockResolvedValue({
    data: { metadata: { mimetype: "application/pdf" } },
    error: null,
  });
  await expect(validateCompletionPhoto(path)).rejects.toMatchObject({
    field: "photoPath",
  });
  mock.info.mockResolvedValue({
    data: { contentType: "image/jpeg" },
    error: null,
  });
  await expect(validateCompletionPhoto(path)).resolves.toBeUndefined();
});
it("compares reschedule dates to the authorized stored occurrence", async () => {
  mock.read.mockResolvedValue({
    data: { due_date: "2026-09-05" },
    error: null,
  });
  await expect(
    validateRescheduleDate(household, "2026-09-05"),
  ).rejects.toMatchObject({ field: "newDueDate" });
  await expect(
    validateRescheduleDate(household, "2026-09-06"),
  ).resolves.toBeUndefined();
});
