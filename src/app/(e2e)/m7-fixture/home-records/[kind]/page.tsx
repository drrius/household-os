import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isRecordKind, type HomeRecord } from "@/domain/home-records/schema";
import { RecordForm } from "@/ui/home-records/record-form.client";
import { RecordDetails } from "@/ui/home-records/details";
import { RecordChange } from "@/ui/home-records/change-form.client";
import { AppShell } from "@/ui/shell/app-shell";
import { fixtureRecordAction } from "./actions";
const parentId = "f0000000-0000-4000-8000-000000000001";
const options = {
  contact_id: [{ value: parentId, label: "Repair workshop" }],
  responsible_member_id: [{ value: parentId, label: "Partner" }],
  recurring_expense_rule_id: [{ value: parentId, label: "Annual renewal" }],
  routine_id: [{ value: parentId, label: "Clean the filter" }],
  asset_id: [{ value: parentId, label: "Dishwasher" }],
  commitment_id: [{ value: parentId, label: "Internet" }],
  project_id: [{ value: parentId, label: "Weekend away" }],
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ edit?: string; saved?: string; uncertain?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const [{ kind }, query, jar] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  if (!isRecordKind(kind)) notFound();
  const record: HomeRecord = JSON.parse(
    jar.get(`home-records-${kind}`)?.value ?? "null",
  ) ?? { id: crypto.randomUUID() };
  const parent =
    kind === "maintenance" || kind === "routines"
      ? { column: "asset_id", id: parentId }
      : kind === "options"
        ? { column: "decision_id", id: parentId }
        : undefined;
  const uncertain = query.uncertain === "1";
  const action = fixtureRecordAction.bind(null, uncertain);
  const editing = uncertain || !record.updated_at || query.edit === "1";
  return (
    <AppShell>
      <section className="mx-auto grid w-full max-w-3xl gap-6 p-5">
        <h1 className="font-heading text-3xl">
          {editing
            ? `Add or edit ${kind}`
            : String(record.title ?? record.name ?? "Linked routine")}
        </h1>
        {query.saved ? <p role="status">Saved record</p> : null}
        {uncertain ? (
          <Link href={`/m7-fixture/home-records/${kind}`}>
            Cancel and open existing records
          </Link>
        ) : null}
        {editing ? (
          <RecordForm
            kind={kind}
            record={uncertain ? { id: record.id } : record}
            options={options}
            returnTo={`/home/${kind}`}
            parent={parent}
            action={action}
          />
        ) : (
          <>
            <RecordDetails kind={kind} record={record} options={options} />
            <Link href="?edit=1">Edit details</Link>
            <p>{record.archived_at ? "Archived record" : "Current record"}</p>
            <RecordChange
              label={record.archived_at ? "Restore" : "Archive"}
              values={{
                kind,
                id: record.id,
                intent: record.archived_at ? "restore" : "archive",
              }}
              action={action}
            />
          </>
        )}
      </section>
    </AppShell>
  );
}
