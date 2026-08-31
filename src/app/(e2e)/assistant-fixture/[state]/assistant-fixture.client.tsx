"use client";

import type { ChatStatus, UIMessage } from "ai";
import * as React from "react";

import {
  AssistantProvider,
  type AssistantMember,
} from "@/ui/assistant/assistant-context";
import { AssistantPanelView } from "@/ui/assistant/assistant-panel.client";

/**
 * Drives the panel's presentation with canned messages so every conversation
 * state can be inspected without a model, a household, or a session.
 *
 * Every scenario arrives as a prop: this module is emitted as a client chunk
 * in production builds even though the route 404s there, so it must hold no
 * fixture data of its own.
 */
export function AssistantFixture({
  members,
  messages,
  status,
  errorMessage,
  draft = "",
}: {
  members: readonly AssistantMember[];
  messages: readonly UIMessage[];
  status: ChatStatus;
  errorMessage?: string;
  draft?: string;
}) {
  const [input, setInput] = React.useState(draft);
  const noop = React.useCallback(() => undefined, []);

  return (
    <AssistantProvider members={members}>
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
