import Link from "next/link";
import type { HomeRecord } from "@/domain/home-records/schema";
import { RecordChange } from "./change-form.client";
import { humanLabel } from "./fields";
export function DecisionControls({
  record,
  returnTo,
}: {
  record: HomeRecord;
  returnTo: string;
}) {
  const values = {
    kind: "decisions",
    id: record.id,
    returnTo,
  };
  return (
    <section
      className="grid gap-3 rounded-xl bg-muted p-4"
      aria-label="Decision status"
    >
      <h2 className="font-medium">{humanLabel(String(record.status))}</h2>
      {record.converted_project_id ? (
        <Link href={`/plan/projects/${record.converted_project_id}`}>
          Open the plan you created →
        </Link>
      ) : null}
      {!record.archived_at ? (
        <div className="flex flex-wrap gap-3">
          <RecordChange
            label={
              record.status === "considering"
                ? "Set this idea aside"
                : "Reopen for discussion"
            }
            values={{
              ...values,
              intent: "status",
              status:
                record.status === "considering" ? "dismissed" : "considering",
            }}
          />
          {!record.converted_project_id ? (
            <>
              <RecordChange
                label="Make it a project"
                values={{
                  ...values,
                  intent: "convert",
                  projectKind: "project",
                }}
              />
              <RecordChange
                label="Plan it as a trip"
                values={{ ...values, intent: "convert", projectKind: "trip" }}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
