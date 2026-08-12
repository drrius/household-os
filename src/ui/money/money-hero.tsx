import type { ReactNode } from "react";

import type { BalanceHero, MoneyViewModel } from "@/lib/read-models/money";
import { Amount } from "@/ui/primitives/amount";
import { Button } from "@/ui/primitives/button";

function balanceSummary(hero: BalanceHero): ReactNode {
  switch (hero.kind) {
    case "settled":
      return <h2 id="money-balance-title">Settled up</h2>;
    case "partner_owes_you":
      return (
        <>
          <h2 id="money-balance-title">{hero.partnerName} owes you</h2>
          <p className="money-hero__amount">
            <Amount value={hero.amount} />
          </p>
        </>
      );
    case "you_owe_partner":
      return (
        <>
          <h2 id="money-balance-title">You owe {hero.partnerName}</h2>
          <p className="money-hero__amount">
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
    <section className="card money-hero" aria-labelledby="money-balance-title">
      <div className="money-hero__balance">
        <p className="money-hero__eyebrow">Right now</p>
        {balanceSummary(hero)}
      </div>
      {hero.kind !== "settled" ? (
        <div className="u-cluster">
          <Button disabled>Settle up</Button>
          <Button disabled variant="secondary">
            Partial…
          </Button>
        </div>
      ) : null}
      <details className="money-explanation">
        <summary>How is this derived?</summary>
        {explanation.length === 0 ? (
          <p>No posted events contribute to this balance.</p>
        ) : (
          <ul className="money-explanation__list">
            {explanation.map((contribution, index) => (
              <li key={`${contribution.label}-${index}`}>
                <span>{contribution.label}</span>
                <Amount value={contribution.delta} />
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
