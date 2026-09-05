import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchFilters, type SearchRequest } from "@/domain/search/query";
export function SearchForm({
  request,
  base,
}: {
  request: SearchRequest;
  base: string;
}) {
  return (
    <form
      action={base}
      method="get"
      role="search"
      className="grid gap-4 rounded-3xl border bg-card p-4 @sm:p-5"
    >
      <label htmlFor="household-search" className="text-sm font-medium">
        What are you looking for?
      </label>
      <div className="flex gap-2">
        <Input
          id="household-search"
          name="q"
          type="search"
          defaultValue={request.q}
          placeholder="Try Lisbon, insurance or pasta…"
          maxLength={120}
          autoComplete="off"
          className="min-w-0 flex-1"
          aria-describedby="search-hint"
        />
        <Button type="submit">
          <Search size={18} aria-hidden />
          <span className="sr-only @sm:not-sr-only">Search</span>
        </Button>
      </div>
      <SearchFilters request={request} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p id="search-hint">
          Start with two characters. Financial history is always included.
        </p>
        {request.q || request.type !== "all" || request.archived ? (
          <Link
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            href={base}
          >
            Clear search
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function SearchFilters({ request }: { request: SearchRequest }) {
  return (
    <div className="grid items-end gap-3 @lg:grid-cols-[1fr_auto]">
      <div className="grid gap-2 text-sm font-medium">
        <label htmlFor="search-category">Search in</label>
        <select
          id="search-category"
          name="type"
          defaultValue={request.type}
          className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal"
        >
          {Object.entries(searchFilters).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          name="archived"
          type="checkbox"
          value="1"
          defaultChecked={request.archived}
          className="size-5 shrink-0 accent-primary"
        />
        Include archived and finished
      </label>
    </div>
  );
}
