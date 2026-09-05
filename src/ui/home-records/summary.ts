import { deadlineLabel, noticeDeadline } from "@/domain/home-records/dates";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import { formatCentimesField } from "@/domain/money/chf";
import { formatCivilDateShort } from "@/lib/ui/zurich-date";
export function recordSummary(
  kind: RecordKind,
  row: HomeRecord,
  today: string,
): string {
  if (kind === "inventory")
    return row.warranty_until
      ? `Warranty ends ${formatCivilDateShort(String(row.warranty_until))} · ${deadlineLabel(String(row.warranty_until), today)}`
      : String(
          row.model || row.category || "Purchase details, documents & care",
        );
  if (kind === "commitments") {
    if (row.status === "ended") return "Ended";
    if (row.status === "cancel_requested") return "Cancellation requested";
    if (row.renewal_on) {
      const date = noticeDeadline(
        String(row.renewal_on),
        Number(row.notice_days),
      );
      return `Notice deadline ${formatCivilDateShort(date)} · ${deadlineLabel(date, today)}`;
    }
    return String(row.provider || "No renewal date recorded");
  }
  if (kind === "contacts")
    return String(row.company || row.phone || row.email || "Contact details");
  if (kind === "decisions")
    return row.status === "decided"
      ? "Decided together"
      : row.status === "dismissed"
        ? "Set aside"
        : "Considering the options";
  if (kind === "options")
    return row.estimated_amount_cents !== null &&
      row.estimated_amount_cents !== undefined
      ? `Estimated CHF ${formatCentimesField(Number(row.estimated_amount_cents))}`
      : "No estimate yet";
  if (kind === "maintenance")
    return `Performed ${formatCivilDateShort(String(row.performed_on))}`;
  return "Private household document";
}
