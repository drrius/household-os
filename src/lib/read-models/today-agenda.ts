import "server-only";
import { unstable_rethrow } from "next/navigation";
import { loadHouseholdAgenda } from "./household-agenda";

export async function loadTodayAgenda(today: string) {
  try {
    return await loadHouseholdAgenda(today);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
