"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAssistant } from "@/ui/assistant/assistant-context";

type AssistantTriggerProps = {
  placement: "mobile" | "sidebar";
};

export function AssistantTrigger({ placement }: AssistantTriggerProps) {
  const { setOpen } = useAssistant();

  return (
    <Button
      aria-label="Open the assistant"
      className={cn(
        placement === "mobile" &&
          // Sits one slot above the add button's floating position.
          "fixed right-5 bottom-[calc(9.5rem+max(0.75rem,env(safe-area-inset-bottom)))] z-20 size-12 rounded-full border border-border bg-card text-primary shadow-[0_6px_20px_rgba(31,26,23,0.16)] hover:bg-secondary md:size-12 lg:hidden",
        placement === "sidebar" &&
          "w-full justify-center rounded-xl shadow-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:px-0!",
      )}
      onClick={() => setOpen(true)}
      size={placement === "sidebar" ? "default" : "icon-lg"}
      type="button"
      variant={placement === "sidebar" ? "outline" : "ghost"}
    >
      <SparklesIcon data-icon="inline-start" />
      <span
        className={cn(
          placement === "mobile" && "sr-only",
          placement === "sidebar" && "group-data-[collapsible=icon]:hidden",
        )}
      >
        Assistant
      </span>
    </Button>
  );
}
