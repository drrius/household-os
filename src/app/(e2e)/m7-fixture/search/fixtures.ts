import type { SearchRequest } from "@/domain/search/query";
import {
  parseSearchPage,
  type SearchPage,
  type SearchResult,
} from "@/domain/search/results";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (
  n: number,
  kind: SearchResult["kind"],
  title: string,
  excerpt: string,
  archived = false,
): SearchResult => ({
  id: uuid(n),
  kind,
  title,
  excerpt,
  archived,
  parent_id: ["booking", "task"].includes(kind) ? uuid(1) : null,
  status: archived ? "cancelled" : "active",
  date: null,
  score: 100,
});
const records: SearchResult[] = [
  row(7, "document", "Emoji " + "😀".repeat(194), "Pack " + "🧳".repeat(235)),
  row(
    1,
    "trip",
    "Lisbon in September",
    "A long weekend together. Flights, places to stay and a little time to wander.",
  ),
  row(2, "booking", "Lisbon flight", "Zurich → Lisbon · confirmation LX2026"),
  row(
    3,
    "booking",
    "Lisbon riverside hotel",
    "Three nights near the old town.",
  ),
  row(
    4,
    "trip",
    "Lisbon last summer",
    "A cancelled plan worth coming back to.",
    true,
  ),
  row(
    5,
    "money",
    "Lisbon flight payment",
    "Paid by Darius · shared with Partner",
  ),
  row(
    6,
    "contact",
    "Home repairs",
    "Our plumber’s number <img src=x onerror=alert(1)>",
  ),
  ...Array.from({ length: 32 }, (_, index) =>
    row(
      index + 100,
      "asset",
      `Warranty record ${String(index + 1).padStart(2, "0")}`,
      "Home appliances · Manuals and purchase details",
      index >= 24,
    ),
  ),
];
export function fixtureSearch(request: SearchRequest): SearchPage {
  const matches = records
    .filter(
      (row) =>
        (request.archived || !row.archived) &&
        (request.type === "all" ||
          row.kind === request.type ||
          (request.type === "trip" && row.kind === "booking")) &&
        `${row.title} ${row.excerpt}`
          .toLowerCase()
          .includes(request.q.toLowerCase()),
    )
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  const offset = request.cursor
    ? matches.findIndex(
        (item) =>
          item.kind === request.cursor!.kind && item.id === request.cursor!.id,
      ) + 1
    : 0;
  const results = matches.slice(offset, offset + 25),
    last = results.at(-1);
  return parseSearchPage({
    total_count: String(matches.length),
    results,
    next_cursor:
      last && offset + 25 < matches.length
        ? { score: last.score, kind: last.kind, id: last.id }
        : null,
  });
}
