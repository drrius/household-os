import { redirect } from "next/navigation";

import { removeMealEntryAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { cn } from "@/lib/utils";
import { FormField, FormPage } from "@/ui/forms/form-page";

function slotLabel(slot: "breakfast" | "lunch" | "dinner" | null): string {
  switch (slot) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case null:
      return "Unscheduled";
    default: {
      const exhaustiveSlot: never = slot;
      return exhaustiveSlot;
    }
  }
}

export default async function ManageMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { entryId } = await params;
  const query = await searchParams;
  const entry = await loadManageMealEntry(entryId);
  if (entry === null) {
    redirect("/plan");
  }

  return (
    <FormPage
      backHref="/plan"
      description="View or remove this planned meal."
      error={query.error}
      title={entry.title}
    >
      <div className="grid gap-5">
        <FormField label="Date">
          <p className="text-sm font-normal">{entry.date}</p>
        </FormField>
        <FormField label="Slot">
          <p className="text-sm font-normal">{slotLabel(entry.slot)}</p>
        </FormField>
        <FormField label="Notes">
          <p className="text-sm font-normal">
            {entry.notes === null || entry.notes.length === 0
              ? "None"
              : entry.notes}
          </p>
        </FormField>
        {entry.isLeftover ? (
          <Badge className="w-fit" variant="warning">
            Leftover
          </Badge>
        ) : null}
        <form action={removeMealEntryAction} className="grid gap-3">
          <input name="entryId" type="hidden" value={entry.id} />
          <input
            name="idempotencyKey"
            type="hidden"
            value={crypto.randomUUID()}
          />
          <button
            className={cn(
              buttonVariants({ size: "lg", variant: "destructive" }),
              "w-full sm:w-fit",
            )}
            type="submit"
          >
            Remove from plan
          </button>
        </form>
      </div>
    </FormPage>
  );
}
