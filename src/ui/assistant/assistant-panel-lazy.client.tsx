"use client";

import * as React from "react";

import { useAssistant } from "@/ui/assistant/assistant-context";

const AssistantPanel = React.lazy(() =>
  import("@/ui/assistant/assistant-panel.client").then((module) => ({
    default: module.AssistantPanel,
  })),
);

/**
 * The panel's client graph (AI SDK chat, Streamdown and its plugins, the
 * AI Elements components) is heavy, so nothing loads until the member first
 * opens the assistant. After that it stays mounted to keep the chat state.
 */
export function AssistantPanelLazy() {
  const { everOpened } = useAssistant();
  if (!everOpened) {
    return null;
  }
  return (
    <React.Suspense fallback={null}>
      <AssistantPanel />
    </React.Suspense>
  );
}
