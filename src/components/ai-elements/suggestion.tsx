"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Suggestions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap justify-center gap-2", className)}
      {...props}
    />
  );
}

type SuggestionProps = {
  suggestion: string;
  onSelect: (suggestion: string) => void;
  className?: string;
};

export function Suggestion({
  suggestion,
  onSelect,
  className,
}: SuggestionProps) {
  return (
    <button
      className={cn(
        "min-h-9 rounded-4xl border border-border bg-card px-3.5 py-1.5 text-sm text-foreground outline-none hover:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      onClick={() => onSelect(suggestion)}
      type="button"
    >
      {suggestion}
    </button>
  );
}
