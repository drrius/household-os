import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import {
  costKind,
  costKindLabels,
  costTargetHref,
} from "@/domain/money/cost-target";
import { loadCostRecords } from "@/lib/connected/cost-records";
import { AppPage } from "@/ui/layout/app-page";
const querySchema = z.object({
  kind: costKind.default("project"),
  association: z.literal("removed").optional(),
  archived: z.enum(["true", "false"]).default("false"),
  page: z
    .string()
    .regex(/^\d{1,5}$/)
    .transform(Number)
    .refine((n) => n <= 10000)
    .default(0),
});
export default async function CostRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = querySchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { kind, archived, page } = parsed.data;
  const data = await loadCostRecords(kind, archived === "true", page);
  const href = (nextPage: number) =>
    `/money/contexts?kind=${kind}&archived=${archived}&page=${nextPage}`;
  return (
    <AppPage labelledBy="paid-costs-title">
      <div>
        <Link className={buttonVariants({ variant: "ghost" })} href="/money">
          Back to Money
        </Link>
      </div>
      <h1
        id="paid-costs-title"
        className="text-3xl font-semibold tracking-tight"
      >
        Paid costs
      </h1>
      <p className="max-w-prose text-base text-muted-foreground sm:text-sm">
        See what you paid for a trip, project or household item. Add each
        payment once and keep it connected to who owes whom.
      </p>
      {parsed.data.association === "removed" && (
        <p role="status" className="rounded-xl bg-secondary p-4">
          Removal request saved. The payment remains in Money.
        </p>
      )}
      <CostRecordFilters kind={kind} archived={archived === "true"} />
      {data.records.length ? (
        <ul role="list" className="divide-y divide-border">
          {data.records.map((record) => (
            <li key={record.id}>
              <Link
                className="flex min-h-16 items-center justify-between gap-4 py-4 hover:underline"
                href={costTargetHref({ kind, id: record.id })}
              >
                <p className="min-w-0 break-words font-medium">
                  {record.title}
                </p>
                <p className="shrink-0 text-base text-muted-foreground sm:text-sm">
                  View costs
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-muted-foreground">
          {page
            ? "No more records."
            : `No ${archived === "true" ? "archived" : "active"} records here yet.`}
        </p>
      )}
      <nav aria-label="Cost records pages" className="flex gap-3">
        {page > 0 && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={href(page - 1)}
          >
            Previous
          </Link>
        )}
        {data.hasMore && page < 10000 && (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={href(page + 1)}
          >
            Next
          </Link>
        )}
      </nav>
    </AppPage>
  );
}

function CostRecordFilters({
  kind,
  archived,
}: {
  kind: "project" | "asset" | "commitment";
  archived: boolean;
}) {
  return (
    <>
      {" "}
      <nav aria-label="Cost categories" className="flex flex-wrap gap-2">
        {costKind.options.map((value) => (
          <Link
            key={value}
            aria-current={kind === value ? "page" : undefined}
            className={buttonVariants({
              variant: kind === value ? "secondary" : "ghost",
            })}
            href={`/money/contexts?kind=${value}`}
          >
            {costKindLabels[value]}
          </Link>
        ))}
      </nav>
      <nav aria-label="Record status" className="flex gap-2">
        <Link
          className={buttonVariants({
            variant: !archived ? "secondary" : "ghost",
          })}
          aria-current={!archived ? "page" : undefined}
          href={`/money/contexts?kind=${kind}`}
        >
          Active
        </Link>
        <Link
          className={buttonVariants({
            variant: archived ? "secondary" : "ghost",
          })}
          aria-current={archived ? "page" : undefined}
          href={`/money/contexts?kind=${kind}&archived=true`}
        >
          Archived
        </Link>
      </nav>
    </>
  );
}
