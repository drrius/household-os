"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { echoValues } from "@/app/(product)/_actions/m7-shared";
import { FormFieldError } from "@/lib/forms/field-error";
import { formRejection } from "@/lib/forms/m7";
import {
  createArea,
  createPet,
  updateHouseholdName,
} from "@/lib/household/commands";
import type { FormActionState } from "@/ui/forms/form-action";

/**
 * `required` lets whitespace through, so the trimmed schema is the real gate.
 * Naming the control keeps that rejection attached to the field.
 */
function requireName(formData: FormData, nameSchema: z.ZodString): string {
  const value = formData.get("name");
  const parsed = nameSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) {
    throw new FormFieldError("name", "Enter a name.");
  }
  return parsed.data;
}

async function runHouseholdAction(
  previous: FormActionState,
  formData: FormData,
  nameSchema: z.ZodString,
  command: (name: string) => Promise<unknown>,
  saved: "area" | "household" | "pet",
): Promise<FormActionState> {
  let failure: unknown = null;
  try {
    await command(requireName(formData, nameSchema));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return formRejection(previous, failure, echoValues(formData, ["name"]));
  }
  revalidatePath("/home");
  redirect(`/home/setup?saved=${saved}`);
}

export async function createAreaAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  return runHouseholdAction(
    previous,
    formData,
    z.string().trim().min(1).max(80),
    createArea,
    "area",
  );
}

export async function createPetAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  return runHouseholdAction(
    previous,
    formData,
    z.string().trim().min(1).max(80),
    createPet,
    "pet",
  );
}

export async function updateHouseholdNameAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  return runHouseholdAction(
    previous,
    formData,
    z.string().trim().min(1).max(120),
    updateHouseholdName,
    "household",
  );
}
