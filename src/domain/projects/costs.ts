export type CostEvent = {
  id: string;
  type:
    | "expense"
    | "replacement"
    | "refund"
    | "reversal"
    | "settlement"
    | "opening_balance";
  amount_cents: number;
  related_event_id: string | null;
};
export type CostLink = {
  financial_event_id: string;
  contextId: string;
  archived: boolean;
};

function eventValue(
  event: CostEvent,
  events: ReadonlyMap<string, CostEvent>,
  visited = new Set<string>(),
): bigint {
  if (!Number.isSafeInteger(event.amount_cents) || event.amount_cents < 0)
    throw new Error("Invalid financial amount");
  if (visited.has(event.id)) throw new Error("Invalid financial relationship");
  visited.add(event.id);
  switch (event.type) {
    case "expense":
    case "replacement":
      return BigInt(event.amount_cents);
    case "refund":
      return -BigInt(event.amount_cents);
    case "settlement":
    case "opening_balance":
      return 0n;
    case "reversal": {
      const original = events.get(event.related_event_id ?? "");
      if (!original) throw new Error("Missing original financial event");
      return -eventValue(original, events, visited);
    }
  }
}

function eventContext(
  event: CostEvent,
  events: ReadonlyMap<string, CostEvent>,
  links: ReadonlyMap<string, CostLink>,
): string | null {
  let current: CostEvent | undefined = event;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id))
      throw new Error("Invalid financial relationship");
    visited.add(current.id);
    const direct = links.get(current.id);
    if (direct && !direct.archived) return direct.contextId;
    if (!current.related_event_id) return null;
    current = events.get(current.related_event_id);
    if (!current) throw new Error("Missing original financial event");
  }
  return null;
}

export function projectPaidCosts(
  contextId: string,
  history: readonly CostEvent[],
  associations: readonly CostLink[],
) {
  const events = new Map(history.map((event) => [event.id, event]));
  const links = new Map(
    associations.map((link) => [link.financial_event_id, link]),
  );
  let paidCents = 0n;
  const eventIds: string[] = [];
  for (const event of events.values()) {
    if (eventContext(event, events, links) !== contextId) continue;
    paidCents += eventValue(event, events);
    eventIds.push(event.id);
  }
  return { paidCents, eventIds };
}

export function formatProjectCost(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "−" : ""}CHF ${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
