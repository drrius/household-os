import { nextPlannedAssignee } from "./assignment";
import { compareIsoDates } from "./dates";
import { nextDueAfterClosure } from "./schedule";
import type {
  Assignment,
  IsoDate,
  MemberId,
  OccurrenceId,
  OccurrenceRole,
  OccurrenceStatus,
  ScheduleRule,
} from "./types";

export type OpenOccurrence = {
  id: OccurrenceId;
  role: OccurrenceRole;
  dueDate: IsoDate;
  originalDueDate: IsoDate;
  plannedAssigneeId: MemberId | null;
  status: "open";
};

export type ClosureCommand =
  | {
      kind: "complete";
      occurrenceId: OccurrenceId;
      actorMemberId: MemberId;
      completedOn: IsoDate;
      note?: string;
      photoPath?: string;
    }
  | {
      kind: "skip";
      occurrenceId: OccurrenceId;
      actorMemberId: MemberId;
    }
  | {
      kind: "reschedule";
      occurrenceId: OccurrenceId;
      actorMemberId: MemberId;
      newDueDate: IsoDate;
    };

export type PlannedOccurrence = {
  role: OccurrenceRole;
  dueDate: IsoDate;
  originalDueDate: IsoDate;
  plannedAssigneeId: MemberId | null;
  status: "open";
};

export type ClosureActivityKind =
  | "occurrence_completed"
  | "occurrence_skipped"
  | "occurrence_rescheduled";

export type ClosurePlan = {
  closedOccurrenceId: OccurrenceId;
  nextStatus: Exclude<OccurrenceStatus, "open"> | "open";
  completion: {
    completedByMemberId: MemberId;
    completedOn: IsoDate;
    note?: string;
    photoPath?: string;
  } | null;
  rescheduledDueDate: IsoDate | null;
  promotePreviewToCurrent: boolean;
  discardPreview: boolean;
  createOccurrences: PlannedOccurrence[];
  activityKind: ClosureActivityKind;
};

export type ClosurePlanError = {
  code:
    | "occurrence_not_found"
    | "occurrence_not_open"
    | "not_current_occurrence"
    | "routine_inactive"
    | "invalid_reschedule_date";
  message: string;
};

export type ClosurePlanResult =
  | { ok: true; plan: ClosurePlan }
  | { ok: false; error: ClosurePlanError };

export type RoutineClosureContext = {
  assignment: Assignment;
  members: readonly [MemberId, MemberId];
  scheduleRule: ScheduleRule;
  active: boolean;
  current: OpenOccurrence | null;
  preview: OpenOccurrence | null;
};

function emptyCreates(): PlannedOccurrence[] {
  return [];
}

