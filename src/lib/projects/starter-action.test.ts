import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ load: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/projects/queries", () => ({ loadProject: mocks.load }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { addStarterTasksAction } from "./starter-action";

it("derives the same server receipt IDs even if a reloaded client sends new IDs", async () => {
  mocks.load.mockResolvedValue({ kind: "trip", archived_at: null });
  mocks.rpc.mockResolvedValue({ data: { added: 1, skipped: 0 }, error: null });
  const form = new FormData();
  form.set("projectId", "22000200-0000-4000-8000-000000000001");
  form.set("preset", "packing");
  form.set("operationId", "22000200-0000-4000-8000-000000000099");
  form.append("item", "documents");
  form.set("id:documents", crypto.randomUUID());
  expect(await addStarterTasksAction(null, form)).toEqual({
    added: 1,
    skipped: 0,
  });
  const first = mocks.rpc.mock.calls[0]![1];
  form.set("id:documents", crypto.randomUUID());
  expect(await addStarterTasksAction(null, form)).toEqual({
    added: 1,
    skipped: 0,
  });
  expect(mocks.rpc.mock.calls[1]![1]).toEqual(first);
});
