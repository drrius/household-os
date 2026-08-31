"use client";

import type { ChatStatus, UIMessage } from "ai";
import * as React from "react";

import { AssistantProvider } from "@/ui/assistant/assistant-context";
import { AssistantPanelView } from "@/ui/assistant/assistant-panel.client";

const MEMBERS = [
  { memberId: "darius", name: "Darius" },
  { memberId: "leah", name: "Leah" },
] as const;

/**
 * Drives the panel's presentation with canned messages so every conversation
 * state can be inspected without a model, a household, or a session.
 */
export function AssistantFixture({
  messages,
  status,
  errorMessage,
  draft = "",
}: {
  messages: readonly UIMessage[];
  status: ChatStatus;
  errorMessage?: string;
  draft?: string;
}) {
  const [input, setInput] = React.useState(draft);
  const noop = React.useCallback(() => undefined, []);

  return (
    <AssistantProvider members={MEMBERS}>
      <AssistantPanelView
        errorMessage={errorMessage}
        input={input}
        messages={messages}
        onNewChat={noop}
        onOpenChange={noop}
        onPickSuggestion={noop}
        onRetry={noop}
        onStop={noop}
        onSubmit={noop}
        open={true}
        respond={noop}
        setInput={setInput}
        status={status}
      />
    </AssistantProvider>
  );
}
