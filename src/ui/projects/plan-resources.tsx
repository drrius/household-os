import { loadCostContext } from "@/lib/connected/cost-context";
import { listRecords } from "@/lib/home-records/read";
import { safeRecordReturn } from "@/lib/home-records/config";
import type { RecordQuery } from "@/lib/home-records/query";
import { PlanResourcesView } from "./plan-resources-view";

export async function PlanResources({
  projectId,
  bookingId,
  archived,
  query,
}: {
  projectId: string;
  bookingId?: string;
  archived: boolean;
  query: RecordQuery;
}) {
  const base = `/plan/projects/${projectId}${bookingId ? `/bookings/${bookingId}` : ""}`;
  const search = new URLSearchParams(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const returnTo = safeRecordReturn(
    `${base}${search.size ? `?${search}` : ""}`,
    base,
  );
  const showArchived = query.archivedDocuments === "1";
  const [costs, documents] = await Promise.all([
    loadCostContext("project", projectId, { pageSize: 1, bookingId }),
    listRecords(
      "documents",
      { page: query.documentPage ?? "0", archived: showArchived ? "1" : "0" },
      {
        column: bookingId ? "booking_id" : "project_id",
        id: bookingId ?? projectId,
      },
    ),
  ]);
  return (
    <PlanResourcesView
      target={{ kind: "project", id: projectId, bookingId }}
      paidCents={costs.paid_cents}
      archived={archived}
      returnTo={returnTo}
      documents={documents}
      showArchived={showArchived}
    />
  );
}
