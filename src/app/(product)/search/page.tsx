import { parseSearchRequest } from "@/domain/search/query";
import { loadHouseholdSearch } from "@/lib/search/read";
import { SearchScreen } from "@/ui/search/search-screen";
export default async function HouseholdSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const request = parseSearchRequest(await searchParams);
  const page = await loadHouseholdSearch(request);
  return <SearchScreen request={request} page={page} />;
}
