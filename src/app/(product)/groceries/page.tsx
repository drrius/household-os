import {
  quickAddGroceryAction,
  buyGroceryAgainAction,
} from "@/lib/groceries/list-actions";
import {
  claimGroceryItemAction,
  joinShoppingSessionAction,
  mergeDuplicateGroceryItemsAction,
} from "@/app/(product)/_actions/groceries";
import { loadGroceriesViewModel } from "@/lib/read-models/groceries";
import { GroceriesScreen } from "@/ui/groceries/groceries-screen";

export default async function GroceriesPage() {
  const model = await loadGroceriesViewModel();

  return (
    <GroceriesScreen
      claimAction={claimGroceryItemAction}
      addAction={quickAddGroceryAction}
      buyAgainAction={buyGroceryAgainAction}
      joinAction={joinShoppingSessionAction}
      mergeAction={mergeDuplicateGroceryItemsAction}
      model={model}
    />
  );
}
