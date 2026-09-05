import {
  normalizeRecordQuery,
  type RawRecordQuery,
} from "@/lib/home-records/query";
import Link from "next/link";
import type { RecordKind } from "@/domain/home-records/schema";
import { buttonVariants } from "@/components/ui/button";
import { safeRecordReturn } from "@/lib/home-records/config";
import { recordOptions } from "@/lib/home-records/options";
import { readRecord } from "@/lib/home-records/read";
import { RecordChange } from "./change-form.client";
import { RecordDetails } from "./details";
import { RecordRelations } from "./relations";
import { labels } from "./fields";
export async function RecordDetailPage({
  kind,
  id,
  query: rawQuery,
}: {
  kind: RecordKind;
  id: string;
  query: RawRecordQuery;
}) {
  const query = normalizeRecordQuery(rawQuery);
  const [record, options] = await Promise.all([
    readRecord(kind, id),
    recordOptions(),
  ]);
  const back = safeRecordReturn(query.back, `/home/${kind}`);
  return (
    <section
      className="grid w-full max-w-4xl gap-8"
      aria-labelledby="record-title"
    >
      <Link href={back} className="w-fit min-h-11 content-center">
        ← {back.startsWith("/plan/") ? "Back to plan" : labels[kind].title}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1
          id="record-title"
          className="min-w-0 font-heading text-3xl font-semibold tracking-tight wrap-anywhere"
        >
          {String(record.title ?? record.name)}
        </h1>
        <Link
          href={`/home/${kind}/${id}/edit?back=${encodeURIComponent(back)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Edit
        </Link>
      </header>
      {query.saved ? (
        <p role="status" className="rounded-xl bg-success-soft p-3">
          Saved. Both of you can see the update.
        </p>
      ) : null}
      {record.archived_at ? (
        <p className="rounded-xl bg-muted p-4">
          Archived. Your details and history are still here.
        </p>
      ) : null}
      <RecordDetails kind={kind} record={record} options={options} />
      <RecordRelations
        kind={kind}
        record={record}
        options={options}
        query={query}
      />
      <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer content-center">
          {record.archived_at ? "Restore this record" : "Archive this record"}
        </summary>
        <div className="grid gap-3 py-3">
          <p className="text-muted-foreground">
            {record.archived_at
              ? "Bring it back to your current records."
              : "Move it out of your current list. Its documents, relationships, and history are kept."}
          </p>
          <RecordChange
            label={record.archived_at ? "Restore" : "Archive"}
            values={{
              kind,
              id,
              version: String(record.updated_at),
              intent: record.archived_at ? "restore" : "archive",
              returnTo: `/home/${kind}/${id}?back=${encodeURIComponent(back)}`,
            }}
          />
        </div>
      </details>
    </section>
  );
}
