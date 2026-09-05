import { searchCharacterCount } from "@/domain/search/query";
import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import type { SearchRequest } from "@/domain/search/query";
import {
  emptySearchPage,
  parseSearchPage,
  type SearchPage,
} from "@/domain/search/results";
export async function loadHouseholdSearch(
  request: SearchRequest,
): Promise<SearchPage> {
  await requireMemberContext();
  if (request.error || searchCharacterCount(request.q) < 2)
    return emptySearchPage;
  const db = await createClient();
  const { data, error } = await db.rpc("search_household", {
    p_query: request.q,
    p_types: request.type === "all" ? null : [request.type],
    p_include_archived: request.archived,
    p_page_size: 25,
    p_after_score: request.cursor?.score ?? null,
    p_after_kind: request.cursor?.kind ?? null,
    p_after_id: request.cursor?.id ?? null,
  });
  if (error)
    throw new Error(
      "Search couldn't load your household. Try again in a moment.",
    );
  return parseSearchPage(data);
}
