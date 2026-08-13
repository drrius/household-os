import { redirect } from "next/navigation";

import { loadLibraryMealTitle } from "@/lib/read-models/meal-entry-manage";
import { CreateMealForm, PlaceLibraryMealForm } from "@/ui/plan/new-meal-forms";

export default async function NewMealPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    libraryId?: string;
    slot?: string;
  }>;
}) {
  const query = await searchParams;
  const slot = ["breakfast", "lunch", "dinner"].includes(query.slot ?? "")
    ? query.slot
    : "dinner";
  const libraryId =
    typeof query.libraryId === "string" && query.libraryId.length > 0
      ? query.libraryId
      : null;
  const libraryTitle =
    libraryId === null ? null : await loadLibraryMealTitle(libraryId);

  if (libraryId !== null && libraryTitle === null) {
    redirect("/plan/meals/new");
  }

  if (libraryId !== null && libraryTitle !== null) {
    return (
      <PlaceLibraryMealForm
        date={query.date}
        libraryId={libraryId}
        libraryTitle={libraryTitle}
        slot={slot}
      />
    );
  }

  return <CreateMealForm date={query.date} slot={slot} />;
}
