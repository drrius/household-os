"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { FormFieldError } from "@/lib/forms/field-error";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  createArea,
  createPet,
  updateHouseholdName,
} from "@/lib/household/commands";

function requireName(formData: FormData, nameSchema: z.ZodString): string {
  const value = formData.get("name");
  const parsed = nameSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) {
    throw new FormFieldError("name", "Enter a name.");
  }
  return parsed.data;
}

async function householdNameAction(
  previous: FormActionState,
  formData: FormData,
  nameSchema: z.ZodString,
  command: (name: string) => Promise<unknown>,
  saved: "area" | "household" | "pet",
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await command(requireName(formData, nameSchema));
  });
  if (rejected) return rejected;
  revalidatePath("/home");
  redirect(`/home/setup?saved=${saved}`);
}

export async function createAreaAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  return householdNameAction(
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
  return householdNameAction(
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
  return householdNameAction(
    previous,
    formData,
    z.string().trim().min(1).max(120),
    updateHouseholdName,
    "household",
  );
}
