import Link from "next/link";

import { createRoutineAction } from "@/app/(product)/_actions/m7-routines";
import { loadRoutineFormOptions } from "@/lib/forms/options";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RoutineForm } from "@/ui/forms/routine-form";

export default async function NewRoutinePage() {
  const options = await loadRoutineFormOptions();
  return (
    <FormPage
      backHref="/home"
      description="Create one-off or recurring household work with an explicit responsibility policy."
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
          members={options.members}
          pets={options.pets}
          submitLabel="Create routine"
        />
      )}
    </FormPage>
  );
}
