import { z } from "zod";
import type { RecordOptions } from "./options";
import type { RecordQuery } from "./query";

// Choices already come from authenticated, household-scoped queries.
export function documentDefaults(query: RecordQuery, options: RecordOptions) {
  if (!query.project && !query.booking) return {};
  const project = z.uuid().parse(query.project);
  if (!(options.project_id ?? []).some((option) => option.value === project))
    throw new Error("This trip or project is unavailable.");
  const booking = query.booking ? z.uuid().parse(query.booking) : null;
  if (
    booking &&
    !(options.booking_id ?? []).some(
      (option) => option.value === booking && option.projectId === project,
    )
  )
    throw new Error("Choose a booking belonging to this trip.");
  return { project_id: project, booking_id: booking };
}
