import { RoutineCompleteControl } from "@/ui/today/routine-complete-control.client";
import type { RoutineRow } from "@/ui/today/today-view-model";

export function RoutineList({ rows }: { rows: readonly RoutineRow[] }) {
  return (
    <ul className="divide-y divide-border" role="list">
      {rows.map((row) => (
        <li className="py-3 first:pt-0 last:pb-0" key={row.occurrenceId}>
          <RoutineCompleteControl row={row} />
        </li>
      ))}
    </ul>
  );
}
