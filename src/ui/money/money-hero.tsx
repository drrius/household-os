import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BalanceHero, MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/layout/amount";

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
  hero,
}: Pick<MoneyViewModel, "explanation" | "hero">) {
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
          {hero.kind !== "settled" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled>Settle up</Button>
              <Button disabled variant="outline">
                Partial…
              </Button>
            </div>
          ) : null}
          <details className="border-t pt-4">
            <summary className="min-h-11 cursor-pointer font-heading font-bold">
              How is this derived?
            </summary>
            {explanation.length === 0 ? (
              <p className="text-muted-foreground">
                No posted events contribute to this balance.
              </p>
            ) : (
              <ul className="grid list-none gap-2">
                {explanation.map((contribution, index) => (
                  <li
                    className="flex justify-between gap-3"
                    key={`${contribution.label}-${index}`}
                  >
                    <span>{contribution.label}</span>
                    <Amount value={contribution.delta} />
                  </li>
                ))}
              </ul>
            )}
          </details>
        </CardContent>
      </Card>
    </section>
  );
}
