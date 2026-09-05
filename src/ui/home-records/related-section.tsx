import Link from "next/link";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import type { RecordOptions } from "@/lib/home-records/options";
import type { RecordQuery } from "@/lib/home-records/read";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { RecordForm } from "./record-form.client";
import { RecordChange } from "./change-form.client";
import { RecordDetails } from "./details";
import { labels } from "./fields";

type RelatedProps = {
  kind: RecordKind;
  rows: HomeRecord[];
  parent: { column: string; id: string };
  returnTo: string;
  options: RecordOptions;
  query: RecordQuery;
  parentArchived?: boolean;
};
function RelatedRow({
  row,
  kind,
  parent,
  returnTo,
  options,
  parentArchived,
}: RelatedProps & { row: HomeRecord }) {
  const title =
    kind === "routines"
      ? (options.routine_id?.find((option) => option.value === row.routine_id)
          ?.label ?? "Routine")
      : String(row.title);
  const values = {
    kind,
    id: row.id,
    version: String(row.updated_at),
    returnTo,
  };
  return (
    <article className="grid gap-3 border-t py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium wrap-anywhere">
          {title}
          {row.chosen ? " · Chosen" : ""}
          {row.archived_at ? " · Archived" : ""}
        </h3>
        {kind === "options" &&
        !parentArchived &&
        !row.archived_at &&
        !row.chosen ? (
          <RecordChange
            label="Choose this option"
            values={{
              kind: "decisions",
              id: parent.id,
              intent: "choose",
              optionId: row.id,
              returnTo,
            }}
          />
        ) : null}
      </div>
      {kind === "routines" ? (
        <Link href={`/home/routines/${row.routine_id}/edit`}>Open routine</Link>
      ) : (
        <RecordDetails kind={kind} record={row} options={options} />
      )}
      <details>
        <summary className="min-h-11 cursor-pointer content-center text-muted-foreground">
          Manage {labels[kind].singular}
        </summary>
        <div className="grid gap-5 py-3">
          {kind !== "routines" ? (
            <RecordForm
              kind={kind}
              record={row}
              parent={parent}
              returnTo={returnTo}
              options={options}
            />
          ) : null}
          <RecordChange
            label={row.archived_at ? "Restore" : "Archive"}
            values={{
              ...values,
              intent: row.archived_at ? "restore" : "archive",
            }}
          />
        </div>
      </details>
    </article>
  );
}
export function RelatedSection(props: RelatedProps) {
  const { kind, rows, parent, returnTo, options, query } = props;
  const pageKey = `${kind}Page`;
  const parsedPage = Number(query[pageKey] ?? 0);
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;
  const sorted = [...rows].sort(
    (a, b) =>
      Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)) ||
      String(b.performed_on ?? b.updated_at).localeCompare(
        String(a.performed_on ?? a.updated_at),
      ),
  );
  function pageHref(next: number) {
    const params = new URLSearchParams(
      Object.entries(query).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    params.set(pageKey, String(next));
    return `${returnTo.split("?")[0]}?${params}`;
  }
  return (
    <section className="grid gap-3" aria-labelledby={`${kind}-heading`}>
      <h2 id={`${kind}-heading`} className="font-heading text-xl font-semibold">
        {labels[kind].title}
      </h2>
      {!rows.length ? (
        <p className="text-muted-foreground">{labels[kind].intro}</p>
      ) : null}
      <div>
        {sorted.slice(page * 10, page * 10 + 10).map((row) => (
          <RelatedRow key={row.id} {...props} row={row} />
        ))}
      </div>
      {rows.length > 10 ? (
        <nav
          aria-label={`${labels[kind].title} pages`}
          className="flex justify-between gap-3"
        >
          {page ? <Link href={pageHref(page - 1)}>Previous</Link> : <span />}
          {(page + 1) * 10 < rows.length ? (
            <Link href={pageHref(page + 1)}>Next</Link>
          ) : null}
        </nav>
      ) : null}
      {!props.parentArchived ? (
        <details className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            Add {labels[kind].singular}
          </summary>
          <div className="pt-4">
            <RecordForm
              kind={kind}
              record={{
                id: crypto.randomUUID(),
                performed_on: zurichCivilDate(),
              }}
              options={options}
              returnTo={returnTo}
              parent={parent}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
