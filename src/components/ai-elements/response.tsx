"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

type ResponseProps = {
  children: string;
  className?: string;
};

/** Streaming-safe markdown rendering for assistant text. */
export const Response = memo(
  function Response({ children, className }: ResponseProps) {
    return (
      <Streamdown
        className={cn(
          "space-y-3 [&_a]:text-primary [&_code]:font-mono [&_code]:text-[0.9em]",
          className,
        )}
      >
        {children}
      </Streamdown>
    );
  },
  (previous, next) =>
    previous.children === next.children && previous.className === next.className,
);
