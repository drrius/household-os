import { expect, it } from "vitest";
import fc from "fast-check";
import { documentDefaults } from "./document-defaults";
import { parseRecord } from "@/domain/home-records/schema";
import { safeRecordReturn } from "./config";
const project = "f0000000-0000-4000-8000-000000000001";
const booking = "f0000000-0000-4000-8000-000000000002";
const other = "f0000000-0000-4000-8000-000000000003";
const options = {
  project_id: [{ value: project, label: "Japan" }],
  booking_id: [
    { value: booking, label: "Flight", projectId: project },
    { value: other, label: "Other trip flight", projectId: other },
  ],
};
it("prefills only a booking and project present in the authorized choices", () => {
  expect(documentDefaults({ project, booking }, options)).toEqual({
    project_id: project,
    booking_id: booking,
  });
  for (const query of [
    { project, booking: other },
    { project: other },
    { booking },
    { project: "bad" },
  ])
    expect(() => documentDefaults(query, options)).toThrow();
  expect(documentDefaults({}, options)).toEqual({});
});
it("preserves the exact trip or booking return destination without accepting action routes", () => {
  for (const path of [
    `/plan/projects/${project}?taskPage=2`,
    `/plan/projects/${project}/bookings/${booking}?documentPage=1`,
  ])
    expect(safeRecordReturn(path, "/home/documents")).toBe(path);
  for (const path of [
    `//outside.example/plan/projects/${project}`,
    `/plan/projects/${project}/bookings/${booking}/edit`,
    `/api/attachments`,
  ])
    expect(safeRecordReturn(path, "/home/documents")).toBe("/home/documents");
});
it("requires a trip when accepting any booking identity and retains the relationship in the saved payload", () => {
  fc.assert(
    fc.property(fc.uuid(), (bookingId) => {
      const value = {
        title: "Confirmation",
        file_path: "private.pdf",
        booking_id: bookingId,
      };
      expect(() => parseRecord("documents", value)).toThrow();
      expect(
        parseRecord("documents", { ...value, project_id: project }),
      ).toMatchObject({ booking_id: bookingId, project_id: project });
      expect(() =>
        parseRecord("documents", {
          ...value,
          project_id: project,
          asset_id: other,
        }),
      ).toThrow();
    }),
  );
});
