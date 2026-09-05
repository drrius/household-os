import Link from "next/link";
export type CheckoutCartItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
};
export function CheckoutCart({
  items,
}: {
  items: readonly CheckoutCartItem[];
}) {
  return (
    <details open className="rounded-xl border p-4">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        Your cart · {items?.length ?? 0} items
      </summary>
      <ul className="grid gap-2" role="list">
        {(items ?? []).map((item) => (
          <li className="flex justify-between gap-3" key={item.id}>
            <span>{item.name}</span>
            <span className="text-muted-foreground">
              {[item.quantity, item.unit].filter(Boolean).join(" ")}
            </span>
          </li>
        ))}
      </ul>
      <Link
        className="inline-flex min-h-11 items-center underline"
        href="/groceries"
      >
        Adjust your cart
      </Link>
    </details>
  );
}
