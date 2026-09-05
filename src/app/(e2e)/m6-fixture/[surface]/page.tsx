import { notFound } from "next/navigation";

import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import type { HomeViewModel } from "@/lib/read-models/home";
import type { MoneyViewModel } from "@/lib/read-models/money";
import type { PlanViewModel } from "@/lib/read-models/plan";
import {
  formatCentimesAsFrancs,
  formatSignedCentimesAsFrancs,
} from "@/lib/ui/franc-display";
import { GroceriesScreen } from "@/ui/groceries/groceries-screen";
import { HomeScreen } from "@/ui/home/home-screen";
import { MoneyScreen } from "@/ui/money/money-screen";
import { PlanScreen } from "@/ui/plan/plan-screen";
import { AppShell } from "@/ui/shell/app-shell";
import { TodayScreen } from "@/ui/today/today-screen";

import { todayFixture } from "./today-fixture";

const surfaces = ["today", "plan", "groceries", "money", "home"] as const;
type Surface = (typeof surfaces)[number];

const planFixture: PlanViewModel = {
  weekStart: "2026-08-10",
  weekEnd: "2026-08-16",
  rangeLabel: "10 – 16 Aug",
  timeZoneLabel: "Europe/Zurich",
  today: "2026-08-12",
  days: (
    [
      ["2026-08-10", "Mon 10", "Tomato pasta"],
      ["2026-08-11", "Tue 11", "Pasta leftovers"],
      ["2026-08-12", "Wed 12", "Green veggie curry"],
      ["2026-08-13", "Thu 13", "Out with friends"],
      ["2026-08-14", "Fri 14", "Pizza night"],
      ["2026-08-15", "Sat 15", "Rösti with fried eggs"],
      ["2026-08-16", "Sun 16", "Pancakes"],
    ] as ReadonlyArray<readonly [string, string, string]>
  ).map(([date, weekdayLabel, title], index) => ({
    date,
    weekdayLabel,
    isToday: date === "2026-08-12",
    slots: (["breakfast", "lunch", "dinner"] as const).map((slot) => ({
      slot,
      entry:
        slot === (index === 6 ? "breakfast" : "dinner")
          ? {
              id: `meal-${date}`,
              title,
              isLeftover: index === 1,
              notes: null,
              cookLabel: index % 2 === 0 ? "Darius cooks" : "Leah cooks",
            }
          : null,
    })),
  })),
  library: [
    { id: "library-1", title: "Tomato pasta" },
    { id: "library-2", title: "Rösti" },
    { id: "library-3", title: "Lentil soup" },
  ],
};

const groceriesFixture: GroceriesViewModel = {
  activeItemCount: 6,
  liveSession: {
    id: "session-fixture",
    memberName: "Leah",
    claimedCount: 3,
    totalCount: 6,
    isMine: false,
  },
  duplicates: [
    {
      leftId: "tomatoes-fixture",
      rightId: "cherry-tomatoes-fixture",
      leftName: "Tomatoes",
      rightName: "Cherry tomatoes",
    },
  ],
  categories: [
    {
      id: "produce",
      name: "Produce",
      items: [
        {
          id: "tomatoes-fixture",
          name: "Tomatoes",
          quantity: "500",
          unit: "g",
          note: null,
          claimedByName: "Leah",
          claimedByMe: false,
          duplicateHint: null,
        },
        {
          id: "cherry-tomatoes-fixture",
          name: "Cherry tomatoes",
          quantity: "1",
          unit: "pack",
          note: null,
          claimedByName: null,
          claimedByMe: false,
          duplicateHint: "Possible duplicate. Quantity or unit differs.",
        },
        {
          id: "basil-fixture",
          name: "Basil",
          quantity: null,
          unit: null,
          note: "for Saturday curry",
          claimedByName: null,
          claimedByMe: false,
          duplicateHint: null,
        },
      ],
    },
    {
      id: "pantry",
      name: "Pantry",
      items: [
        {
          id: "rice-fixture",
          name: "Jasmine rice",
          quantity: "1",
          unit: "kg",
          note: null,
          claimedByName: "Leah",
          claimedByMe: false,
          duplicateHint: null,
        },
      ],
    },
  ],
  recentHistoryLabel: "Last shop Tuesday · 9 items",
};

