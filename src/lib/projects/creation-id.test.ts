import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requireCreationId } from "./creation-id";
const id = "39000000-0000-4000-8000-000000000039";
it("retains one valid operation URL across requests", () => {
  expect(requireCreationId(id, "/plan/trips/new")).toBe(id);
  expect(requireCreationId(id, "/plan/trips/new")).toBe(id);
});
it.each([undefined, "", "invalid", [id, id]])(
  "redirects missing or ambiguous identities to a fresh operation: %s",
  (value) => {
    expect(() => requireCreationId(value, "/plan/trips/new")).toThrow(
      expect.objectContaining({
        digest: expect.stringMatching(
          /NEXT_REDIRECT;replace;\/plan\/trips\/new\?draft=[0-9a-f-]{36};307;/,
        ),
      }),
    );
  },
);
