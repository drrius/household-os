import Link from "next/link";
import type { RecordKind } from "@/domain/home-records/schema";
import { buttonVariants } from "@/components/ui/button";
import {
  listContext,
  listRecords,
  type RecordQuery,
} from "@/lib/home-records/read";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { labels } from "./fields";
import { recordSummary } from "./summary";
export async function RecordListPage({
  kind,
  query,
}: {
  kind: RecordKind;
  query: RecordQuery;
}) {
  const { rows, page, count } = await listRecords(kind, query);
  const context = listContext(kind, query);
  const copy = labels[kind];
  return (
    <section className="grid gap-6" aria-labelledby="record-title">
      <Link href="/home" className="w-fit min-h-11 content-center">
        ← Home
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          <h1
            id="record-title"
            className="font-heading text-3xl font-semibold tracking-tight"
          >
            {copy.title}
          </h1>
          <p className="max-w-prose text-pretty text-muted-foreground">
            {copy.intro}
          </p>
        </div>
        <Link
          href={`/home/${kind}/new?back=${encodeURIComponent(context)}`}
          className={buttonVariants()}
        >
          Add {copy.singular}
        </Link>
      </header>
      <ListControls kind={kind} query={query} />
      {query.saved ? (
        <p role="status">Saved. Both of you can see the update.</p>
      ) : null}
      <ListRows kind={kind} rows={rows} context={context} />
      {!rows.length ? (
        <div className="grid gap-2 rounded-xl bg-muted p-6">
          <h2 className="font-medium">
            {query.q
              ? "No matching records"
              : query.archived
                ? "Nothing archived"
                : query.attention === "1"
                  ? "Nothing needs attention"
                  : `Your ${copy.title.toLowerCase()} starts here`}
          </h2>
          <p className="text-muted-foreground">
            {query.q
              ? "Try a shorter name or clear the search."
              : query.archived
                ? "Archived records stay available when you need them."
                : query.attention === "1"
                  ? "No warranties or notice deadlines need your attention in the next 30 days."
                  : copy.intro}
          </p>
        </div>
      ) : null}
      <ListPagination kind={kind} query={query} page={page} count={count} />
    </section>
  );
}

function ListControls({
  kind,
  query,
}: {
  kind: RecordKind;
  query: RecordQuery;
}) {
  const copy = labels[kind];
  return (
    <>
      <AttentionFilter kind={kind} query={query} />
      <nav aria-label="Record status" className="flex gap-4">
        <Link
          aria-current={query.archived !== "1" ? "page" : undefined}
          href={listContext(kind, { q: query.q })}
        >
          Current
        </Link>
        <Link
          aria-current={query.archived === "1" ? "page" : undefined}
          href={listContext(kind, { q: query.q, archived: "1" })}
        >
          Archived
        </Link>
      </nav>
      <form className="flex flex-wrap gap-2" method="get">
        <label className="sr-only" htmlFor="record-search">
          Search {copy.title.toLowerCase()}
        </label>
        <input
          id="record-search"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder={`Search ${copy.title.toLowerCase()}`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-3"
        />
        {query.attention ? (
          <input type="hidden" name="attention" value={query.attention} />
        ) : null}
        {query.archived ? (
          <input type="hidden" name="archived" value={query.archived} />
        ) : null}
        <button
          type="submit"
          className={buttonVariants({ variant: "outline" })}
        >
          Search
        </button>
      </form>
    </>
  );
}
function ListRows({
  kind,
  rows,
  context,
}: {
  kind: RecordKind;
  rows: import("@/domain/home-records/schema").HomeRecord[];
  context: string;
}) {
  return (
    <>
      <ul role="list" className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/home/${kind}/${row.id}?back=${encodeURIComponent(context)}`}
              className="flex min-h-20 items-center justify-between gap-4 rounded-lg px-2 py-4 no-underline hover:bg-muted"
            >
              <div className="grid min-w-0 gap-1">
                <p className="font-medium wrap-anywhere">
                  {String(row.title ?? row.name)}
                </p>
                <p className="text-base text-muted-foreground sm:text-sm">
                  {recordSummary(kind, row, zurichCivilDate())}
                </p>
              </div>
              <span aria-hidden className="shrink-0">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
function ListPagination({
  kind,
  query,
  page,
  count,
}: {
  kind: RecordKind;
  query: RecordQuery;
  page: number;
  count: number;
}) {
  return (
    <>
      <nav
        aria-label="Record pages"
        className="flex min-h-11 items-center justify-between gap-3"
      >
        <div>
          {page > 0 ? (
            <Link
              href={listContext(kind, { ...query, page: String(page - 1) })}
            >
              Previous
            </Link>
          ) : null}
        </div>
        <p className="tabular-nums text-muted-foreground">
          {count} records · Page {page + 1}
        </p>
        <div>
          {(page + 1) * 20 < count ? (
            <Link
              href={listContext(kind, { ...query, page: String(page + 1) })}
            >
              Next
            </Link>
          ) : null}
        </div>
      </nav>
    </>
  );
}

function AttentionFilter({
  kind,
  query,
}: {
  kind: RecordKind;
  query: RecordQuery;
}) {
  if (
    (kind !== "inventory" && kind !== "commitments") ||
    query.archived === "1"
  )
    return null;
  return (
    <Link
      className="w-fit min-h-11 content-center"
      href={listContext(kind, {
        q: query.q,
        attention: query.attention === "1" ? undefined : "1",
      })}
    >
      {query.attention === "1"
        ? "Show all current records"
        : "Needs attention in the next 30 days"}
    </Link>
  );
}
