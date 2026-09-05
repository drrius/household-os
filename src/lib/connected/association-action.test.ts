import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  assign: vi.fn(),
  refresh: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: mock.redirect,
  unstable_rethrow: (error: Error) => {
    if (error.message.startsWith("redirect:")) throw error;
  },
}));
vi.mock("@/lib/connected/cost-associations", () => ({
  assignExpenseContext: mock.assign,
}));
vi.mock("@/app/(product)/_actions/m7-shared", () => ({
  revalidateProduct: mock.refresh,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { associateExpenseAction } from "@/app/(product)/money/contexts/association-actions";
const id = "00000000-0000-4000-8000-000000000001";
function form() {
  const value = new FormData();
  value.set("expectedRevision", id);
  value.set("requestId", id);
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.assign.mockResolvedValue(undefined);
});
it("passes original confirmation identity and returns within the booking scope", async () => {
  const target = { kind: "project" as const, id, bookingId: id };
  await expect(
    associateExpenseAction(id, target, { submissionId: 0 }, form()),
  ).rejects.toThrow(
    `redirect:/money/contexts/project/${id}?booking=${id}&association=saved`,
  );
  expect(mock.assign).toHaveBeenCalledExactlyOnceWith({
    eventId: id,
    target,
    expectedRevision: id,
    requestId: id,
  });
});
it("removes only the contextual association and returns to the cost index", async () => {
  await expect(
    associateExpenseAction(id, null, { submissionId: 0 }, form()),
  ).rejects.toThrow("redirect:/money/contexts?association=removed");
  expect(mock.assign.mock.calls[0]?.[0].target).toBeNull();
});
it("preserves failed confirmation details and framework authentication redirects", async () => {
  mock.assign.mockRejectedValueOnce(
    new Error("This expense association changed."),
  );
  const state = await associateExpenseAction(
    id,
    null,
    { submissionId: 0 },
    form(),
  );
  expect(state.error).toBe("This expense association changed.");
  expect(state.values).toMatchObject({ expectedRevision: id, requestId: id });
  expect(mock.refresh).not.toHaveBeenCalled();
  expect(mock.redirect).not.toHaveBeenCalled();
  mock.assign.mockRejectedValueOnce(new Error("redirect:/sign-in"));
  await expect(
    associateExpenseAction(id, null, { submissionId: 0 }, form()),
  ).rejects.toThrow("redirect:/sign-in");
});
