"use client";

import * as React from "react";

type AssistantContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const AssistantContext = React.createContext<AssistantContextValue | null>(
  null,
);

export function useAssistant(): AssistantContextValue {
  const context = React.useContext(AssistantContext);
  if (context === null) {
    throw new Error("Assistant components must sit inside <AssistantProvider>");
  }
  return context;
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}
