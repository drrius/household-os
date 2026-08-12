import { Card } from "@/ui/primitives/card";
import { RoutineCompleteControl } from "@/ui/today/routine-complete-control.client";
import type { RoutineRow } from "@/ui/today/today-view-model";

type RoutineListProps = {
  rows: readonly RoutineRow[];
};

export function RoutineList({ rows }: RoutineListProps) {
  return (
    <div className="today-card-list">
      {rows.map((row) => (
        <Card
          key={row.occurrenceId}
          tone={row.tone === "overdue" ? "warning" : "default"}
        >
          <RoutineCompleteControl row={row} />
        </Card>
      ))}
    </div>
  );
}
