"use client";

import { cn } from "@/lib/utils";

/** Three-dot typing indicator shown while the assistant is thinking. */
export function Loader({ className }: { className?: string }) {
  return (
    <span
      aria-label="The assistant is thinking"
      className={cn("inline-flex items-center gap-1 py-1", className)}
      role="status"
    >
      {[0, 1, 2].map((dot) => (
        <span
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-pulse"
          key={dot}
          style={{ animationDelay: `${dot * 150}ms` }}
        />
      ))}
    </span>
  );
}
