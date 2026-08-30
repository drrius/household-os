"use client";

import { ArrowDownIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConversationContextValue = {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const ConversationContext =
  React.createContext<ConversationContextValue | null>(null);

function useConversation(): ConversationContextValue {
  const context = React.useContext(ConversationContext);
  if (context === null) {
    throw new Error("Conversation components must sit inside <Conversation>");
  }
  return context;
}

const BOTTOM_EPSILON_PX = 32;

/**
 * Scrollable message region that sticks to the bottom while new content
 * streams in, and stops following as soon as the reader scrolls up.
 */
export function Conversation({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const isAtBottomRef = React.useRef(true);

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const element = containerRef.current;
      if (element !== null) {
        element.scrollTo({ top: element.scrollHeight, behavior });
      }
    },
    [],
  );

  const handleScroll = React.useCallback(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const atBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      BOTTOM_EPSILON_PX;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  React.useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (isAtBottomRef.current) {
        element.scrollTo({ top: element.scrollHeight });
      }
    });
    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, []);

  const context = React.useMemo(
    () => ({ isAtBottom, scrollToBottom, containerRef }),
    [isAtBottom, scrollToBottom],
  );

  return (
    <ConversationContext.Provider value={context}>
      <div className={cn("relative min-h-0 flex-1", className)}>
        <div
          aria-live="polite"
          aria-relevant="additions text"
          className="h-full overflow-y-auto overscroll-contain scroll-pb-4"
          onScroll={handleScroll}
          ref={containerRef}
          role="log"
          {...props}
        >
          {children}
        </div>
      </div>
    </ConversationContext.Provider>
  );
}

export function ConversationContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4 px-4 py-4 sm:px-5", className)}
      {...props}
    />
  );
}

export function ConversationScrollButton({
  className,
}: {
  className?: string;
}) {
  const { isAtBottom, scrollToBottom } = useConversation();
  if (isAtBottom) {
    return null;
  }
  return (
    <Button
      aria-label="Scroll to latest message"
      className={cn(
        "absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md",
        className,
      )}
      onClick={() => scrollToBottom()}
      size="icon-sm"
      type="button"
      variant="secondary"
    >
      <ArrowDownIcon />
    </Button>
  );
}
