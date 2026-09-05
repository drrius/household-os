import Link from "next/link";

import { createRoutineAction } from "@/app/(product)/_actions/m7-routines";
import { loadRoutineFormOptions } from "@/lib/forms/options";
import { findRoutineStarter } from "@/lib/routines/starters";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RoutineForm } from "@/ui/forms/routine-form";

export default async function NewRoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string }>;
}) {
  const [options, query] = await Promise.all([
    loadRoutineFormOptions(),
    searchParams,
  ]);
  const starter = findRoutineStarter(query.starter);
  return (
    <FormPage
      backHref="/home"
      description="A little less to remember. Choose what, who, and when."
      title="New routine"
    >
      {options.areas.length === 0 ? (
        <p>
          Create a routine area in <Link href="/home/setup">Home setup</Link>{" "}
          first.
        </p>
      ) : (
        <RoutineForm
          action={createRoutineAction}
          areas={options.areas}
          defaultDate={zurichCivilDate()}
          defaults={
            starter
              ? {
                  title: starter.title,
                  instructions: starter.description,
                  areaId: options.areas.find(
                    (area) => area.name === starter.area,
                  )?.id,
                  scheduleMode: starter.scheduleMode,
                  scheduleRule: starter.scheduleRule,
                  priority: starter.priority,
                }
              : undefined
          }
          members={options.members}
          pets={options.pets}
          submitLabel="Create routine"
        />
      )}
    </FormPage>
  );
}
