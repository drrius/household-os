import "server-only";
import type { GroceriesViewModel } from "@/lib/groceries/view-model";
export type { GroceriesViewModel } from "@/lib/groceries/view-model";

import { buildDuplicateData } from "@/lib/groceries/duplicate-view";
import { normalizeGroceryName } from "@/domain/groceries/duplicates";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type CategoryRow = { id: string; name: string; sort_order: number };
type ItemRow = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category_id: string | null;
  note: string | null;
  sort_order: number;
} & (
  | { state: "active"; claimed_by_session_id: null }
  | { state: "claimed"; claimed_by_session_id: string }
);
type SessionRow = { id: string; member_id: string; started_at: string };
type MemberRow = { user_id: string; display_name: string };
type HistoryRow = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  purchased_at: string;
  originating_meal_plan_entry_id: string | null;
  meal?: { removed_at: string | null } | null;
};

type GroceriesReadRows = {
  categories: CategoryRow[];
  items: ItemRow[];
  sessions: SessionRow[];
  members: MemberRow[];
  history: HistoryRow[];
};

export type GroceriesReadInput = GroceriesReadRows & { viewerId: string };

type CategoryBucket = {
  id: string;
  name: string;
  sortOrder: number;
  items: ItemRow[];
};

const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

function buildCategoryBuckets(
  categories: readonly CategoryRow[],
  items: readonly ItemRow[],
): CategoryBucket[] {
  const orderedCategories = [...categories].sort(
    (left, right) =>
      left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  );
  const buckets = new Map<string, CategoryBucket>(
    orderedCategories.map((category) => [
      category.id,
      {
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        items: [],
      },
    ]),
  );
  const other = orderedCategories.find(
    (category) => normalizeGroceryName(category.name) === "other",
  );
  const fallback: CategoryBucket = {
    id: other?.id ?? "uncategorized",
    name: other?.name ?? "Other",
    sortOrder: other?.sort_order ?? Number.MAX_SAFE_INTEGER,
    items: [],
  };

  for (const item of items) {
    const category =
      item.category_id === null ? undefined : buckets.get(item.category_id);
    const bucket = category ?? buckets.get(fallback.id) ?? fallback;
    if (!buckets.has(bucket.id)) {
      buckets.set(bucket.id, bucket);
    }
    bucket.items.push(item);
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.items.length > 0)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    )
    .map((bucket) => ({
      ...bucket,
      items: [...bucket.items].sort(
        (left, right) =>
          left.sort_order - right.sort_order || left.id.localeCompare(right.id),
      ),
    }));
}

function buildLiveSession(
  input: GroceriesReadInput,
  memberNames: ReadonlyMap<string, string>,
): GroceriesViewModel["liveSession"] {
  const sessions = [...input.sessions].sort(
    (left, right) =>
      right.started_at.localeCompare(left.started_at) ||
      left.id.localeCompare(right.id),
  );
  const session =
    sessions.find((candidate) => candidate.member_id === input.viewerId) ??
    sessions[0];
  if (session === undefined) return null;
  return {
    id: session.id,
    memberName: memberNames.get(session.member_id) ?? "Household member",
    claimedCount: input.items.filter(
      (item) =>
        item.state === "claimed" && item.claimed_by_session_id === session.id,
    ).length,
    totalCount: input.items.length,
    isMine: session.member_id === input.viewerId,
  };
}

export function mapGroceriesViewModel(
  input: GroceriesReadInput,
): GroceriesViewModel {
  const buckets = buildCategoryBuckets(input.categories, input.items);
  const orderedItems = buckets.flatMap((bucket) => bucket.items);
  const duplicateData = buildDuplicateData(orderedItems);
  const sessions = new Map(input.sessions.map((row) => [row.id, row]));
  const memberNames = new Map(
    input.members.map((row) => [row.user_id, row.display_name]),
  );
  return {
    activeItemCount: input.items.length,
    categories: buckets.map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      items: bucket.items.map((item) => {
        const session =
          item.state === "claimed"
            ? sessions.get(item.claimed_by_session_id)
            : undefined;
        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          claimedByName:
            item.state === "active"
              ? null
              : (memberNames.get(session?.member_id ?? "") ??
                "Another shopper"),
          claimedByMe:
            item.state === "claimed" && session?.member_id === input.viewerId,
          duplicateHint: duplicateData.hints.get(item.id) ?? null,
        };
      }),
    })),
    liveSession: buildLiveSession(input, memberNames),
    duplicates: duplicateData.suggestions,
    history: input.history.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      purchasedAt: item.purchased_at,
      mealId:
        item.meal?.removed_at === null
          ? item.originating_meal_plan_entry_id
          : null,
    })),
    recentHistoryLabel:
      input.history.length === 0
        ? null
        : `${input.history.length} ${input.history.length === 1 ? "item" : "items"} purchased in the last 30 days`,
  };
}

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function queryData<T>(label: string, result: QueryResult<T>): T {
  if (result.error !== null) {
    throw new Error(`Groceries ${label} query failed: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`Groceries ${label} query returned no data`);
  }
  return result.data;
}

export async function loadGroceriesViewModel(): Promise<GroceriesViewModel> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const historyStart = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();
  const [categories, items, sessions, members, history, recentShops] =
    await Promise.all([
      supabase
        .from("grocery_categories")
        .select("id, name, sort_order")
        .eq("household_id", member.householdId)
        .is("archived_at", null)
        .order("sort_order")
        .order("id")
        .overrideTypes<CategoryRow[], { merge: false }>(),
      supabase
        .from("grocery_items")
        .select(
          "id, name, quantity, unit, category_id, note, sort_order, state, claimed_by_session_id",
        )
        .eq("household_id", member.householdId)
        .in("state", ["active", "claimed"])
        .order("sort_order")
        .order("id")
        .overrideTypes<ItemRow[], { merge: false }>(),
      supabase
        .from("shopping_sessions")
        .select("id, member_id, started_at")
        .eq("household_id", member.householdId)
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .overrideTypes<SessionRow[], { merge: false }>(),
      supabase
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", member.householdId)
        .overrideTypes<MemberRow[], { merge: false }>(),
      supabase
        .from("grocery_items")
        .select(
          "id, name, quantity, unit, purchased_at, originating_meal_plan_entry_id, meal:meal_plan_entries(removed_at)",
        )
        .eq("household_id", member.householdId)
        .eq("state", "purchased")
        .gte("purchased_at", historyStart)
        .order("purchased_at", { ascending: false })
        .order("id")
        .overrideTypes<HistoryRow[], { merge: false }>(),
      supabase
        .from("shopping_sessions")
        .select(
          "id, member_id, finished_at, receipt_total_cents, draft_expense_id, shopping_session_items!inner(purchased_at)",
        )
        .eq("household_id", member.householdId)
        .gte("finished_at", historyStart)
        .not("shopping_session_items.purchased_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(30),
    ]);
  const rows: GroceriesReadRows = {
    categories: queryData("categories", categories),
    items: queryData("active items", items),
    sessions: queryData("shopping sessions", sessions),
    members: queryData("household members", members),
    history: queryData("purchased history", history),
  };
  return {
    ...mapGroceriesViewModel({ viewerId: member.userId, ...rows }),
    recentShops: queryData("recent shops", recentShops).map((shop) => ({
      id: shop.id,
      finishedAt: shop.finished_at!,
      memberName:
        rows.members.find((person) => person.user_id === shop.member_id)
          ?.display_name ?? "Household member",
      receiptTotalCents: shop.receipt_total_cents,
      draftId: shop.draft_expense_id,
    })),
  };
}
