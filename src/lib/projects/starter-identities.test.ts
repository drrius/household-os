import { expect, it, vi } from "vitest";
import fc from "fast-check";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { starterTaskIds } from "./starter-identities";
const operation = "22000200-0000-4000-8000-000000000099";

it("keeps receipt identities stable across renders and project UUID casing", () => {
  fc.assert(
    fc.property(fc.uuid(), (projectId) => {
      const ids = starterTaskIds(projectId, "trip", operation);
      expect(
        starterTaskIds(projectId.toUpperCase(), "trip", operation),
      ).toEqual(ids);
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
          Object.values(starterTaskIds(id, "trip", operation)),
        );
        expect(new Set(ids).size).toBe(ids.length);
      },
    ),
  );
});

it("rotates receipt identities for a new confirmed operation in the same project", () => {
  fc.assert(
    fc.property(
      fc.uuid(),
      fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 5 }),
      (projectId, operations) => {
        const ids = operations.flatMap((id) =>
          Object.values(starterTaskIds(projectId, "trip", id)),
        );
        expect(new Set(ids).size).toBe(ids.length);
      },
    ),
  );
});