function buildSuccessorPair(input: {
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

function planAfterClosingCurrent(input: {
  context: RoutineClosureContext;
  closed: OpenOccurrence;
  completedOn?: IsoDate;
}): Pick<
  ClosurePlan,
  | "promotePreviewToCurrent"
  | "discardPreview"
  | "createOccurrences"
> {
  const { context, closed, completedOn } = input;

  if (!context.active) {
    return {
      promotePreviewToCurrent: false,
      discardPreview: true,
      createOccurrences: emptyCreates(),
    };
  }

  const firstDue = nextDueAfterClosure({
    rule: context.scheduleRule,
    closedDueDate: closed.dueDate,
    completedOn,
  });

  if (firstDue === null) {
    return {
      promotePreviewToCurrent: false,
      discardPreview: true,
      createOccurrences: emptyCreates(),
    };
  }

  if (context.preview !== null) {
    const previewMatchesCadence =
      context.scheduleRule.kind !== "after_completion" &&
      compareIsoDates(context.preview.dueDate, firstDue) === 0;

    if (previewMatchesCadence) {
      const previewDue = nextDueAfterClosure({
        rule: context.scheduleRule,
        closedDueDate: context.preview.dueDate,
      });

      return {
        promotePreviewToCurrent: true,
        discardPreview: false,
        createOccurrences:
          previewDue === null
            ? emptyCreates()
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

export function planOccurrenceClosure(
  context: RoutineClosureContext,
  command: ClosureCommand,
): ClosurePlanResult {
  const target =
    context.current?.id === command.occurrenceId
      ? context.current
      : context.preview?.id === command.occurrenceId
        ? context.preview
        : null;

  if (target === null) {
    return {
      ok: false,
      error: {
        code: "occurrence_not_found",
        message: "Occurrence is not part of this routine window",
      },
    };
  }

  if (target.status !== "open") {
    return {
      ok: false,
      error: {
        code: "occurrence_not_open",
        message: "Only open occurrences can be closed or rescheduled",
      },
    };
  }

  switch (command.kind) {
    case "complete": {
      if (target.role !== "current") {
        return {
          ok: false,
          error: {
            code: "not_current_occurrence",
            message: "Only the current occurrence can be completed",
          },
        };
      }

      const succession = planAfterClosingCurrent({
        context,
        closed: target,
        completedOn: command.completedOn,
      });

      return {
        ok: true,
        plan: {
          closedOccurrenceId: target.id,
          nextStatus: "completed",
          completion: {
            completedByMemberId: command.actorMemberId,
            completedOn: command.completedOn,
            note: command.note,
            photoPath: command.photoPath,
          },
          rescheduledDueDate: null,
          ...succession,
          activityKind: "occurrence_completed",
        },
      };
    }
    case "skip": {
      if (target.role !== "current") {
        return {
          ok: false,
          error: {
            code: "not_current_occurrence",
            message: "Only the current occurrence can be skipped",
          },
        };
      }

      const succession = planAfterClosingCurrent({
        context,
        closed: target,
      });

      return {
        ok: true,
        plan: {
          closedOccurrenceId: target.id,
          nextStatus: "skipped",
          completion: null,
          rescheduledDueDate: null,
          ...succession,
          activityKind: "occurrence_skipped",
        },
      };
    }
    case "reschedule": {
      if (target.role !== "current") {
        return {
          ok: false,
          error: {
            code: "not_current_occurrence",
            message: "Only the current occurrence can be rescheduled",
          },
        };
      }

      if (compareIsoDates(command.newDueDate, target.dueDate) === 0) {
        return {
          ok: false,
          error: {
            code: "invalid_reschedule_date",
            message: "Reschedule date must differ from the current due date",
          },
        };
      }

      const createOccurrences: PlannedOccurrence[] = [];
      let discardPreview = false;

      if (context.preview !== null && context.active) {
        const previewDue = nextDueAfterClosure({
          rule: context.scheduleRule,
          closedDueDate: command.newDueDate,
        });

        discardPreview = true;

        if (previewDue !== null) {
          createOccurrences.push({
            role: "preview",
            dueDate: previewDue,
            originalDueDate: previewDue,
            plannedAssigneeId: nextPlannedAssignee({
              assignment: context.assignment,
              members: context.members,
              previousPlannedAssignee: target.plannedAssigneeId,
            }),
            status: "open",
          });
        }
      }

      return {
        ok: true,
        plan: {
          closedOccurrenceId: target.id,
          nextStatus: "open",
          completion: null,
          rescheduledDueDate: command.newDueDate,
          promotePreviewToCurrent: false,
          discardPreview,
          createOccurrences,
          activityKind: "occurrence_rescheduled",
        },
      };
    }
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}

/** Initial current + preview window when activating a routine. */
export function planInitialOccurrenceWindow(input: {
  assignment: Assignment;
  members: readonly [MemberId, MemberId];
  scheduleRule: ScheduleRule;
  firstDueDate: IsoDate;
}): PlannedOccurrence[] {
  const secondDue = nextDueAfterClosure({
    rule: input.scheduleRule,
    closedDueDate: input.firstDueDate,
  });

  return buildSuccessorPair({
    assignment: input.assignment,
    members: input.members,
    previousPlannedAssignee: null,
    currentDue: input.firstDueDate,
    previewDue: secondDue,
  });
}
