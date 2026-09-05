import { z } from "zod";
import { resultKinds, searchCursorSchema, searchResultHref } from "./query";
// PostgreSQL text length/left count Unicode code points, not UTF-16 code units.
function postgresText(maximum: number) {
  return z.string().refine((value) => [...value].length <= maximum, {
    message: `Must contain at most ${maximum} characters`,
  });
}
const resultSchema = z.object({
  kind: z.enum(resultKinds),
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  title: postgresText(200).refine((value) => value.length > 0),
  excerpt: postgresText(240),
  status: postgresText(40),
  archived: z.boolean(),
  date: z.iso.date().nullable(),
  score: z.number().int().nonnegative(),
});
const pageSchema = z.object({
  total_count: z.string().regex(/^(0|[1-9]\d*)$/u),
  results: z.array(resultSchema).max(50),
  next_cursor: searchCursorSchema.nullable(),
});
export type SearchResult = z.infer<typeof resultSchema>;
export type SearchPage = z.infer<typeof pageSchema>;
export function parseSearchPage(value: unknown): SearchPage {
  const page = pageSchema.parse(value);
  for (const result of page.results) searchResultHref(result);
  return page;
}
export const emptySearchPage: SearchPage = {
  total_count: "0",
  results: [],
  next_cursor: null,
};
