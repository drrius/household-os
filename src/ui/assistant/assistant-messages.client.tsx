"use client";

import { isToolUIPart, type UIMessage } from "ai";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import {
  ToolPart,
  type ApprovalResponder,
} from "@/ui/assistant/assistant-tool-view.client";

const SUGGESTIONS = [
  "What's due today?",
  "Add milk and bread to the groceries",
  "Set up a weekly bathroom cleaning routine",
  "How do we stand on money?",
];

export function AssistantEmptyState({
  onPick,
}: {
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-10 text-center">
      <p className="max-w-xs text-balance text-muted-foreground">
        Ask for anything you would otherwise tap through — routines, groceries,
        meals, or money.
      </p>
      <Suggestions>
        {SUGGESTIONS.map((suggestion) => (
          <Suggestion
            key={suggestion}
            onSelect={onPick}
            suggestion={suggestion}
          />
        ))}
      </Suggestions>
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
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="text-destructive">Something went wrong: {message}</p>
      <Button
        className="mt-2"
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

export function AssistantMessages({
  messages,
  respond,
}: {
  messages: readonly UIMessage[];
  respond: ApprovalResponder;
}) {
  return (
    <>
      {messages.map((message) => (
        <Message from={message.role} key={message.id}>
          <MessageContent>
            <div className="grid gap-2">
              {message.parts.map((part, index) => {
                const key = `${message.id}-${index}`;
                if (part.type === "text") {
                  return message.role === "user" ? (
                    <p className="whitespace-pre-wrap" key={key}>
                      {part.text}
                    </p>
                  ) : (
                    <Response key={key}>{part.text}</Response>
                  );
                }
                if (isToolUIPart(part)) {
                  return <ToolPart key={key} part={part} respond={respond} />;
                }
                return null;
              })}
            </div>
          </MessageContent>
        </Message>
      ))}
    </>
  );
}
