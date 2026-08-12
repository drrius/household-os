"use client";

import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/layout/amount";

type BalanceExplanationProps = {
  explanation: MoneyViewModel["explanation"];
};

export function BalanceExplanation({ explanation }: BalanceExplanationProps) {
  return (
    <Collapsible className="border-t pt-4">
      <CollapsibleTrigger className="group/disclosure flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl text-left font-heading font-bold">
        How is this derived?
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/disclosure:text-foreground group-data-[panel-open]/disclosure:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {explanation.length === 0 ? (
          <p className="text-muted-foreground">
            No posted events contribute to this balance.
          </p>
        ) : (
          <ul className="grid list-none gap-2">
            {explanation.map((contribution, index) => (
              <li
                className="flex justify-between gap-3"
                key={`${contribution.label}-${index}`}
              >
                <span>{contribution.label}</span>
                <Amount value={contribution.delta} />
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
