import type { MoneyViewModel } from "./types";

export const mockMoney: MoneyViewModel = {
  hasOpeningBalance: true,
  hero: {
    kind: "partner_owes_you",
    partnerName: "Sam",
    amountLabel: "CHF 12.40",
  },
  drafts: [
    {
      id: "draft-1",
      title: "Migros run",
      amountLabel: "CHF 48.20",
      source: "Shopping",
      meta: "Due 15 Sep 2026 · does not count until confirmed",
    },
  ],
  events: [
    {
      id: "evt-1",
      title: "Coop weekly shop",
      meta: "Alex paid · 14 Sep 2026",
      amountLabel: "CHF 86.10",
      balanceDeltaLabel: "+CHF 43.05",
    },
  ],
};
