import {
  parseSearchRequest,
  searchCharacterCount,
  searchHref,
  searchResultHref,
  type SearchRequest,
} from "@/domain/search/query";
import type { SearchResult } from "@/domain/search/results";

export function searchResultWithContext(
  result: Pick<SearchResult, "kind" | "id" | "parent_id">,
  request: SearchRequest,
) {
  const query = new URLSearchParams({
    fromSearch: searchHref(request, request.cursor),
  });
  return `${searchResultHref(result)}?${query}`;
}
export function searchReturnHref(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/search?") ||
    /[\u0000-\u001f\u007f\\]/u.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://household.invalid");
    if (
      url.origin !== "https://household.invalid" ||
      url.pathname !== "/search" ||
      url.hash
    )
      return null;
    const params: Record<string, string | string[]> = {};
    for (const key of url.searchParams.keys()) {
      if (!["q", "type", "archived", "cursor"].includes(key)) return null;
      const values = url.searchParams.getAll(key);
      params[key] = values.length === 1 ? values[0]! : values;
    }
    const request = parseSearchRequest(params);
    if (request.error || searchCharacterCount(request.q) < 2) return null;
    return searchHref(request, request.cursor);
  } catch {
    return null;
  }
}
