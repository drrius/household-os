import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BalanceHero, MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/layout/amount";
import { BalanceExplanation } from "@/ui/money/balance-explanation.client";

function balanceSummary(hero: BalanceHero): ReactNode {
  switch (hero.kind) {
    case "settled":
      return <h2 id="money-balance-title">Settled up</h2>;
    case "partner_owes_you":
      return (
        <>
          <h2 id="money-balance-title">{hero.partnerName} owes you</h2>
          <p className="text-3xl leading-tight font-extrabold">
            <Amount value={hero.amount} />
          </p>
        </>
      );
    case "you_owe_partner":
      return (
        <>
          <h2 id="money-balance-title">You owe {hero.partnerName}</h2>
          <p className="text-3xl leading-tight font-extrabold">
            <Amount value={hero.amount} />
          </p>
        </>
      );
    default: {
      const exhaustiveHero: never = hero;
      return exhaustiveHero;
    }
  }
}

export function MoneyHero({
  explanation,
  hasOpeningBalance,
  hero,
}: Pick<MoneyViewModel, "explanation" | "hasOpeningBalance" | "hero">) {
  const showsSettleUp = hero.kind !== "settled";

  return (
    <section aria-labelledby="money-balance-title">
      <Card>
        <CardContent className="grid gap-5">
          <div className="grid gap-1">
            <p className="font-heading text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Right now
            </p>
            <div className="[&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold">
              {balanceSummary(hero)}
            </div>
          </div>
          {!hasOpeningBalance ? (
            <div>
              <Link
                className={buttonVariants({
                  className: "no-underline",
                  variant: showsSettleUp ? "outline" : "default",
                })}
                href="/money/opening-balance"
              >
                Set opening balance
              </Link>
            </div>
          ) : null}
          {showsSettleUp ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className={buttonVariants({ className: "no-underline" })}
                href="/money/settlements/new?mode=full"
              >
                Settle up
              </Link>
              <Link
                className={buttonVariants({
                  className: "no-underline",
                  variant: "outline",
                })}
                href="/money/settlements/new?mode=partial"
              >
                Partial…
              </Link>
            </div>
          ) : null}
          <BalanceExplanation explanation={explanation} />
        </CardContent>
      </Card>
    </section>
  );
}
