"use server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function restartEditFixture() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  revalidatePath("/m7-fixture/home-form-refresh");
  redirect("/m7-fixture/home-form-refresh");
}
