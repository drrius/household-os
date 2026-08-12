import {
  CalendarDays,
  CircleCheck,
  House,
  Plus,
  ShoppingCart,
  WalletMinimal,
} from "lucide-react";

import type { ProductDestinationId } from "@/lib/ui/destinations";

const iconProps = {
  "aria-hidden": true,
  className: "shrink-0",
  size: 24,
  strokeWidth: 1.8,
} as const;

export function TodayIcon() {
  return <CircleCheck {...iconProps} />;
}

export function PlanIcon() {
  return <CalendarDays {...iconProps} />;
}

export function GroceriesIcon() {
  return <ShoppingCart {...iconProps} />;
}

export function MoneyIcon() {
  return <WalletMinimal {...iconProps} />;
}

export function HomeIcon() {
  return <House {...iconProps} />;
}

export function PlusIcon() {
  return <Plus {...iconProps} />;
}

export function HouseIcon() {
  return <House {...iconProps} />;
}

export const PRODUCT_DESTINATION_ICONS = {
  today: TodayIcon,
  plan: PlanIcon,
  groceries: GroceriesIcon,
  money: MoneyIcon,
  home: HomeIcon,
} satisfies Record<ProductDestinationId, typeof TodayIcon>;
