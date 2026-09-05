"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchOrigin } from "./search-origin.client";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  searchReturnHref,
  searchOriginForPath,
} from "@/lib/search/return-context";

export function SearchReturn() {
  const pathname = usePathname();
  const query = useSearchParams();
  const { origin: previous, remember } = useSearchOrigin();
  const candidates = query.getAll("fromSearch");
  const origin = searchOriginForPath(pathname, candidates, previous);
  const href =
    candidates.length === 1 ? searchReturnHref(candidates[0]) : origin?.href;
  const queryString = query.toString();
  const record = origin?.record;
  const returnHref = origin?.href;
  useEffect(() => {
    remember(record && returnHref ? { record, href: returnHref } : null);
    const params = new URLSearchParams(queryString);
    if (returnHref && !params.has("fromSearch")) {
      params.set("fromSearch", returnHref);
      // Keep the continuation in the URL for edit reloads and auth redirects.
      window.history.replaceState(
        null,
        "",
        `${pathname}?${params}${window.location.hash}`,
      );
    }
  }, [pathname, queryString, record, returnHref, remember]);
  if (!href || pathname === "/search") return null;
  return (
    <Link
      href={href}
      className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to search results
    </Link>
  );
}