const moneyFixture: MoneyViewModel = {
  hasOpeningBalance: true,
  hero: {
    kind: "partner_owes_you",
    partnerName: "Leah",
    amount: formatCentimesAsFrancs(2350),
  },
  explanation: [
    { label: "Opening balance", delta: formatSignedCentimesAsFrancs(1500) },
    { label: "Rent · August", delta: formatSignedCentimesAsFrancs(92500) },
    {
      label: "Leah paid you · Twint",
      delta: formatSignedCentimesAsFrancs(-5000),
    },
  ],
  drafts: [
    {
      id: "money-draft-fixture",
      title: "Coop groceries",
      amount: formatCentimesAsFrancs(8430),
      meta: "Due 12 Aug 2026 · does not count until confirmed",
      source: "Shopping",
      canConfirm: false,
      blocker: "Say who paid before confirming",
    },
  ],
  events: [
    {
      id: "settlement-fixture",
      title: "Leah paid you · Twint",
      meta: "Leah paid · 12 Aug 2026",
      amount: formatCentimesAsFrancs(5000),
      balanceDelta: formatSignedCentimesAsFrancs(-5000),
      balanceEffect: "Balance with Leah moved against you by CHF 50.00",
      type: "settlement",
    },
    {
      id: "rent-fixture",
      title: "Rent · August",
      meta: "Darius paid · 1 Aug 2026",
      amount: formatCentimesAsFrancs(185000),
      balanceDelta: formatSignedCentimesAsFrancs(92500),
      balanceEffect: "Balance with Leah moved in your favor by CHF 925.00",
      type: "expense",
    },
  ],
};

const homeFixture: HomeViewModel = {
  householdLabel: "Darius & Leah",
  members: [
    { userId: "darius-fixture", displayName: "Darius", isSelf: true },
    { userId: "leah-fixture", displayName: "Leah", isSelf: false },
  ],
  pets: [{ id: "jodie-fixture", name: "Jodie", meta: "2 care routines" }],
  areas: [
    { id: "cleaning", name: "Cleaning", routineCount: 4 },
    { id: "kitchen", name: "Kitchen", routineCount: 3 },
    { id: "laundry", name: "Laundry", routineCount: 2 },
    { id: "dog", name: "Dog", routineCount: 2 },
  ],
  routines: [
    { id: "walk-fixture", title: "Walk Jodie", areaName: "Dog" },
    { id: "laundry-fixture", title: "Run laundry", areaName: "Laundry" },
  ],
  activity: [
    { id: "activity-1", title: "Leah fed Jodie", whenLabel: "08:10" },
    {
      id: "activity-2",
      title: "Darius moved pancakes to Sunday",
      whenLabel: "Yesterday",
    },
    {
      id: "activity-3",
      title: "Leah recorded a settlement",
      whenLabel: "Wednesday",
    },
  ],
  storageUsedLabel: "117 MB",
};

async function noFormAction(formData: FormData): Promise<void> {
  "use server";
  void formData;
}

async function noAction(): Promise<void> {
  "use server";
}

function renderSurface(surface: Surface, agendaUnavailable = false) {
  switch (surface) {
    case "today":
      return (
        <TodayScreen
          view={todayFixture}
          agenda={agendaUnavailable ? null : undefined}
        />
      );
    case "plan":
      return <PlanScreen plan={planFixture} />;
    case "groceries":
      return (
        <GroceriesScreen
          claimAction={noFormAction}
          finishAction={noAction}
          joinAction={noAction}
          mergeAction={noFormAction}
          model={groceriesFixture}
        />
      );
    case "money":
      return (
        <MoneyScreen confirmDraftAction={noFormAction} model={moneyFixture} />
      );
    case "home":
      return <HomeScreen model={homeFixture} />;
    default: {
      const exhaustiveSurface: never = surface;
      return exhaustiveSurface;
    }
  }
}

export default async function M6FixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams: Promise<{ agendaError?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") {
    notFound();
  }

  const { surface } = await params;
  if (!surfaces.includes(surface as Surface)) {
    notFound();
  }

  return (
    <AppShell>
      {renderSurface(
        surface as Surface,
        (await searchParams).agendaError === "1",
      )}
    </AppShell>
  );
}
