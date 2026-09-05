import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { ROUTINE_HANDLERS } from "@/lib/ai/execute/routines";

const ROUTINE = "11111111-1111-4111-8111-111111111111";

const VERSION = "2026-09-05T12:00:00.123456+00:00";
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => {
    throw new Error("Edit adapters must not substitute a freshly read version");
  }),
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
  return handler(
    definition.inputSchema.parse({ expectedUpdatedAt: VERSION, ...raw }),
    context,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("update_routine coupled parameters", () => {
  it("leaves the pet omitted for the locked command to preserve when area changes", async () => {
    const OTHER_AREA = "44444444-4444-4444-8444-444444444444";
    await updateRoutine({ routineId: ROUTINE, areaId: OTHER_AREA });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        areaId: OTHER_AREA,
        petId: undefined,
        expectedUpdatedAt: VERSION,
        idempotencyKey: context.idempotencyKey,
      }),
    );
  });

  it("clears one window boundary while preserving the other", async () => {
    await updateRoutine({ routineId: ROUTINE, activeUntil: null });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        activeFrom: undefined,
        activeUntil: null,
      }),
    );
  });

  it("leaves area omitted when only the pet is explicitly cleared", async () => {
    await updateRoutine({ routineId: ROUTINE, petId: null });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ areaId: undefined, petId: null }),
    );
  });

  it("forwards a full window clear to the atomic command", async () => {
    await updateRoutine({
      routineId: ROUTINE,
      activeFrom: null,
      activeUntil: null,
    });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        activeFrom: null,
        activeUntil: null,
        expectedUpdatedAt: VERSION,
      }),
    );
  });
  it("requires the exact version from the earlier read", () => {
    expect(() =>
      updateRoutine({
        routineId: ROUTINE,
        expectedUpdatedAt: undefined,
        title: "Rename",
      }),
    ).toThrow();
    expect(updateRoutineDefinition).not.toHaveBeenCalled();
  });

  it("leaves untouched fields alone on a plain rename", async () => {
    await updateRoutine({ routineId: ROUTINE, title: "New title" });
    expect(updateRoutineDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New title",
        petId: undefined,
        activeFrom: undefined,
        activeUntil: undefined,
      }),
    );
  });
});
