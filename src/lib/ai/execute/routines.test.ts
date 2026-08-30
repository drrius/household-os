import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { ROUTINE_HANDLERS } from "@/lib/ai/execute/routines";

const ROUTINE = "11111111-1111-4111-8111-111111111111";
const AREA = "22222222-2222-4222-8222-222222222222";
const PET = "33333333-3333-4333-8333-333333333333";

const ROUTINE_ROW = {
  active_from: "2026-08-01",
  active_until: "2026-12-31",
  area_id: AREA,
  pet_id: PET,
};

vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({
    userId: "member-1",
    householdId: "household-1",
    displayName: "Darius",
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: ROUTINE_ROW, error: null }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/routines/commands", () => ({
  archiveRoutine: vi.fn(),
  completeOccurrence: vi.fn(),
  createRoutine: vi.fn(),
  pauseRoutine: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  skipOccurrence: vi.fn(),
  unpauseRoutine: vi.fn(),
  updateRoutineDefinition: vi.fn(async (input: unknown) => ({ input })),
}));

import { updateRoutineDefinition } from "@/lib/routines/commands";

const context = { idempotencyKey: "ai:test:call-1", today: "2026-08-31" };

function updateRoutine(raw: Record<string, unknown>) {
  const definition = getAiToolDefinition("update_routine");
  if (definition === null) {
    throw new Error("missing update_routine definition");
  }
  const handler = ROUTINE_HANDLERS.update_routine;
  if (handler === undefined) {
    throw new Error("missing update_routine handler");
  }
  return handler(definition.inputSchema.parse(raw), context);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("update_routine coupled parameters", () => {
  it("keeps the stored pet when only the area changes", async () => {
    const OTHER_AREA = "44444444-4444-4444-8444-444444444444";
    await updateRoutine({ routineId: ROUTINE, areaId: OTHER_AREA });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: OTHER_AREA, petId: PET }),
    );
  });

  it("clears one window boundary while preserving the other", async () => {
    await updateRoutine({ routineId: ROUTINE, activeUntil: null });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        activeFrom: ROUTINE_ROW.active_from,
        activeUntil: null,
      }),
    );
  });

  it("supplies the stored area when only the pet is cleared", async () => {
    await updateRoutine({ routineId: ROUTINE, petId: null });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: AREA, petId: null }),
    );
  });

  it("refuses a clear that the RPC would silently ignore", async () => {
    await expect(
      updateRoutine({
        routineId: ROUTINE,
        activeFrom: null,
        activeUntil: null,
      }),
    ).rejects.toThrow(/not supported in one step/);
    expect(updateRoutineDefinition).not.toHaveBeenCalled();
  });

  it("leaves untouched fields alone on a plain rename", async () => {
    await updateRoutine({ routineId: ROUTINE, title: "New title" });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New title",
        petId: undefined,
        activeFrom: null,
        activeUntil: null,
      }),
    );
  });
});
