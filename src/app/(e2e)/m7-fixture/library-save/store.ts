import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
type FixtureState = { revision: number; name: string; ids: string[] };
const runtime = globalThis as typeof globalThis & {
  librarySaveFixture?: Map<string, FixtureState>;
};
function store() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (runtime.librarySaveFixture ??= new Map());
}
export function readFixture(id: string) {
  z.uuid().parse(id);
  return structuredClone(
    store().get(id) ?? { revision: 1, name: "Pasta", ids: [] },
  );
}
export function writeFixture(id: string, state: FixtureState) {
  const records = store();
  if (records.size > 100) records.delete(records.keys().next().value!);
  records.set(id, state);
}
