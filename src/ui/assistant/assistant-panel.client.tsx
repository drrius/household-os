"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ChatStatus,
  type UIMessage,
} from "ai";
import { SparklesIcon, SquarePenIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAssistant } from "@/ui/assistant/assistant-context";
import { AssistantComposer } from "@/ui/assistant/assistant-composer.client";
import {
  AssistantEmptyState,
  AssistantErrorNotice,
  AssistantMessages,
  AssistantThinking,
} from "@/ui/assistant/assistant-messages.client";
import { activityTone } from "@/ui/assistant/assistant-tool-labels";
import type { ApprovalResponder } from "@/ui/assistant/assistant-tool-view.client";

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

function isPendingTool(part: UIMessage["parts"][number]): boolean {
  return isToolUIPart(part) && activityTone(part) === "running";
}

function AssistantHeader({
  onNewChat,
  canReset,
}: {
  onNewChat: () => void;
  canReset: boolean;
}) {
  return (
    <SheetHeader className="gap-0 border-b border-border p-0">
      {/* Grab handle: the panel is a bottom sheet on phones only. */}
      <div
        aria-hidden="true"
        className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden"
      />
      <div className="flex items-center gap-1 py-2 pr-2 pl-4 sm:pl-5">
        <SheetTitle className="flex min-w-0 flex-1 items-center gap-2 font-heading text-base font-semibold">
          <SparklesIcon
            aria-hidden="true"
            className="size-4 h-lh shrink-0 text-primary"
          />
          Assistant
        </SheetTitle>
        <Button
          aria-label="Start a new conversation"
          disabled={!canReset}
          onClick={onNewChat}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <SquarePenIcon />
        </Button>
        <SheetClose
          render={<Button size="icon-sm" type="button" variant="ghost" />}
        >
          <XIcon />
          <span className="sr-only">Close the assistant</span>
        </SheetClose>
      </div>
      <SheetDescription className="sr-only">
        Ask the assistant to manage routines, groceries, meals, and money.
      </SheetDescription>
    </SheetHeader>
  );
}

export type AssistantPanelViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: readonly UIMessage[];
  status: ChatStatus;
  errorMessage: string | undefined;
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onNewChat: () => void;
  onRetry: () => void;
  onPickSuggestion: (text: string) => void;
  respond: ApprovalResponder;
};

/**
 * The panel's whole appearance, with no transport attached, so fixtures can
 * render every conversation state without a live model behind them.
 */
export function AssistantPanelView({
  open,
  onOpenChange,
  messages,
  status,
  errorMessage,
  input,
  setInput,
  onSubmit,
  onStop,
  onNewChat,
  onRetry,
  onPickSuggestion,
  respond,
}: AssistantPanelViewProps) {
  const isPhone = useIsPhoneViewport();
  const lastMessage = messages.at(-1);
  // A running tool already narrates itself; two spinners would say the same
  // thing twice.
  const showThinking =
    (status === "submitted" || status === "streaming") &&
    (lastMessage?.role !== "assistant" ||
      !lastMessage.parts.some(
        (part) => part.type === "text" || isPendingTool(part),
      ));
  const isEmpty = messages.length === 0 && errorMessage === undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "gap-0 p-0",
          "data-[side=bottom]:h-[88dvh] data-[side=bottom]:rounded-t-3xl",
          "data-[side=right]:sm:max-w-md",
        )}
        showCloseButton={false}
        side={isPhone ? "bottom" : "right"}
      >
        <AssistantHeader canReset={!isEmpty} onNewChat={onNewChat} />

        {isEmpty ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
            {/* m-auto, not justify-center: centring must not clip the top
                when the suggestions outgrow a short viewport. */}
            <div className="m-auto w-full">
              <AssistantEmptyState onPick={onPickSuggestion} />
            </div>
          </div>
        ) : (
          <Conversation>
            <ConversationContent className="gap-6 px-4 py-5">
              <AssistantMessages messages={messages} respond={respond} />
              {showThinking && <AssistantThinking />}
              {errorMessage !== undefined && (
                <AssistantErrorNotice
                  message={errorMessage}
                  onRetry={onRetry}
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        <AssistantComposer
          input={input}
          onStop={onStop}
          setInput={setInput}
          status={status}
          submit={onSubmit}
        />
      </SheetContent>
    </Sheet>
  );
}

export function AssistantPanel() {
  const { open, setOpen } = useAssistant();
  const [input, setInput] = React.useState("");
  const transport = React.useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant/chat" }),
    [],
  );
  const router = useRouter();
  const chat = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // Tool calls mutate data the route behind the panel may render, and
    // revalidatePath alone cannot repaint an already-open client route.
    onFinish: () => router.refresh(),
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

  const startNewChat = React.useCallback(() => {
    // Also the escape hatch from the 200-message request cap.
    void chat.stop();
    chat.setMessages([]);
    chat.clearError();
    setInput("");
  }, [chat]);

  return (
    <AssistantPanelView
      errorMessage={chat.error?.message}
      input={input}
      messages={messages}
      onNewChat={startNewChat}
      onOpenChange={setOpen}
      onPickSuggestion={(text) => void chat.sendMessage({ text })}
      onRetry={() => {
        chat.clearError();
        void chat.regenerate();
      }}
      onStop={() => void chat.stop()}
      onSubmit={submit}
      open={open}
      respond={chat.addToolApprovalResponse}
      setInput={setInput}
      status={status}
    />
  );
}
