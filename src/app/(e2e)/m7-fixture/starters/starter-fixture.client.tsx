"use client";
import { StarterChecklists } from "@/ui/projects/starter-checklists.client";

export function StarterFixture() {
  return (
    <StarterChecklists
      projectId="22000200-0000-4000-8000-000000000001"
      kind="trip"
      action={async (_previous, form) => {
        const identity = JSON.stringify(Array.from(form.entries()));
        const receiptKey = `starter-fixture-receipt:${form.get("operationId")}`;
        const prior = sessionStorage.getItem(receiptKey);
        if (prior === null) sessionStorage.setItem(receiptKey, identity);
        await new Promise<void>((resolve) =>
          window.addEventListener("starter-response", () => resolve(), {
            once: true,
          }),
        );
        if (prior === null) {
          return { error: "Connection interrupted. Retry the same selection." };
        }
        if (identity !== prior)
          return { error: "The retry changed its request identities." };
        const count = form.getAll("item").length;
        return { added: Math.max(0, count - 1), skipped: 1 };
      }}
    />
  );
}
