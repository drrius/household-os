"use client";

import type { ChatStatus } from "ai";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type AssistantComposerProps = {
  input: string;
  setInput: (value: string) => void;
  submit: () => void;
  status: ChatStatus;
  onStop: () => void;
};

function SubmitIcon({ status }: { status: ChatStatus }) {
  if (status === "submitted") {
    return <Spinner />;
  }
  if (status === "streaming") {
    return <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />;
  }
  return <ArrowUpIcon aria-hidden="true" />;
}

/**
 * One field, one action, one border. The textarea grows with its content from
 * a single line, so an empty composer never looks like an abandoned form.
 */
export function AssistantComposer({
  input,
  setInput,
  submit,
  status,
  onStop,
}: AssistantComposerProps) {
  const isBusy = status === "submitted" || status === "streaming";
  const isEmpty = input.trim().length === 0;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }
      // Keep the draft: Enter must neither submit nor break the line mid-stream.
      event.preventDefault();
      if (!isBusy) {
        submit();
      }
    },
    [isBusy, submit],
  );

  return (
    <form
      className="border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-3xl border border-border bg-card py-1.5 pr-1.5 pl-4 focus-within:border-ring/40 focus-within:ring-3 focus-within:ring-ring/15">
        <label className="sr-only" htmlFor="assistant-message">
          Message the assistant
        </label>
        <textarea
          className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none sm:min-h-9 sm:text-sm"
          id="assistant-message"
          name="message"
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the assistant"
          rows={1}
          value={input}
        />
        <Button
          aria-label={isBusy ? "Stop the assistant" : "Send"}
          className="size-10 rounded-full sm:size-9"
          disabled={!isBusy && isEmpty}
          onClick={isBusy ? onStop : undefined}
          size="icon-sm"
          type={isBusy ? "button" : "submit"}
        >
          <SubmitIcon status={status} />
        </Button>
      </div>
    </form>
  );
}
