import { z } from "zod";
export const resultKinds = [
  "routine",
  "occurrence",
  "meal",
  "meal_library",
  "grocery",
  "money",
  "project",
  "trip",
  "booking",
  "task",
  "calendar",
  "asset",
  "contact",
  "commitment",
  "decision",
  "document",
] as const;
export type SearchKind = (typeof resultKinds)[number];
export const searchFilters = {
  all: "Everything",
  calendar: "Calendar",
  project: "Projects",
  trip: "Trips & bookings",
  task: "Project tasks",
  routine: "Routines",
  occurrence: "Routine occurrences",
  meal: "Meal plans",
  meal_library: "Meal library",
  grocery: "Groceries",
  money: "Money",
  asset: "Inventory",
  contact: "Contacts",
  commitment: "Bills & commitments",
  decision: "Decisions",
  document: "Documents",
} as const;
export type SearchFilter = keyof typeof searchFilters;
const uuid = z.uuid();
export const searchCursorSchema = z.object({
  score: z.number().int().nonnegative().max(2147483647),
  kind: z.enum(resultKinds),
  id: uuid,
});
export type SearchCursor = z.infer<typeof searchCursorSchema>;
export type SearchRequest = {
  q: string;
  type: SearchFilter;
  archived: boolean;
  cursor: SearchCursor | null;
  error: string | null;
};
export function parseSearchRequest(
  params: Record<string, string | string[] | undefined>,
): SearchRequest {
  const request: SearchRequest = {
    q:
      typeof params.q === "string" ? params.q.trim().replace(/\s+/gu, " ") : "",
    type: "all",
    archived: params.archived === "1",
    cursor: null,
    error: null,
  };
  if (Object.values(params).some(Array.isArray))
    request.error = "Use one search term and one value for each filter.";
  if (request.q.length > 120)
    request.error = "Keep your search to 120 characters or fewer.";
  if (
    typeof params.type === "string" &&
    !Object.hasOwn(searchFilters, params.type)
  )
    request.error = "Choose a search category from the list.";
  else if (typeof params.type === "string" && params.type)
    request.type = params.type as SearchFilter;
  if (params.archived && !["0", "1"].includes(String(params.archived)))
    request.error = "Choose whether to include archived and finished records.";
  if (typeof params.cursor === "string" && params.cursor) {
    const [score, kind, id, ...extra] = params.cursor.split(".");
    const parsed = searchCursorSchema.safeParse({
      score: Number(score),
      kind,
      id,
    });
    if (extra.length || !score || !/^\d+$/u.test(score) || !parsed.success)
      request.error =
        "This result page has expired. Search again to start from the beginning.";
    else request.cursor = parsed.data;
  }
  return request;
}
export function searchHref(
  request: Pick<SearchRequest, "q" | "type" | "archived">,
  cursor: SearchCursor | null = null,
  base = "/search",
): string {
  if (base !== "/search" && base !== "/m7-fixture/search")
    throw new Error("Invalid search destination.");
  const parts = [`q=${encodeURIComponent(request.q)}`];
  if (request.type !== "all")
    parts.push(`type=${encodeURIComponent(request.type)}`);
  if (request.archived) parts.push("archived=1");
  if (cursor) {
    const value = searchCursorSchema.parse(cursor);
    parts.push(`cursor=${value.score}.${value.kind}.${value.id}`);
  }
  return `${base}?${parts.join("&")}`;
}
export function searchResultHref(result: {
  kind: SearchKind;
  id: string;
  parent_id: string | null;
}): string {
  const id = uuid.parse(result.id);
  switch (result.kind) {
    case "routine":
      return `/home/routines/${id}/history`;
    case "occurrence":
      return `/home/occurrences/${id}`;
    case "meal":
      return `/plan/meals/${id}`;
    case "meal_library":
      return `/plan/library/${id}`;
    case "grocery":
      return `/groceries/items/${id}`;
    case "money":
      return `/money/events/${id}`;
    case "project":
    case "trip":
      return `/plan/projects/${id}`;
    case "booking":
      return `/plan/projects/${uuid.parse(result.parent_id)}`;
    case "task":
      return `/plan/projects/${uuid.parse(result.parent_id)}/tasks/${id}`;
    case "calendar":
      return `/plan/calendar/${id}`;
    case "asset":
      return `/home/inventory/${id}`;
    case "contact":
      return `/home/contacts/${id}`;
    case "commitment":
      return `/home/commitments/${id}`;
    case "decision":
      return `/home/decisions/${id}`;
    case "document":
      return `/home/documents/${id}`;
    default:
      throw new Error("Unsupported search result.");
  }
}
