import type { IsoDate, RoutinePriority } from "./types";
import { compareIsoDates } from "./dates";

const PRIORITY_RANK: Record<RoutinePriority, number> = {
  pet_care: 0,
  meal_deadline: 1,
  cleaning: 2,
  general: 3,
};

export function compareOverdueOccurrences(
  left: { priority: RoutinePriority; dueDate: IsoDate },
  right: { priority: RoutinePriority; dueDate: IsoDate },
): number {
  const priorityDelta =
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return compareIsoDates(left.dueDate, right.dueDate);
}
