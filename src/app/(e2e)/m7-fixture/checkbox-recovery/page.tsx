"use client";
import { GroceryCategoryManager } from "@/ui/groceries/category-manager.client";
import { formRejection } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
export default function CheckboxRecoveryFixture() {
  return (
    <main className="p-6">
      <GroceryCategoryManager
        data={[
          {
            id: "00000000-0000-4000-8000-000000000099",
            name: "Archived category",
            sort_order: 10,
            archived_at: "2026-01-01T00:00:00Z",
          },
        ]}
        action={async (previous, form) =>
          formRejection(
            previous,
            new Error("The category changed. Try again."),
            echoValues(form),
          )
        }
      />
    </main>
  );
}
