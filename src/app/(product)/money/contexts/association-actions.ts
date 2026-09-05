"use server";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  costTargetHref,
  costTargetSchema,
  type CostTarget,
} from "@/domain/money/cost-target";
import { assignExpenseContext } from "@/lib/connected/cost-associations";
import { formRejection, type FormActionState } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
import { revalidateProduct } from "@/app/(product)/_actions/m7-shared";
export async function associateExpenseAction(
  eventId: string,
  inputTarget: CostTarget | null,
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let target: CostTarget | null;
  try {
    target = inputTarget ? costTargetSchema.parse(inputTarget) : null;
    await assignExpenseContext({
      eventId: z.uuid().parse(eventId),
      target,
      expectedRevision: z
        .uuid()
        .nullable()
        .parse(form.get("expectedRevision") || null),
      requestId: z.uuid().parse(form.get("requestId")),
    });
  } catch (error) {
    unstable_rethrow(error);
    return formRejection(previous, error, echoValues(form));
  }
  revalidatePath("/money/contexts", "layout");
  revalidateProduct(["/money", "/money/contexts", "/home", "/plan"]);
  if (!target) redirect("/money/contexts?association=removed");
  redirect(
    `${costTargetHref(target)}${target.bookingId ? "&" : "?"}association=saved`,
  );
}
