"use client";

import { isToolUIPart, type UIMessage } from "ai";
import {
  ArrowUpRightIcon,
  CalendarCheckIcon,
  RepeatIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TriangleAlertIcon,
  WalletIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ApprovalPart,
  needsApproval,
  ToolActivity,
  type AnyToolPart,
  type ApprovalResponder,
} from "@/ui/assistant/assistant-tool-view.client";

type SuggestionEntry = {
  readonly text: string;
  readonly Icon: ComponentType<{ className?: string }>;
};

const SUGGESTIONS: readonly SuggestionEntry[] = [
  { text: "What's due today?", Icon: CalendarCheckIcon },
  { text: "Add milk and bread to the groceries", Icon: ShoppingCartIcon },
  { text: "Set up a weekly bathroom cleaning routine", Icon: RepeatIcon },
  { text: "How do we stand on money?", Icon: WalletIcon },
];

export function AssistantEmptyState({
  onPick,
}: {
  onPick: (text: string) => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <SparklesIcon aria-hidden="true" className="size-6 text-primary" />
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Ask for anything
        </h2>
        <p className="max-w-[32ch] text-base text-muted-foreground text-pretty sm:text-sm">
          Routines, groceries, meals, and money — in plain words.
        </p>
      </div>

      <ul className="grid gap-2" role="list">
        {SUGGESTIONS.map(({ text, Icon }) => (
          <li key={text}>
            <button
              className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left text-base hover:bg-muted/60 sm:text-sm"
              onClick={() => onPick(text)}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className="size-4 h-lh shrink-0 text-primary"
              />
              <span className="min-w-0 flex-1">{text}</span>
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-4 h-lh shrink-0 text-muted-foreground"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssistantThinking() {
  return (
    <div
      className="flex items-center gap-2 text-base text-muted-foreground sm:text-sm"
      role="status"
    >
      <span aria-hidden="true" className="flex h-lh items-center gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
      </span>
      Thinking
    </div>
  );
}

export function AssistantErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/30">
      <p className="flex items-start gap-2 text-base text-destructive-strong text-pretty sm:text-sm">
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-4 h-lh shrink-0"
        />
        <span className="min-w-0 flex-1">{message}</span>
      </p>
      <Button
        className="mt-3"
        onClick={onRetry}
        size="sm"
        type="button"
        variant="outline"
      >
        Try again
      </Button>
    </div>
  );
}

/** A run of consecutive tool calls renders as one activity block. */
type Block =
  | { readonly kind: "text"; readonly key: string; readonly text: string }
  | {
      readonly kind: "tools";
      readonly key: string;
      readonly parts: AnyToolPart[];
    }
  | {
      readonly kind: "approval";
      readonly key: string;
      readonly part: AnyToolPart;
    };

function toBlocks(message: UIMessage): readonly Block[] {
  const blocks: Block[] = [];
  let run: { kind: "tools"; key: string; parts: AnyToolPart[] } | null = null;

  for (const [index, part] of message.parts.entries()) {
    const key = `${message.id}-${index}`;
    if (isToolUIPart(part)) {
      if (needsApproval(part)) {
        run = null;
        blocks.push({ kind: "approval", key, part });
        continue;
      }
      if (run === null) {
        run = { kind: "tools", key, parts: [part] };
        blocks.push(run);
      } else {
        run.parts.push(part);
      }
      continue;
    }
    run = null;
    if (part.type === "text") {
      blocks.push({ kind: "text", key, text: part.text });
    }
  }

  return blocks;
}

export function AssistantMessages({
  messages,
  respond,
}: {
  messages: readonly UIMessage[];
  respond: ApprovalResponder;
}) {
  return (
    <>
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <div
            className={cn(
              "grid gap-3 text-base text-foreground sm:text-sm",
              isUser
                ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-3.5 py-2.5"
                : "max-w-full",
            )}
            key={message.id}
          >
            {toBlocks(message).map((block) => {
              if (block.kind === "approval") {
                return (
                  <ApprovalPart
                    key={block.key}
                    part={block.part}
                    respond={respond}
                  />
                );
              }
              if (block.kind === "tools") {
                return <ToolActivity key={block.key} parts={block.parts} />;
              }
              return isUser ? (
                <p className="whitespace-pre-wrap text-pretty" key={block.key}>
                  {block.text}
                </p>
              ) : (
                <MessageResponse key={block.key}>{block.text}</MessageResponse>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
