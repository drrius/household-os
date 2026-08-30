"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { SparklesIcon } from "lucide-react";
import * as React from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAssistant } from "@/ui/assistant/assistant-context";
import {
  AssistantEmptyState,
  AssistantErrorNotice,
  AssistantMessages,
} from "@/ui/assistant/assistant-messages.client";

/** Media query with a stable server snapshot (desktop layout). */
function useIsPhoneViewport(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(max-width: 639px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}

function AssistantHeader() {
  return (
    <SheetHeader className="border-b border-border px-4 py-4 sm:px-5">
      <SheetTitle className="flex items-center gap-2 font-heading text-lg font-semibold">
        <SparklesIcon aria-hidden="true" className="size-4 text-primary" />
        Assistant
      </SheetTitle>
      <SheetDescription className="sr-only">
        Ask the assistant to manage routines, groceries, meals, and money.
      </SheetDescription>
    </SheetHeader>
  );
}

function AssistantComposer({
  input,
  setInput,
  submit,
  status,
  onStop,
}: {
  input: string;
  setInput: (value: string) => void;
  submit: () => void;
  status: "ready" | "submitted" | "streaming" | "error";
  onStop: () => void;
}) {
  return (
    <PromptInput
      className="pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <PromptInputTextarea
        onChange={(event) => setInput(event.currentTarget.value)}
        onSubmitRequest={submit}
        placeholder="Ask the assistant…"
        value={input}
      />
      <PromptInputSubmit
        disabled={input.trim().length === 0}
        onStop={onStop}
        status={status}
      />
    </PromptInput>
  );
}

export function AssistantPanel() {
  const { open, setOpen } = useAssistant();
  const isPhone = useIsPhoneViewport();
  const [input, setInput] = React.useState("");
  const transport = React.useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant/chat" }),
    [],
  );
  const chat = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const { messages, sendMessage, status } = chat;

  const submit = React.useCallback(() => {
    const text = input.trim();
    if (text.length === 0 || status === "submitted" || status === "streaming") {
      return;
    }
    setInput("");
    void sendMessage({ text });
  }, [input, sendMessage, status]);

  const lastMessage = messages.at(-1);
  const showThinking =
    (status === "submitted" || status === "streaming") &&
    (lastMessage?.role !== "assistant" ||
      !lastMessage.parts.some((part) => part.type === "text"));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        className={cn(
          "gap-0 p-0",
          "data-[side=bottom]:h-[88dvh] data-[side=bottom]:rounded-t-3xl",
          "data-[side=right]:sm:max-w-md",
        )}
        side={isPhone ? "bottom" : "right"}
      >
        <AssistantHeader />

        <Conversation>
          <ConversationContent>
            {messages.length === 0 && (
              <AssistantEmptyState
                onPick={(text) => void sendMessage({ text })}
              />
            )}
            <AssistantMessages
              messages={messages}
              respond={chat.addToolApprovalResponse}
            />
            {showThinking && <Loader />}
            {chat.error !== undefined && (
              <AssistantErrorNotice
                message={chat.error.message}
                onRetry={() => {
                  chat.clearError();
                  void chat.regenerate();
                }}
              />
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <AssistantComposer
          input={input}
          onStop={() => void chat.stop()}
          setInput={setInput}
          status={status}
          submit={submit}
        />
      </SheetContent>
    </Sheet>
  );
}
