import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Amount } from "@/ui/layout/amount";
import type { TodayViewModel } from "./today-view-model";

type BalancePill = NonNullable<TodayViewModel["balancePill"]>;

export function BalanceStatus({ balance }: { balance: BalancePill }) {
  switch (balance.kind) {
    case "partner_owes_you":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="accent">
            {balance.partnerName} owes you <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    case "you_owe_partner":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="warning">
            You owe {balance.partnerName} <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    case "settled":
      return (
        <Link className="no-underline" href="/money">
          <Badge variant="success">
            Settled <Amount value={balance.amount} />
          </Badge>
        </Link>
      );
    default: {
      const exhaustiveBalance: never = balance.kind;
      return exhaustiveBalance;
    }
  }
}
