import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { recordTables } from "./config";

import type { RecordQuery } from "./query";
export type { RecordQuery } from "./query";
export function listContext(kind: RecordKind, query: RecordQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q.slice(0, 160));
  if (query.page) params.set("page", query.page);
  if (query.archived === "1") params.set("archived", "1");
  if (query.attention === "1") params.set("attention", "1");
  return `/home/${kind}${params.size ? `?${params}` : ""}`;
}
export async function listRecords(
  kind: RecordKind,
  query: RecordQuery,
  parent?: { column: string; id: string },
) {
  const member = await requireMemberContext();
  const page = Number(query.page ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) notFound();
  if (
    query.attention === "1" &&
    query.archived !== "1" &&
    (kind === "inventory" || kind === "commitments")
  )
    return attentionRecords(kind, query.q, page);
  const db = await createClient();
  let request = db
    .from(recordTables[kind])
    .select("*", { count: "exact" })
    .eq("household_id", member.householdId);
  request =
    query.archived === "1"
      ? request.not("archived_at", "is", null)
      : request.is("archived_at", null);
  if (parent) request = request.eq(parent.column, parent.id);
  if (query.q)
    request = request.ilike(
      kind === "contacts" ? "name" : "title",
      `%${query.q.slice(0, 160).replace(/[\\%_]/g, "\\$&")}%`,
    );
  const { data, error, count } = await request
    .order("updated_at", { ascending: false })
    .order("id")
    .range(page * 20, page * 20 + 19);
  if (error) throw new Error("Couldn't load your records. Try again.");
  return { rows: (data ?? []) as HomeRecord[], count: count ?? 0, page };
}
export async function readRecord(
  kind: RecordKind,
  id: string,
): Promise<HomeRecord> {
  if (!z.uuid().safeParse(id).success) notFound();
  const member = await requireMemberContext();
  const { data, error } = await (
    await createClient()
  )
    .from(recordTables[kind])
    .select("*")
    .eq("household_id", member.householdId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Couldn't load this record.");
  if (!data) notFound();
  return data as HomeRecord;
}
export async function relatedRecords(
  table: string,
  column: string,
  id: string,
): Promise<HomeRecord[]> {
  const member = await requireMemberContext();
  const db = await createClient();
  const rows: HomeRecord[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("household_id", member.householdId)
      .eq(column, id)
      .order("id")
      .range(start, start + 499);
    if (error) throw new Error("Couldn't load linked records.");
    rows.push(...((data ?? []) as HomeRecord[]));
    if ((data?.length ?? 0) < 500) return rows;
  }
}

export async function paidReferences(
  kind: "inventory" | "commitments",
  id: string,
) {
  const member = await requireMemberContext();
  const { data, error } = await (
    await createClient()
  )
    .from("household_financial_links")
    .select("id, event:financial_events!inner(id, description, occurred_on)")
    .eq("household_id", member.householdId)
    .eq(kind === "inventory" ? "asset_id" : "commitment_id", id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load linked expenses.");
  return (data ?? []) as unknown as {
    id: string;
    event: { id: string; description: string; occurred_on: string };
  }[];
}

async function attentionRecords(
  kind: "inventory" | "commitments",
  q: string | undefined,
  page: number,
) {
  await requireMemberContext();
  const { data, error } = await (
    await createClient()
  ).rpc("list_home_attention_records", {
    p_kind: kind,
    p_query: q ?? "",
    p_page: page,
  });
  if (error)
    throw new Error("Couldn't load records needing attention. Try again.");
  const result = data as { rows: HomeRecord[]; count: number };
  return { ...result, page };
}
