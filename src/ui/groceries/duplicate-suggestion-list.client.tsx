"use client";

import { useState } from "react";

import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { Button } from "@/ui/primitives/button";
import { Card } from "@/ui/primitives/card";
import { PageSection } from "@/ui/primitives/page-section";
import { StatusPill } from "@/ui/primitives/status-pill";

import styles from "./groceries.module.css";

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
      <ul className={styles.duplicateList}>
        {visibleDuplicates.map((duplicate) => {
          const key = duplicateKey(duplicate);
          return (
            <li key={key}>
              <Card
                className={styles.duplicateCard}
                header={
                  <>
                    <span>Duplicate suggestion</span>
                    <StatusPill tone="warning">Review</StatusPill>
                  </>
                }
                tone="warning"
              >
                <div className={styles.duplicateNames}>
                  <h3>
                    {duplicate.leftName} and {duplicate.rightName}
                  </h3>
                  <p>
                    Merging keeps the first item&apos;s quantity, category, and
                    note.
                  </p>
                </div>
                <div className={styles.duplicateActions}>
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
                  <button
                    className="button button--secondary"
                    onClick={() => {
                      setDismissed((current) => {
                        const next = new Set(current);
                        next.add(key);
                        return next;
                      });
                    }}
                    type="button"
                  >
                    Keep both
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
