"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseHomeItem } from "@/lib/forms/routine-home-settings";
import { FormFieldError } from "@/lib/forms/field-error";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  updateArea,
  reorderAreas,
  updatePet,
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

export async function updateAreaAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await updateArea(parseHomeItem(formData));
  });
  if (rejected) return rejected;
  revalidatePath("/home");
  revalidatePath("/home/setup");
  redirect("/home/setup?saved=area-updated#areas");
}

export async function updatePetAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await updatePet(parseHomeItem(formData));
  });
  if (rejected) return rejected;
  revalidatePath("/home");
  revalidatePath("/home/setup");
  redirect("/home/setup?saved=pet-updated#pets");
}

export async function reorderAreasAction(
  ids: string[],
): Promise<{ error?: string }> {
  try {
    await reorderAreas(z.array(z.string().uuid()).max(1000).parse(ids));
  } catch {
    return {
      error: "Couldn't change the order. Refresh the list and try again.",
    };
  }
  revalidatePath("/home");
  revalidatePath("/home/setup");
  return {};
}
