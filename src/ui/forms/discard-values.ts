export type DiscardValue = { name: string; value: string };
const metadata = new Set([
  "idempotencyKey",
  "routineId",
  "draftId",
  "expectedVersion",
]);

export function discardSnapshot(values: readonly DiscardValue[]): string {
  return JSON.stringify(
    values
      .filter(
        ({ name }) =>
          name && !name.startsWith("$ACTION_") && !metadata.has(name),
      )
      .map(({ name, value }) => [name, value])
      .sort(
        ([nameA, valueA], [nameB, valueB]) =>
          nameA!.localeCompare(nameB!) || valueA!.localeCompare(valueB!),
      ),
  );
}

export function leavesCurrentDocument(
  href: string,
  currentHref: string,
): boolean {
  const target = new URL(href, currentHref);
  const current = new URL(currentHref);
  return (
    target.origin === current.origin &&
    (target.pathname !== current.pathname || target.search !== current.search)
  );
}
