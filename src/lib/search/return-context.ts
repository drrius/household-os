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

export type SearchOrigin = { record: string; href: string };

export function searchOriginForPath(
  pathname: string,
  candidates: readonly string[],
  previous: SearchOrigin | null,
): SearchOrigin | null {
  if (candidates.length) {
    const href =
      candidates.length === 1 ? searchReturnHref(candidates[0]) : null;
    const records = [
      ...pathname.matchAll(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/giu,
      ),
    ];
    const last = records.at(-1);
    return href && last
      ? { record: pathname.slice(0, last.index + last[0].length), href }
      : null;
  }
  return previous &&
    (pathname === previous.record || pathname.startsWith(`${previous.record}/`))
    ? previous
    : null;
}
