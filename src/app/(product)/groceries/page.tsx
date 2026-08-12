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
      joinAction={joinShoppingSessionAction}
      mergeAction={mergeDuplicateGroceryItemsAction}
      model={model}
    />
  );
}
