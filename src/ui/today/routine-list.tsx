import { Card, CardContent } from "@/components/ui/card";
import { RoutineCompleteControl } from "@/ui/today/routine-complete-control.client";
import type { RoutineRow } from "@/ui/today/today-view-model";

type RoutineListProps = {
  rows: readonly RoutineRow[];
};

export function RoutineList({ rows }: RoutineListProps) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card
          className={row.tone === "overdue" ? "bg-warning-soft" : undefined}
          key={row.occurrenceId}
          size="sm"
        >
          <CardContent>
            <RoutineCompleteControl row={row} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
