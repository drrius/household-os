import { notFound } from "next/navigation";
import { parseSearchRequest } from "@/domain/search/query";
import { emptySearchPage } from "@/domain/search/results";
import { SearchScreen } from "@/ui/search/search-screen";
import { AppShell } from "@/ui/shell/app-shell";
import { fixtureSearch } from "./fixtures";
export default async function SearchFixture({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const request = parseSearchRequest(await searchParams);
  return (
    <AppShell>
      <SearchScreen
        request={request}
        page={
          request.q.length >= 2 && !request.error
            ? fixtureSearch(request)
            : emptySearchPage
        }
        base="/m7-fixture/search"
      />
    </AppShell>
  );
}
