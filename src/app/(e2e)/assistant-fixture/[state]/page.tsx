import type { ChatStatus, UIMessage } from "ai";
import { notFound } from "next/navigation";

import { AssistantFixture } from "./assistant-fixture.client";

const states = [
  "empty",
  "conversation",
  "approval",
  "correction",
  "thinking",
  "error",
  "failure",
  "unknown-member",
  "declined",
] as const;
type State = (typeof states)[number];

function isState(value: string): value is State {
  return (states as readonly string[]).includes(value);
}

/** Canned parts are shaped like the SDK's, but nothing here streams. */
function message(
  id: string,
  role: UIMessage["role"],
  parts: readonly unknown[],
): UIMessage {
  return { id, role, parts } as UIMessage;
}

function text(value: string) {
  return { type: "text", text: value };
}

function tool(
  name: string,
  state: string,
  extra: Record<string, unknown> = {},
) {
  return {
    type: `tool-${name}`,
    toolCallId: `${name}-call`,
    state,
    input: {},
    ...extra,
  };
}

const MEMBERS = [
  { memberId: "darius", name: "Darius" },
  { memberId: "leah", name: "Leah" },
];

const ASK = message("m1", "user", [
  text("what's left today, and did leah pay me back for the groceries?"),
]);

const CONVERSATION: readonly UIMessage[] = [
  ASK,
  message("m2", "assistant", [
    tool("get_today_overview", "output-available", { output: {} }),
    tool("get_money_overview", "output-available", { output: {} }),
    text(
      "Two things are still open today: **vacuum the living room** (yours) and **the plants are thirsty**, which has been waiting since Monday.\n\nLeah has not settled the groceries yet — she still owes you CHF 23.50.",
    ),
  ]),
  message("m3", "user", [text("mark the plants as done")]),
  message("m4", "assistant", [
    tool("complete_occurrence", "output-available", { output: {} }),
    text("Done — the plants are watered and today is down to one task."),
  ]),
];

const APPROVAL: readonly UIMessage[] = [
  message("a1", "user", [
    text("I paid 84.30 at coop today, split it with leah"),
  ]),
  message("a2", "assistant", [
    tool("get_household", "output-available", { output: {} }),
    tool("record_expense", "approval-requested", {
      approval: { id: "approval-1" },
      input: {
        description: "Coop groceries",
        amountCents: 8430,
        payerMemberId: "darius",
        occurredOn: "2026-08-12",
        split: { kind: "equal" },
      },
    }),
  ]),
];

const CORRECTION: readonly UIMessage[] = [
  message("c1", "user", [text("the august rent was 1750, not 1850")]),
  message("c2", "assistant", [
    tool("get_money_overview", "output-available", { output: {} }),
    tool("correct_financial_event", "approval-requested", {
      approval: { id: "approval-2" },
      input: {
        originalDescription: "Rent · August",
        originalAmountCents: 185_000,
        replacement: {
          description: "Rent · August",
          amountCents: 175_000,
          payerMemberId: "darius",
          occurredOn: "2026-08-01",
          split: {
            kind: "custom",
            allocations: [
              { memberId: "darius", allocatedCents: 87_500 },
              { memberId: "leah", allocatedCents: 87_500 },
            ],
          },
        },
      },
    }),
  ]),
];

const THINKING: readonly UIMessage[] = [
  message("t1", "user", [
    text("set up a weekly bathroom cleaning routine for saturdays"),
  ]),
  message("t2", "assistant", [
    tool("get_routines", "output-available", { output: {} }),
    tool("create_routine", "input-available"),
  ]),
];

const FAILURE: readonly UIMessage[] = [
  message("f1", "user", [text("add cherry tomatoes to the list")]),
  message("f2", "assistant", [
    tool("add_grocery_item", "output-error", {
      errorText: "Cherry tomatoes are already on the list",
    }),
    tool("remove_grocery_item", "output-denied"),
    text("Cherry tomatoes are already on the list, so I left it alone."),
  ]),
];

/** The model named a payer this household cannot resolve. */
const UNKNOWN_MEMBER: readonly UIMessage[] = [
  message("u1", "user", [text("split the 60 franc vet bill with sam")]),
  message("u2", "assistant", [
    tool("record_expense", "approval-requested", {
      approval: { id: "approval-3" },
      input: {
        description: "Vet visit",
        amountCents: 6000,
        payerMemberId: "sam-not-in-this-household",
        occurredOn: "2026-08-12",
        split: { kind: "equal" },
      },
    }),
  ]),
];

/** "Not now" settles the call in the client before any round trip. */
const DECLINED: readonly UIMessage[] = [
  message("d1", "user", [text("record the 42 franc pharmacy run")]),
  message("d2", "assistant", [
    tool("record_expense", "approval-responded", {
      approval: { id: "approval-4", approved: false },
      input: { description: "Pharmacy", amountCents: 4200 },
    }),
    text("Left it out. Tell me when you want it recorded."),
  ]),
];

type Scenario = {
  messages: readonly UIMessage[];
  status: ChatStatus;
  errorMessage?: string;
  draft?: string;
};

const scenarios: Record<State, Scenario> = {
  empty: { messages: [], status: "ready" },
  conversation: {
    messages: CONVERSATION,
    status: "ready",
    draft:
      "actually, move the vacuuming to tomorrow and remind me about the plants again on friday",
  },
  approval: { messages: APPROVAL, status: "ready" },
  correction: { messages: CORRECTION, status: "ready" },
  thinking: { messages: THINKING, status: "streaming" },
  failure: { messages: FAILURE, status: "ready" },
  "unknown-member": { messages: UNKNOWN_MEMBER, status: "ready" },
  declined: { messages: DECLINED, status: "ready" },
  error: {
    messages: [ASK],
    status: "error",
    errorMessage: "The assistant is unreachable right now. Try again shortly.",
  },
};

export default async function AssistantFixturePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") {
    notFound();
  }

  const { state } = await params;
  if (!isState(state)) {
    notFound();
  }

  const scenario = scenarios[state];
  return (
    <AssistantFixture
      draft={scenario.draft}
      members={MEMBERS}
      errorMessage={scenario.errorMessage}
      messages={scenario.messages}
      status={scenario.status}
    />
  );
}
