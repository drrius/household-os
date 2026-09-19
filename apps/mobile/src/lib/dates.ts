import {
  addCivilDays,
  startOfZurichWeek,
  zurichCivilDate as zurichToday,
} from "../../../../src/lib/ui/zurich-date";

export { addCivilDays, startOfZurichWeek, zurichToday };

export function zurichCivilDate(offsetDays = 0): string {
  return addCivilDays(zurichToday(), offsetDays);
}
