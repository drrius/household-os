import { isHouseholdAttachment } from "@/domain/attachments/files";

export function isShoppingReceipt(path: string, householdId: string): boolean {
  return (
    isHouseholdAttachment(path, householdId) &&
    path.split("/")[1]?.toLowerCase() === "receipts"
  );
}
