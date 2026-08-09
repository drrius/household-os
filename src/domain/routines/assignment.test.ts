import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  nextPlannedAssignee,
  plannedAssigneeForIndex,
  validateAssignment,
} from "./assignment";
import { asMemberId } from "./types";

const memberA = asMemberId("member-a");
const memberB = asMemberId("member-b");
const members = [memberA, memberB] as const;

describe("validateAssignment", () => {
  it("requires household members for assigned and alternating policies", () => {
    expect(
      validateAssignment({ policy: "assigned", memberId: asMemberId("outsider") }, members)
        .ok,
    ).toBe(false);

    expect(
      validateAssignment(
        { policy: "alternating", anchorMemberId: asMemberId("outsider") },
        members,
      ).ok,
    ).toBe(false);

    expect(validateAssignment({ policy: "shared" }, members).ok).toBe(true);
  });
});

describe("alternation", () => {
  it("follows the planned sequence from the anchor, not the completer", () => {
    const assignment = {
      policy: "alternating" as const,
      anchorMemberId: memberA,
    };

    expect(
      plannedAssigneeForIndex({ assignment, members, occurrenceIndex: 0 }),
    ).toBe(memberA);
    expect(
      plannedAssigneeForIndex({ assignment, members, occurrenceIndex: 1 }),
    ).toBe(memberB);
    expect(
      plannedAssigneeForIndex({ assignment, members, occurrenceIndex: 2 }),
    ).toBe(memberA);

    expect(
      nextPlannedAssignee({
        assignment,
        members,
        previousPlannedAssignee: memberA,
      }),
    ).toBe(memberB);
  });

  it("alternates for every successive index", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (index) => {
        const assignment = {
          policy: "alternating" as const,
          anchorMemberId: memberB,
        };
        const planned = plannedAssigneeForIndex({
          assignment,
          members,
          occurrenceIndex: index,
        });
        const expected = index % 2 === 0 ? memberB : memberA;
        expect(planned).toBe(expected);
      }),
    );
  });

  it("shared work has no planned assignee", () => {
    expect(
      plannedAssigneeForIndex({
        assignment: { policy: "shared" },
        members,
        occurrenceIndex: 0,
      }),
    ).toBeNull();
  });
});
