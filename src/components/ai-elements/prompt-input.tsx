"use client";

import { ArrowUpIcon, SquareIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PromptInput({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form
      className={cn(
        "flex items-end gap-2 border-t border-border bg-popover px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

type PromptInputTextareaProps = React.ComponentProps<typeof Textarea> & {
  onSubmitRequest: () => void;
};

export function PromptInputTextarea({
  className,
  onSubmitRequest,
  ...props
}: PromptInputTextareaProps) {
  return (
    <Textarea
      autoComplete="off"
      className={cn("max-h-40 min-h-11 flex-1 py-2.5", className)}
      onKeyDown={(event) => {
        // Enter sends on hardware keyboards; Shift+Enter keeps the newline.
        // Virtual keyboards keep Enter as newline and use the send button.
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onSubmitRequest();
        }
      }}
      rows={1}
      {...props}
    />
  );
}

type PromptInputSubmitProps = React.ComponentProps<typeof Button> & {
  status: "ready" | "submitted" | "streaming" | "error";
  onStop?: () => void;
};

export function PromptInputSubmit({
  className,
  status,
  onStop,
  disabled,
  ...props
}: PromptInputSubmitProps) {
  const isBusy = status === "submitted" || status === "streaming";
  if (isBusy && onStop !== undefined) {
    return (
      <Button
        aria-label="Stop generating"
        className={cn("shrink-0", className)}
        onClick={onStop}
        size="icon"
        type="button"
        variant="secondary"
      >
        <SquareIcon className="size-3.5 fill-current" />
      </Button>
    );
  }
  return (
    <Button
      aria-label="Send message"
      className={cn("shrink-0", className)}
      disabled={disabled || isBusy}
      size="icon"
      type="submit"
      {...props}
    >
      <ArrowUpIcon />
    </Button>
  );
}
