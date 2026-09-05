import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readFixture, writeFixture } from "./store";
const runtime = globalThis as typeof globalThis & {
  librarySaveFixture?: Map<string, unknown>;
};
afterEach(() => {
  delete runtime.librarySaveFixture;
  vi.unstubAllEnvs();
});
it("holds 100 independent runs and does not evict another run when updating", () => {
  vi.stubEnv("HOUSEHOLD_OS_E2E_FIXTURES", "1");
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const state = { revision: 2, name: "Saved meal", ids: [] };
  for (let n = 0; n < 100; n++) writeFixture(id(n), state);
  writeFixture(id(50), { ...state, revision: 3 });
  expect(readFixture(id(0)).revision).toBe(2);
  writeFixture(id(100), state);
  expect(runtime.librarySaveFixture?.size).toBe(100);
  expect(readFixture(id(0)).revision).toBe(1);
  expect(readFixture(id(1)).revision).toBe(2);
  expect(readFixture(id(50)).revision).toBe(3);
});
