import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  VERSION_ONE_MEMBER_CAP,
  asHouseholdId,
  asUserId,
  canAdmitMember,
} from "./identity";

describe("canAdmitMember", () => {
  it("admits only while the household is under the version-one cap", () => {
    expect(canAdmitMember(0)).toBe(true);
    expect(canAdmitMember(1)).toBe(true);
    expect(canAdmitMember(VERSION_ONE_MEMBER_CAP)).toBe(false);
  });

  it("never admits at or above the version-one member cap", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (count) => {
        expect(canAdmitMember(count)).toBe(count < VERSION_ONE_MEMBER_CAP);
      }),
    );
  });

  it("rejects non-integer and negative counts", () => {
    expect(() => canAdmitMember(-1)).toThrow(/non-negative/);
    expect(() => canAdmitMember(1.5)).toThrow(/non-negative/);
  });
});

describe("brand constructors", () => {
  it("rejects empty branded identifiers", () => {
    expect(() => asUserId("")).toThrow(/UserId/);
    expect(() => asHouseholdId("")).toThrow(/HouseholdId/);
  });
});
