export type MoneyHero =
  | { kind: "settled" }
  | {
      kind: "partner_owes_you" | "you_owe_partner";
      partnerName: string;
      amountLabel: string;
    };

export type MoneyDraftView = {
  id: string;
  title: string;
  amountLabel: string | null;
  source: "Shopping" | "Recurring";
  meta: string;
};

export type MoneyEventView = {
  id: string;
  title: string;
  meta: string;
  amountLabel: string;
  balanceDeltaLabel: string;
};

export type MoneyViewModel = {
  hasOpeningBalance: boolean;
  hero: MoneyHero;
  drafts: MoneyDraftView[];
  events: MoneyEventView[];
};
