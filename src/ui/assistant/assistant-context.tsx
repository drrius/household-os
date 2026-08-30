"use client";

import * as React from "react";

export type AssistantMember = { memberId: string; name: string };

type AssistantContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** True once the panel has been opened; it stays mounted from then on. */
  everOpened: boolean;
  /** Household members, so approval cards can name payers and splits. */
  members: readonly AssistantMember[];
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

export function AssistantProvider({
  children,
  members = [],
}: {
  children: React.ReactNode;
  members?: readonly AssistantMember[];
}) {
  const [open, setOpenState] = React.useState(false);
  const [everOpened, setEverOpened] = React.useState(false);
  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next);
    if (next) {
      setEverOpened(true);
    }
  }, []);
  const value = React.useMemo(
    () => ({ open, setOpen, everOpened, members }),
    [open, setOpen, everOpened, members],
  );
  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}
