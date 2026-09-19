import { zurichCivilDate } from "../lib/dates";
import { formatCentimes } from "../lib/money-format";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import type { SessionState } from "../session/SessionProvider";
import { mockToday } from "./mockToday";
import { loadToday } from "./load-today";
import type { TodayViewModel } from "./types";

export type TodayState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: TodayViewModel };

export { formatCentimes, zurichCivilDate };

export function useToday(session: SessionState): {
  state: TodayState;
  refresh: () => void;
} {
  return useSessionBoundLoad(session, { model: mockToday }, loadToday);
}
