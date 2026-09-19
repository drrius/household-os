import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  VERSION_ONE_MEMBER_CAP,
  asHouseholdId,
  asUserId,
  canAdmitMember,
  existingMemberOrDenied,
  planAppleIdentityAttach,
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

describe("existingMemberOrDenied", () => {
  it("admits only a real membership row and never invents a household", () => {
    expect(existingMemberOrDenied(null)).toBeNull();
    expect(existingMemberOrDenied(undefined)).toBeNull();
    expect(
      existingMemberOrDenied({ householdId: "", displayName: "Alex" }),
    ).toBeNull();

    const admitted = existingMemberOrDenied({
      householdId: "household-1",
      displayName: "Alex",
    });
    expect(admitted).toEqual({
      householdId: "household-1",
      displayName: "Alex",
    });
  });

  it("denies empty household ids for any display name", () => {
    fc.assert(
      fc.property(fc.string(), (displayName) => {
        expect(
          existingMemberOrDenied({ householdId: "", displayName }),
        ).toBeNull();
      }),
    );
  });
});

describe("planAppleIdentityAttach", () => {
  const twoMembers = ["member-1", "member-2"] as const;

  it("refuses to touch membership or extra stray users", () => {
    expect(
      planAppleIdentityAttach({
        memberUserIds: ["only-one"],
        memberUserId: "only-one",
        orphanUserId: "orphan",
        memberAppleProviderId: null,
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: [],
      }).kind,
    ).toBe("refuse");

    expect(
      planAppleIdentityAttach({
        memberUserIds: twoMembers,
        memberUserId: "stranger",
        orphanUserId: "orphan",
        memberAppleProviderId: null,
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: [],
      }),
    ).toMatchObject({ kind: "refuse", reason: /not a household member/ });

    expect(
      planAppleIdentityAttach({
        memberUserIds: twoMembers,
        memberUserId: "member-1",
        orphanUserId: "member-2",
        memberAppleProviderId: null,
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: [],
      }),
    ).toMatchObject({
      kind: "refuse",
      reason: /household member as the Apple orphan/,
    });

    expect(
      planAppleIdentityAttach({
        memberUserIds: twoMembers,
        memberUserId: "member-1",
        orphanUserId: "orphan",
        memberAppleProviderId: null,
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: ["another-stray"],
      }),
    ).toMatchObject({ kind: "refuse", reason: /extra non-member/ });
  });

  it("asks for a transfer until the member already holds the same Apple identity", () => {
    expect(
      planAppleIdentityAttach({
        memberUserIds: twoMembers,
        memberUserId: "member-1",
        orphanUserId: "orphan",
        memberAppleProviderId: null,
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: [],
      }),
    ).toEqual({ kind: "needs-transfer" });

    expect(
      planAppleIdentityAttach({
        memberUserIds: twoMembers,
        memberUserId: "member-1",
        orphanUserId: "orphan",
        memberAppleProviderId: "apple-sub",
        orphanAppleProviderId: "apple-sub",
        extraNonMemberUserIds: [],
      }),
    ).toEqual({ kind: "delete-orphan" });
  });

  it("never deletes the orphan while the Apple identity still lives only there", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }).filter((id) => id !== "member-1"),
        (appleSub, orphanId) => {
          const decision = planAppleIdentityAttach({
            memberUserIds: twoMembers,
            memberUserId: "member-1",
            orphanUserId: orphanId === "member-2" ? "orphan" : orphanId,
            memberAppleProviderId: null,
            orphanAppleProviderId: appleSub,
            extraNonMemberUserIds: [],
          });
          expect(decision.kind).not.toBe("delete-orphan");
        },
      ),
    );
  });
});
