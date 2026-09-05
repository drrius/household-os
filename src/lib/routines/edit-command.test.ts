import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), member: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { updateRoutineDefinition } from "./commands";
const baseline = {
  routineId: "00000000-0000-4000-8000-000000000191",
  expectedUpdatedAt: "2026-09-05T12:00:00.123456+00:00",
  idempotencyKey: "routine-edit",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({
    data: { routine_id: baseline.routineId },
    error: null,
  });
});
it("submits null clears and the original baseline in one command without follow-up writes", async () => {
  await updateRoutineDefinition({
    ...baseline,
    instructions: null,
    petId: null,
  });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("edit_routine_definition", {
    p_routine_id: baseline.routineId,
    p_expected_updated_at: baseline.expectedUpdatedAt,
    p_idempotency_key: baseline.idempotencyKey,
    p_patch: { instructions: null, pet_id: null },
  });
});
it("does not serialize omitted coupled fields as clears", async () => {
  await updateRoutineDefinition({
    ...baseline,
    areaId: baseline.routineId,
    activeUntil: null,
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "edit_routine_definition",
    expect.objectContaining({
      p_patch: { area_id: baseline.routineId, active_until: null },
    }),
  );
});
it("keeps conflicts visible instead of reporting success", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "40001", message: "stale" },
  });
  await expect(
    updateRoutineDefinition({ ...baseline, title: "My title" }),
  ).rejects.toThrow("This routine changed. Reopen it before saving.");
});

it("keeps lock contention retryable without falsely declaring a stale form", async () => {
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { code: "55P03", message: "private lock detail" },
  });
  const input = { ...baseline, title: "My title" };
  await expect(updateRoutineDefinition(input)).rejects.toThrow(
    "This routine is being updated. Wait a moment and try saving again.",
  );
  mocks.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
  await expect(updateRoutineDefinition(input)).resolves.toEqual({ ok: true });
  expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
});
