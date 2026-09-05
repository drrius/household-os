type ArchivedRoutineRow = {
  id: string;
  title: string;
  archived_at: string | null;
};

export function mapArchivedRoutines(routines: readonly ArchivedRoutineRow[]) {
  return routines
    .filter((routine) => routine.archived_at !== null)
    .sort(
      (left, right) =>
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    )
    .map((routine) => ({ id: routine.id, title: routine.title }));
}
