"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { searchReturnHref } from "@/domain/search/return-context";

export function SearchReturn() {
  const pathname = usePathname();
  const query = useSearchParams();
  const candidates = query.getAll("fromSearch");
  const href = candidates.length === 1 ? searchReturnHref(candidates[0]) : null;
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
