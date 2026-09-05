"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SearchOrigin } from "@/lib/search/return-context";

const SearchOriginContext = createContext<{
  origin: SearchOrigin | null;
  remember: (origin: SearchOrigin | null) => void;
} | null>(null);

export function SearchOriginProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<SearchOrigin | null>(null);
  const remember = useCallback((next: SearchOrigin | null) => {
    setOrigin((current) =>
      current?.record === next?.record && current?.href === next?.href
        ? current
        : next,
    );
  }, []);
  const value = useMemo(() => ({ origin, remember }), [origin, remember]);
  return <SearchOriginContext value={value}>{children}</SearchOriginContext>;
}
export function useSearchOrigin() {
  const context = useContext(SearchOriginContext);
  if (!context) throw new Error("Search origin provider is missing.");
  return context;
}

export function SearchReturnField() {
  const context = useContext(SearchOriginContext);
  return context?.origin ? (
    <input type="hidden" name="searchReturn" value={context.origin.href} />
  ) : null;
}
