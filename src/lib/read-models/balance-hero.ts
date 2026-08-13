import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";

export function balanceHero(cents: number, partnerName: string) {
  const amount = formatCentimesAsFrancs(Math.abs(cents));
  if (cents > 0) {
    return { kind: "partner_owes_you" as const, partnerName, amount };
  }
  if (cents < 0) {
    return { kind: "you_owe_partner" as const, partnerName, amount };
  }
  return { kind: "settled" as const, partnerName, amount };
}
