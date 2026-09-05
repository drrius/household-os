import { expect, it, vi } from "vitest";
import fc from "fast-check";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { starterTaskIds } from "./starter-identities";

it("keeps receipt identities stable across renders and project UUID casing", () => {
  fc.assert(
    fc.property(fc.uuid(), (projectId) => {
      const ids = starterTaskIds(projectId, "trip");
      expect(starterTaskIds(projectId.toUpperCase(), "trip")).toEqual(ids);
      expect(new Set(Object.values(ids)).size).toBe(Object.keys(ids).length);
      for (const id of Object.values(ids))
        expect(z.uuid().safeParse(id).success).toBe(true);
    }),
  );
});

it("namespaces receipts by project so another trip can use the same checklist", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 8 }),
      (projects) => {
        const ids = projects.flatMap((id) =>
          Object.values(starterTaskIds(id, "trip")),
        );
        expect(new Set(ids).size).toBe(ids.length);
      },
    ),
  );
});
