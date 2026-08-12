"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorHref } from "@/app/(product)/_actions/m7-shared";
import {
  createArea,
  createPet,
  updateHouseholdName,
} from "@/lib/household/commands";

async function runHouseholdAction(
  formData: FormData,
  nameSchema: z.ZodString,
  command: (name: string) => Promise<unknown>,
  saved: "area" | "household" | "pet",
): Promise<void> {
  let failure: unknown = null;
  try {
    await command(nameSchema.parse(formData.get("name")));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) redirect(errorHref("/home/setup", failure));
  revalidatePath("/home");
  redirect(`/home/setup?saved=${saved}`);
}

export async function createAreaAction(formData: FormData): Promise<void> {
  await runHouseholdAction(
    formData,
    z.string().trim().min(1).max(80),
    createArea,
    "area",
  );
}

export async function createPetAction(formData: FormData): Promise<void> {
  await runHouseholdAction(
    formData,
    z.string().trim().min(1).max(80),
    createPet,
    "pet",
  );
}

export async function updateHouseholdNameAction(
  formData: FormData,
): Promise<void> {
  await runHouseholdAction(
    formData,
    z.string().trim().min(1).max(120),
    updateHouseholdName,
    "household",
  );
}
