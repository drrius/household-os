import { searchResultWithContext } from "@/domain/search/return-context";
import { searchCharacterCount } from "@/domain/search/query";
import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "./search-form";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import {
  searchHref,
  type SearchRequest,
  type SearchKind,
} from "@/domain/search/query";
import type { SearchPage, SearchResult } from "@/domain/search/results";
const labels: Record<SearchKind, string> = {
  routine: "Routine",
  occurrence: "Routine occurrence",
  meal: "Meal plan",
  meal_library: "Saved meal",
  grocery: "Grocery",
  money: "Money",
  project: "Project",
  trip: "Trip",
  booking: "Trip booking",
  task: "Project task",
  calendar: "Calendar",
  asset: "Inventory",
  contact: "Contact",
  commitment: "Commitment",
  decision: "Decision",
  document: "Document",
};
export function SearchScreen({
  request,
  page,
  base = "/search",
}: {
  request: SearchRequest;
  page: SearchPage;
  base?: "/search" | "/m7-fixture/search";
}) {
  const searching = searchCharacterCount(request.q) >= 2 && !request.error;
  return (
    <AppPage labelledBy="search-title">
      <div className="@container grid w-full max-w-4xl gap-6">
        <PageHeader
          title="Find it at home"
          titleId="search-title"
          eyebrow="Your household, connected"
        />
        <p className="max-w-xl text-sm text-muted-foreground">
          A plan, a purchase, the plumber’s number. Search the things you share,
          all in one place.
        </p>
        <SearchForm
          key={`${request.q}.${request.type}.${request.archived}.${request.cursor?.id ?? ""}`}
          request={request}
          base={base}
        />
        {request.error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive p-4 text-sm text-destructive"
          >
            {request.error}
          </p>
        ) : searching ? (
          <SearchResults request={request} page={page} base={base} />
        ) : (
          <SearchSuggestions
            short={searchCharacterCount(request.q) === 1}
            base={base}
          />
        )}
      </div>
    </AppPage>
  );
}
function SearchResults({
  request,
  page,
  base,
}: {
  request: SearchRequest;
  page: SearchPage;
  base: string;
}) {
  return (
    <section aria-labelledby="search-results-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="search-results-title" className="font-medium">
          Results for “{request.q}”
        </h2>
        <p role="status" className="text-sm text-muted-foreground">
          {page.total_count} {page.total_count === "1" ? "match" : "matches"}
          {request.cursor ? " · continued" : ""}
        </p>
      </div>
      {page.results.length ? (
        <ul className="grid list-none gap-3" aria-label="Search results">
          {page.results.map((result) => (
            <li key={`${result.kind}-${result.id}`}>
              <ResultCard result={result} request={request} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid justify-items-start gap-3 rounded-3xl border border-dashed p-6">
          <SearchX className="text-muted-foreground" aria-hidden />
          <h3 className="font-medium">
            {request.cursor ? "You’ve reached the end" : "Nothing found yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {request.cursor
              ? "Records can change while you browse. Return to the first page for the latest matches."
              : "Try a shorter word, a different category, or include archived and finished records."}
          </p>
        </div>
      )}
      <nav
        aria-label="Search result pages"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        {request.cursor ? (
          <Link
            href={searchHref(request, null, base)}
            className={buttonVariants({ variant: "outline" })}
          >
            Back to first page
          </Link>
        ) : (
          <span />
        )}
        {page.next_cursor ? (
          <Link
            href={searchHref(request, page.next_cursor, base)}
            className={buttonVariants()}
          >
            More results <ArrowRight size={18} aria-hidden />
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
function ResultCard({
  result,
  request,
}: {
  result: SearchResult;
  request: SearchRequest;
}) {
  const date = result.date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(result.date))
    : null;
  return (
    <Link
      href={searchResultWithContext(result, request)}
      prefetch={false}
      className="group flex min-h-24 items-center gap-4 rounded-2xl border bg-card p-4 no-underline transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{labels[result.kind]}</span>
          {date ? <span>· {date}</span> : null}
          {result.archived ? (
            <span className="rounded-full bg-secondary px-2">
              Archived or finished
            </span>
          ) : null}
        </div>
        <h3 className="font-medium break-words">{result.title}</h3>
        {result.excerpt.trim() ? (
          <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground break-words">
            {result.excerpt}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {result.status.replaceAll("_", " ")}
        </p>
      </div>
      <ArrowRight
        size={18}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
        aria-hidden
      />
    </Link>
  );
}
function SearchSuggestions({
  short,
  base,
}: {
  short: boolean;
  base: "/search" | "/m7-fixture/search";
}) {
  return (
    <section aria-labelledby="search-suggestions" className="grid gap-4 py-2">
      <h2 id="search-suggestions" className="font-medium">
        {short ? "Add one more character" : "A few places to start"}
      </h2>
      <div className="flex flex-wrap gap-2">
        {["Holiday", "Insurance", "Dinner", "Warranty"].map((q) => (
          <Link
            key={q}
            href={searchHref({ q, type: "all", archived: false }, null, base)}
            className={buttonVariants({ variant: "outline" })}
          >
            {q}
          </Link>
        ))}
      </div>
      <p className="max-w-xl text-sm text-muted-foreground">
        Search titles, notes and labels. Document contents and your iCloud
        sign-in details stay outside search.
      </p>
    </section>
  );
}
