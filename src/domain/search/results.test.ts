import { expect, it } from "vitest";
import { parseSearchPage } from "./results";
const result = {
  kind: "document",
  id: "00000000-0000-4000-8000-000000000001",
  parent_id: null,
  title: "Contract",
  excerpt: "",
  status: "active",
  archived: false,
  date: null,
  score: 1,
};
function parse(fields: Partial<typeof result>) {
  return parseSearchPage({
    total_count: "1",
    results: [{ ...result, ...fields }],
    next_cursor: null,
  });
}
it("accepts full PostgreSQL character bounds with astral Unicode text without truncating it", () => {
  const title = "Trip " + "😀".repeat(195),
    excerpt = "🧳".repeat(240);
  expect(title.length).toBeGreaterThan(200);
  expect(parse({ title, excerpt }).results[0]).toMatchObject({
    title,
    excerpt,
  });
});
it.each([
  { title: "😀".repeat(201) },
  { title: "a".repeat(201) },
  { title: "" },
  { excerpt: "🧳".repeat(241) },
  { excerpt: "a".repeat(241) },
])("rejects values beyond the database result contract", (fields) => {
  expect(() => parse(fields)).toThrow();
});
it("counts combining sequences as code points, matching PostgreSQL rather than graphemes", () => {
  expect(
    parse({ title: "e\u0301".repeat(100) }).results[0]?.title,
  ).toHaveLength(200);
  expect(() => parse({ title: "e\u0301".repeat(101) })).toThrow();
});
