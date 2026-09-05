import { z } from "zod";

import { startOfZurichWeek, zurichCivilDate } from "@/lib/ui/zurich-date";

export function mealDate(value: unknown, fallback = zurichCivilDate()): string {
  const parsed = z.iso.date().safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function mealPlanHref(date: string): string {
  const day = mealDate(date);
  return `/plan?week=${startOfZurichWeek(day)}&day=${day}`;
}
