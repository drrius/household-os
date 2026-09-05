import Link from "next/link";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import { formatCentimesField } from "@/domain/money/chf";
import { noticeDeadline } from "@/domain/home-records/dates";
import type { RecordOptions } from "@/lib/home-records/options";
import { fields, humanLabel } from "./fields";
const relationshipRoutes: Record<string, string> = {
  contact_id: "/home/contacts",
  recurring_expense_rule_id: "/money/recurring",
  project_id: "/plan/projects",
  asset_id: "/home/inventory",
  commitment_id: "/home/commitments",
  routine_id: "/home/routines",
};
function DetailValue({
  field,
  value,
  options,
}: {
  field: string;
  value: string | number | boolean;
  options: RecordOptions;
}) {
  if (field === "file_path")
    return (
      <a
        href={`/api/attachments?path=${encodeURIComponent(String(value))}`}
        target="_blank"
        rel="noreferrer"
      >
        Open private file ↗
      </a>
    );
  if (field === "website")
    return /^https?:\/\//i.test(String(value)) ? (
      <a href={String(value)} target="_blank" rel="noreferrer">
        Open website ↗
      </a>
    ) : (
      <>{String(value)}</>
    );
  if (field === "phone")
    return (
      <a href={`tel:${String(value).replace(/[^+\d]/g, "")}`}>
        {String(value)}
      </a>
    );
  if (field === "email") return <a href={`mailto:${value}`}>{String(value)}</a>;
  const option = options[field]?.find((item) => item.value === value);
  if (option && relationshipRoutes[field])
    return (
      <Link
        href={`${relationshipRoutes[field]}/${value}${["routine_id", "recurring_expense_rule_id"].includes(field) ? "/edit" : ""}`}
      >
        {option.label}
      </Link>
    );
  if (option) return <>{option.label}</>;
  if (field.endsWith("_cents"))
    return <>CHF {formatCentimesField(Number(value))}</>;
  return (
    <>
      {field === "status" || field === "billing_interval"
        ? humanLabel(String(value))
        : String(value)}
    </>
  );
}
export function RecordDetails({
  kind,
  record,
  options,
}: {
  kind: RecordKind;
  record: HomeRecord;
  options: RecordOptions;
}) {
  return (
    <div className="grid gap-5">
      {kind === "commitments" &&
      record.renewal_on &&
      record.status !== "ended" ? (
        <div className="grid gap-1 rounded-xl bg-accent p-4">
          <h2 className="font-medium">
            Decide before{" "}
            {noticeDeadline(
              String(record.renewal_on),
              Number(record.notice_days),
            )}
          </h2>
          <p>
            Notice period: {record.notice_days} days · Renewal:{" "}
            {record.renewal_on}
          </p>
        </div>
      ) : null}
      <dl className="@container">
        <div className="grid gap-5 @xl:grid-cols-2">
          {fields[kind]
            .filter(
              (field) =>
                !["title", "name"].includes(field.name) &&
                record[field.name] !== null &&
                record[field.name] !== undefined &&
                record[field.name] !== "",
            )
            .map((field) => (
              <div
                key={field.name}
                className={`grid gap-1 ${field.type === "textarea" ? "@xl:col-span-2" : ""}`}
              >
                <dt className="font-medium">{field.label}</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground wrap-anywhere">
                  <DetailValue
                    field={field.name}
                    value={record[field.name] as string | number | boolean}
                    options={options}
                  />
                </dd>
              </div>
            ))}
        </div>
      </dl>
      {kind === "commitments" ? (
        <p className="text-muted-foreground">
          Expected costs are planning information. Paid expenses and balances
          are recorded in Money.
        </p>
      ) : null}
    </div>
  );
}
