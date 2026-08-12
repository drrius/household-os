import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageSection } from "@/ui/primitives/page-section";
import { StatusPill } from "@/ui/primitives/status-pill";

import styles from "./groceries.module.css";

type GroceryListProps = {
  categories: GroceriesViewModel["categories"];
  claimAction: (formData: FormData) => Promise<void>;
};

function GroceryItem({
  claimAction,
  item,
}: {
  claimAction: GroceryListProps["claimAction"];
  item: GroceriesViewModel["categories"][number]["items"][number];
}) {
  const isClaimed = item.claimedByName !== null;
  const classes = [styles.item, isClaimed ? styles.itemClaimed : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={classes}>
      <form action={claimAction} className={styles.toggleForm}>
        <input name="itemId" type="hidden" value={item.id} />
        <button
          aria-checked={isClaimed}
          aria-label={
            isClaimed
              ? `${item.name} is in ${item.claimedByName}'s cart`
              : `Add ${item.name} to your cart`
          }
          className={styles.toggle}
          disabled={isClaimed}
          role="checkbox"
          type="submit"
        >
          <span aria-hidden="true" className={styles.toggleMark}>
            {isClaimed ? "✓" : null}
          </span>
        </button>
      </form>
      <div className={styles.itemCopy}>
        <div className={styles.itemTitle}>
          <strong>{item.name}</strong>
          {item.duplicateHint !== null ? (
            <StatusPill tone="warning">{item.duplicateHint}</StatusPill>
          ) : null}
        </div>
        {item.note !== null ? (
          <p className={styles.itemNote}>{item.note}</p>
        ) : null}
        {item.claimedByName !== null ? (
          <p className={styles.claimLabel}>
            ✓ in {item.claimedByName}&apos;s cart
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function GroceryList({ categories, claimAction }: GroceryListProps) {
  return (
    <PageSection title="Shopping list" titleId="grocery-list-title">
      {categories.length === 0 ? (
        <EmptyState title="The list is empty">
          <p>Add a grocery item or plan a meal to get started.</p>
        </EmptyState>
      ) : (
        <div className={styles.categories}>
          {categories.map((category) => {
            const categoryTitleId = `grocery-category-${category.id}`;
            return (
              <section
                aria-labelledby={categoryTitleId}
                className={styles.category}
                key={category.id}
              >
                <div className={styles.categoryHeading}>
                  <h3 id={categoryTitleId}>{category.name}</h3>
                  <StatusPill>{category.items.length}</StatusPill>
                </div>
                <ul className={styles.itemList}>
                  {category.items.map((item) => (
                    <GroceryItem
                      claimAction={claimAction}
                      item={item}
                      key={item.id}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </PageSection>
  );
}
