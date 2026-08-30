"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type MessageProps = React.ComponentProps<"div"> & {
  from: "user" | "assistant" | "system";
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        from === "user" ? "justify-end" : "justify-start",
        className,
      )}
      data-role={from}
      {...props}
    />
  );
}

export function MessageContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-[85%] rounded-2xl text-base leading-relaxed break-words sm:text-sm",
        "in-data-[role=user]:rounded-br-md in-data-[role=user]:bg-primary in-data-[role=user]:px-4 in-data-[role=user]:py-2.5 in-data-[role=user]:text-primary-foreground",
        "in-data-[role=assistant]:max-w-full in-data-[role=assistant]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
