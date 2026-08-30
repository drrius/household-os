import { nextPlannedAssignee } from "./assignment";
import type {
  ClosurePlan,
  OpenOccurrence,
  PlannedOccurrence,
  RoutineClosureContext,
} from "./closure";
import { compareIsoDates } from "./dates";
import { nextDueAfterClosure } from "./schedule";
import type { Assignment, IsoDate, MemberId } from "./types";

export type SuccessionPlan = Pick<
  ClosurePlan,
  "promotePreviewToCurrent" | "discardPreview" | "createOccurrences"
>;

export function buildSuccessorPair(input: {
  assignment: Assignment;
  members: readonly [MemberId, MemberId];
  previousPlannedAssignee: MemberId | null;
  currentDue: IsoDate;
  previewDue: IsoDate | null;
}): PlannedOccurrence[] {
  const currentAssignee = nextPlannedAssignee({
    assignment: input.assignment,
    members: input.members,
    previousPlannedAssignee: input.previousPlannedAssignee,
  });

  const created: PlannedOccurrence[] = [
    {
      role: "current",
      dueDate: input.currentDue,
      originalDueDate: input.currentDue,
      plannedAssigneeId: currentAssignee,
      status: "open",
    },
  ];

  if (input.previewDue !== null) {
    const previewAssignee = nextPlannedAssignee({
      assignment: input.assignment,
      members: input.members,
      previousPlannedAssignee: currentAssignee,
    });

    created.push({
      role: "preview",
      dueDate: input.previewDue,
      originalDueDate: input.previewDue,
      plannedAssigneeId: previewAssignee,
      status: "open",
    });
  }

  return created;
}

export function planAfterClosingCurrent(input: {
  context: RoutineClosureContext;
  closed: OpenOccurrence;
  completedOn?: IsoDate;
}): SuccessionPlan {
  const { context, closed, completedOn } = input;

  if (!context.active) {
    return {
      promotePreviewToCurrent: false,
      discardPreview: true,
      createOccurrences: [],
    };
  }

  const firstDue = nextDueAfterClosure({
    rule: context.scheduleRule,
    closedDueDate: closed.dueDate,
    completedOn,
    originalDueDate: closed.originalDueDate,
  });

  if (firstDue === null) {
    return {
      promotePreviewToCurrent: false,
      discardPreview: true,
      createOccurrences: [],
    };
  }

  if (context.preview !== null) {
    const previewIsNextCalendarDue =
      context.scheduleRule.kind !== "after_completion" &&
      compareIsoDates(context.preview.dueDate, firstDue) === 0;

    if (previewIsNextCalendarDue) {
      const previewDue = nextDueAfterClosure({
        rule: context.scheduleRule,
        closedDueDate: context.preview.dueDate,
        originalDueDate: context.preview.originalDueDate,
      });

      return {
        promotePreviewToCurrent: true,
        discardPreview: false,
        createOccurrences:
          previewDue === null
            ? []
            : [
                {
                  role: "preview",
                  dueDate: previewDue,
                  originalDueDate: previewDue,
                  plannedAssigneeId: nextPlannedAssignee({
                    assignment: context.assignment,
                    members: context.members,
                    previousPlannedAssignee: context.preview.plannedAssigneeId,
                  }),
                  status: "open",
                },
              ],
      };
    }
  }

  const secondDue = nextDueAfterClosure({
    rule: context.scheduleRule,
    closedDueDate: firstDue,
  });

  return {
    promotePreviewToCurrent: false,
    discardPreview: true,
    createOccurrences: buildSuccessorPair({
      assignment: context.assignment,
      members: context.members,
      previousPlannedAssignee: closed.plannedAssigneeId,
      currentDue: firstDue,
      previewDue: secondDue,
    }),
  };
}
