import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "one" })),
}));
vi.mock("@/lib/meals/library", () => ({
  saveLibraryMeal: vi.fn(async (input: { id: string }) => input.id),
  saveMealTemplate: vi.fn(),
  archiveLibraryMeal: vi.fn(),
  removeMealTemplate: vi.fn(),
  restoreMealTemplate: vi.fn(),
  loadLibraryMeal: vi.fn(),
}));
vi.mock("@/lib/meals/library-archive", () => ({ restoreLibraryMeal: vi.fn() }));
import {
  saveLibraryMeal,
  saveMealTemplate,
  removeMealTemplate,
  loadLibraryMeal,
} from "@/lib/meals/library";
import { LIBRARY_HANDLERS } from "./library";
const id = "11111111-1111-4111-8111-111111111111";
const context = { idempotencyKey: "ai:library:one", today: "2026-09-05" };
beforeEach(() => vi.clearAllMocks());
it("reuses its creation identity and preserves the saved recipe fields", async () => {
  const input = {
    identity: { mode: "create" },
    name: "Pasta",
    recipeUrl: "https://example.com/pasta",
    notes: "For two",
  };
  await LIBRARY_HANDLERS.save_library_meal!(input, context);
  await LIBRARY_HANDLERS.save_library_meal!(input, context);
  const calls = vi.mocked(saveLibraryMeal).mock.calls;
  expect(calls[0]![0]).toEqual(calls[1]![0]);
  expect(calls[0]![0]).toMatchObject({
    name: "Pasta",
    recipeUrl: input.recipeUrl,
    notes: "For two",
    isNew: true,
  });
});
it("passes the exact template edit version and optional fields through the UI parser", async () => {
  await LIBRARY_HANDLERS.save_meal_grocery_template!(
    {
      identity: { mode: "update", id, updatedAt: "2026-09-05T10:00:00Z" },
      libraryId: id,
      name: "Flour",
      quantity: "500",
      unit: "g",
      categoryId: null,
      note: null,
    },
    context,
  );
  expect(saveMealTemplate).toHaveBeenCalledWith(
    expect.objectContaining({
      id,
      libraryId: id,
      version: "2026-09-05T10:00:00Z",
      quantity: "500",
      unit: "g",
      categoryId: null,
      isNew: false,
    }),
  );
});
it("rejects unsafe recipe URLs before saving", async () => {
  await expect(
    LIBRARY_HANDLERS.save_library_meal!(
      {
        identity: { mode: "create" },
        name: "Pasta",
        recipeUrl: "javascript:alert(1)",
        notes: null,
      },
      context,
    ),
  ).rejects.toThrow();
  expect(saveLibraryMeal).not.toHaveBeenCalled();
});
it("cannot archive a grocery template missing from the selected meal", async () => {
  vi.mocked(loadLibraryMeal).mockResolvedValue({
    templates: [],
    archivedTemplates: [],
  } as unknown as NonNullable<Awaited<ReturnType<typeof loadLibraryMeal>>>);
  await expect(
    LIBRARY_HANDLERS.set_meal_grocery_template_archived!(
      { libraryId: id, templateId: id, archived: true },
      context,
    ),
  ).rejects.toThrow("unavailable");
  expect(removeMealTemplate).not.toHaveBeenCalled();
});
