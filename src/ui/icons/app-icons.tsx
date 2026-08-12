import type { ProductDestinationId } from "@/lib/ui/destinations";

const iconProps = {
  "aria-hidden": true,
  fill: "none",
  height: 24,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
  width: 24,
} as const;

export function TodayIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12 2.2 2.2 4.8-4.9" />
    </svg>
  );
}

export function PlanIcon() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M13 13h3M8 16.5h3" />
    </svg>
  );
}

export function GroceriesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.5 5h2l1.7 9.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.5L20 8H6.1" />
      <circle cx="9.5" cy="19" r="1" />
      <circle cx="17" cy="19" r="1" />
    </svg>
  );
}

export function MoneyIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M7 9.5h3.5M7 14.5h3.5M16.5 9v6M14.5 10.5h3.2M14.5 13.5h3.2" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="m3.5 11 8.5-7 8.5 7" />
      <path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function HouseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 10.5 12 4l8 6.5v9H4z" />
      <path d="M9.5 19.5v-6h5v6" />
    </svg>
  );
}

export const PRODUCT_DESTINATION_ICONS = {
  today: TodayIcon,
  plan: PlanIcon,
  groceries: GroceriesIcon,
  money: MoneyIcon,
  home: HomeIcon,
} satisfies Record<ProductDestinationId, typeof TodayIcon>;
