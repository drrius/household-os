import { notFound } from "next/navigation";
import { loadShoppingHistory } from "@/lib/groceries/shopping-history";
import { ShoppingHistoryScreen } from "@/ui/groceries/shopping-history";

export default async function ShoppingHistoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const history = await loadShoppingHistory((await params).sessionId);
  if (!history) notFound();
  return <ShoppingHistoryScreen history={history} />;
}
