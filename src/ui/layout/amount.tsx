import type { FrancDisplay } from "@/lib/ui/franc-display";

export type AmountProps = {
  value: FrancDisplay;
};

export function Amount({ value }: AmountProps) {
  return <span className="tabular-nums whitespace-nowrap">{value}</span>;
}
