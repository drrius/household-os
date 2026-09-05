import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  attachmentFileType,
  isHouseholdAttachment,
  MAX_ATTACHMENT_BYTES,
} from "./files";

const household = "00000000-0000-4000-8000-000000000001";
const file = "00000000-0000-4000-8000-000000000002";

describe("household attachment boundary", () => {
  it("allows only canonical paths in the caller's household", () => {
    expect(
      isHouseholdAttachment(`${household}/receipts/${file}.pdf`, household),
    ).toBe(true);
    for (const path of [
      `${household}/../${file}.pdf`,
      `${household}/receipts/x.pdf`,
      `https://example.com/${file}.pdf`,
      `${file}/receipts/${file}.pdf`,
    ]) {
      expect(isHouseholdAttachment(path, household)).toBe(false);
    }
  });
  it("never accepts another household's object", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (owner, viewer) => {
        fc.pre(owner !== viewer);
        expect(
          isHouseholdAttachment(`${owner}/documents/${file}.pdf`, viewer),
        ).toBe(false);
      }),
    );
  });
  it("uses file signatures rather than user-controlled MIME labels", () => {
    expect(
      attachmentFileType(
        new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 0, 0]),
      )?.mime,
    ).toBe("application/pdf");
    expect(
      attachmentFileType(
        new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      )?.mime,
    ).toBe("image/jpeg");
    expect(
      attachmentFileType(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
      )?.mime,
    ).toBe("image/png");
    expect(
      attachmentFileType(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
      )?.mime,
    ).toBe("image/webp");
    expect(
      attachmentFileType(
        new Uint8Array([60, 115, 118, 103, 32, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBeNull();
    expect(
      attachmentFileType(new Uint8Array(MAX_ATTACHMENT_BYTES + 1)),
    ).toBeNull();
  });
});

it("rejects PDF paths in completion photos at the canonical boundary", () => {
  expect(
    isHouseholdAttachment(
      "00000000-0000-4000-8000-000000000001/completions/00000000-0000-4000-8000-000000000002.pdf",
      "00000000-0000-4000-8000-000000000001",
    ),
  ).toBe(false);
});
