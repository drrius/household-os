"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { PageSection } from "@/ui/layout/page-section";

type DuplicateSuggestionListProps = {
  duplicates: GroceriesViewModel["duplicates"];
  mergeAction: (formData: FormData) => Promise<void>;
};

function duplicateKey(
  duplicate: GroceriesViewModel["duplicates"][number],
): string {
  return `${duplicate.leftId}:${duplicate.rightId}`;
}

export function DuplicateSuggestionList({
  duplicates,
  mergeAction,
}: DuplicateSuggestionListProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const visibleDuplicates = duplicates.filter(
    (duplicate) => !dismissed.has(duplicateKey(duplicate)),
  );

  if (visibleDuplicates.length === 0) {
    return null;
  }

  return (
    <PageSection title="Possible duplicates" titleId="grocery-duplicates-title">
      <ul className="grid list-none gap-4">
        {visibleDuplicates.map((duplicate) => {
          const key = duplicateKey(duplicate);
          return (
            <li key={key}>
              <Card className="bg-warning-soft" size="sm">
                <CardHeader>
                  <CardTitle>Duplicate suggestion</CardTitle>
                  <CardAction>
                    <Badge variant="warning">Review</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-1">
                    <h3 className="font-semibold">
                      {duplicate.leftName} and {duplicate.rightName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Merging keeps the first item&apos;s quantity, category,
                      and note.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={mergeAction}>
                      <input
                        name="leftId"
                        type="hidden"
                        value={duplicate.leftId}
                      />
                      <input
                        name="rightId"
                        type="hidden"
                        value={duplicate.rightId}
                      />
                      <Button type="submit">Merge</Button>
                    </form>
                    <Button
                      onClick={() => {
                        setDismissed((current) => {
                          const next = new Set(current);
                          next.add(key);
                          return next;
                        });
                      }}
                      type="button"
                      variant="outline"
                    >
                      Keep both
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
