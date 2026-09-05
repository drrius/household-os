import Link from "next/link";
import { loadCostContext } from "@/lib/connected/cost-context";
import { LinkedCosts } from "@/ui/money/linked-costs";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import type { RecordOptions } from "@/lib/home-records/options";
import { relatedRecords, type RecordQuery } from "@/lib/home-records/read";
import { RelatedSection } from "./related-section";
import { DecisionControls } from "./decision-controls";

async function PaidLinks({
  kind,
  id,
  archived,
}: {
  kind: RecordKind;
  id: string;
  archived: boolean;
}) {
  if (kind !== "inventory" && kind !== "commitments") return null;
  const target = {
    kind: kind === "inventory" ? ("asset" as const) : ("commitment" as const),
    id,
  };
  const costs = await loadCostContext(target.kind, id, { pageSize: 1 });
  return (
    <LinkedCosts
      target={target}
      paidCents={costs.paid_cents}
      archived={archived}
    />
  );
}
export async function RecordRelations({
  kind,
  record,
  options,
  query,
}: {
  kind: RecordKind;
  record: HomeRecord;
  options: RecordOptions;
  query: RecordQuery;
}) {
  const context = new URLSearchParams(
    Object.entries(query).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[0] !== "saved",
    ),
  );
  const returnTo = `/home/${kind}/${record.id}${context.size ? `?${context}` : ""}`;
  const common = {
    returnTo,
    options,
    query,
    parentArchived: Boolean(record.archived_at),
  };
  if (kind === "inventory")
    return <AssetRelations record={record} common={common} />;
  if (kind === "commitments")
    return (
      <>
        <RelatedSection
          {...common}
          kind="documents"
          rows={await relatedRecords(
            "household_documents",
            "commitment_id",
            record.id,
          )}
          parent={{ column: "commitment_id", id: record.id }}
        />
        <PaidLinks
          kind={kind}
          id={record.id}
          archived={Boolean(record.archived_at)}
        />
      </>
    );
  if (kind === "decisions")
    return (
      <>
        <DecisionControls record={record} returnTo={returnTo} />
        <RelatedSection
          {...common}
          kind="options"
          rows={await relatedRecords(
            "decision_options",
            "decision_id",
            record.id,
          )}
          parent={{ column: "decision_id", id: record.id }}
        />
      </>
    );
  if (kind === "contacts") return <ContactRelations record={record} />;
  return null;
}

async function AssetRelations({
  record,
  common,
}: {
  record: HomeRecord;
  common: {
    returnTo: string;
    options: RecordOptions;
    query: RecordQuery;
    parentArchived: boolean;
  };
}) {
  const [documents, maintenance, routines] = await Promise.all([
    relatedRecords("household_documents", "asset_id", record.id),
    relatedRecords("asset_maintenance", "asset_id", record.id),
    relatedRecords("asset_routines", "asset_id", record.id),
  ]);
  const parent = { column: "asset_id", id: record.id };
  return (
    <>
      <RelatedSection
        {...common}
        kind="routines"
        rows={routines}
        parent={parent}
      />
      <RelatedSection
        {...common}
        kind="maintenance"
        rows={maintenance}
        parent={parent}
      />
      <RelatedSection
        {...common}
        kind="documents"
        rows={documents}
        parent={parent}
      />
      <PaidLinks
        kind="inventory"
        id={record.id}
        archived={Boolean(record.archived_at)}
      />
    </>
  );
}
async function ContactRelations({ record }: { record: HomeRecord }) {
  const [assets, commitments] = await Promise.all([
    relatedRecords("household_assets", "contact_id", record.id),
    relatedRecords("household_commitments", "contact_id", record.id),
  ]);
  return (
    <section className="grid gap-3">
      <h2 className="font-heading text-xl font-semibold">Used for</h2>
      {!assets.length && !commitments.length ? (
        <p className="text-muted-foreground">
          Link this contact from an inventory item or commitment.
        </p>
      ) : null}
      <ul role="list" className="grid gap-2">
        {assets.map((row) => (
          <li key={row.id}>
            <Link href={`/home/inventory/${row.id}`}>
              {row.title}
              {row.archived_at ? " (archived)" : ""}
            </Link>
          </li>
        ))}
        {commitments.map((row) => (
          <li key={row.id}>
            <Link href={`/home/commitments/${row.id}`}>
              {row.title}
              {row.archived_at ? " (archived)" : ""}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
