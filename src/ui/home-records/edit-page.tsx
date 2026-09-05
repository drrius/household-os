import {
  normalizeRecordQuery,
  type RawRecordQuery,
} from "@/lib/home-records/query";
import Link from "next/link";
import { notFound } from "next/navigation";
import { documentDefaults } from "@/lib/home-records/document-defaults";
import type { RecordKind } from "@/domain/home-records/schema";
import { safeRecordReturn } from "@/lib/home-records/config";
import { readRecord } from "@/lib/home-records/read";
import { recordOptions } from "@/lib/home-records/options";
import { labels } from "./fields";
import { RecordForm } from "./record-form.client";
export async function RecordEditPage({
  kind,
  id,
  query: rawQuery,
}: {
  kind: RecordKind;
  id?: string;
  query: RawRecordQuery;
}) {
  const query = normalizeRecordQuery(rawQuery);
  const [record, options] = await Promise.all([
    id ? readRecord(kind, id) : Promise.resolve({ id: crypto.randomUUID() }),
    recordOptions(),
  ]);
  let defaults = {};
  if (kind === "documents" && !id) {
    try {
      defaults = documentDefaults(query, options);
    } catch {
      notFound();
    }
  }
  const back = safeRecordReturn(query.back, `/home/${kind}`);
  return (
    <section
      className="grid w-full max-w-3xl gap-6"
      aria-labelledby="edit-title"
    >
      <Link
        className="w-fit min-h-11 content-center"
        href={
          id ? `/home/${kind}/${id}?back=${encodeURIComponent(back)}` : back
        }
      >
        ← Cancel
      </Link>
      <h1
        id="edit-title"
        className="font-heading text-3xl font-semibold tracking-tight"
      >
        {id ? "Edit" : "Add"} {labels[kind].singular}
      </h1>
      <RecordForm
        kind={kind}
        record={{ ...record, ...defaults }}
        options={options}
        returnTo={back}
      />
    </section>
  );
}
