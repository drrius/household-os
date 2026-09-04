export const MAX_GROCERY_POSITION = 2147483647;

export function nextGroceryPosition(previous: number | undefined): number {
  if (previous === undefined) return 0;
  if (
    !Number.isInteger(previous) ||
    previous < 0 ||
    previous > MAX_GROCERY_POSITION
  )
    throw new Error("Invalid grocery position");
  return Math.min(MAX_GROCERY_POSITION, previous + 10);
}
