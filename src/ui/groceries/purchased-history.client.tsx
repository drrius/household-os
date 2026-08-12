"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PurchasedHistoryProps = {
  recentHistoryLabel: string | null;
};

export function PurchasedHistory({
  recentHistoryLabel,
}: PurchasedHistoryProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="min-h-11 w-full cursor-pointer text-left font-heading text-xl font-semibold">
        Purchased history
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-muted-foreground">
          {recentHistoryLabel ??
            "No groceries were purchased in the last 30 days."}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
