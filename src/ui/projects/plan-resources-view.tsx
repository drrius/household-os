import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { HomeRecord } from "@/domain/home-records/schema";
import type { CostTarget } from "@/domain/money/cost-target";
import { LinkedCosts } from "@/ui/money/linked-costs";

export type PlanResourcesProps = {
  target: CostTarget;
  paidCents: string;
  archived: boolean;
  returnTo: string;
  documents: { rows: HomeRecord[]; count: number; page: number };
  showArchived: boolean;
};
export function PlanResourcesView({
  target,
  paidCents,
  archived,
  returnTo,
  documents,
  showArchived,
}: PlanResourcesProps) {
  const create = new URLSearchParams({ project: target.id, back: returnTo });
  if (target.bookingId) create.set("booking", target.bookingId);
  function pageHref(page: number, history = showArchived) {
    const url = new URL(returnTo, "https://household.invalid");
    url.searchParams.set("documentPage", String(page));
    url.searchParams.set("archivedDocuments", history ? "1" : "0");
    return `${url.pathname}${url.search}#documents`;
  }
  return (
    <div className="grid gap-6">
      <LinkedCosts target={target} paidCents={paidCents} archived={archived} />
      <section
        id="documents"
        aria-labelledby="plan-documents-title"
        className="grid gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="plan-documents-title"
            className="font-heading text-xl font-semibold"
          >
            Documents
          </h2>
          {!archived ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/home/documents/new?${create}`}
            >
              Add document
            </Link>
          ) : null}
        </div>
        <Link
          className="inline-flex min-h-11 w-fit items-center text-sm"
          href={pageHref(0, !showArchived)}
        >
          {showArchived ? "Current documents" : "Archived documents"}
        </Link>
        {!documents.rows.length ? (
          <p className="text-muted-foreground">
            {showArchived
              ? "No archived documents on this page."
              : "Keep confirmations, tickets and other private files with this plan."}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {documents.rows.map((document) => (
              <li key={document.id}>
                <Link
                  className="block min-h-14 p-4 break-words"
                  href={`/home/documents/${document.id}?back=${encodeURIComponent(returnTo)}`}
                >
                  {String(document.title)}
                  {document.archived_at ? " · Archived" : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <DocumentPages documents={documents} pageHref={pageHref} />
      </section>
    </div>
  );
}

function DocumentPages({
  documents,
  pageHref,
}: {
  documents: PlanResourcesProps["documents"];
  pageHref: (page: number) => string;
}) {
  return (
    <>
      {" "}
      {documents.page > 0 || (documents.page + 1) * 20 < documents.count ? (
        <nav aria-label="Document pages" className="flex flex-wrap gap-4">
          {documents.page > 0 ? (
            <Link
              className="inline-flex min-h-11 items-center"
              href={pageHref(documents.page - 1)}
            >
              Previous documents
            </Link>
          ) : null}
          {(documents.page + 1) * 20 < documents.count ? (
            <Link
              className="inline-flex min-h-11 items-center"
              href={pageHref(documents.page + 1)}
            >
              More documents
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
