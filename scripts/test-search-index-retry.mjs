import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (process.env.GITHUB_ACTIONS !== "true") {
  throw new Error(
    "Search migration retry verification is restricted to disposable CI.",
  );
}
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260904234301_household_search.sql",
    import.meta.url,
  ),
  "utf8",
);
const indexSql = migration.split("create function public.search_household(")[0];
const names = [
  ...indexSql.matchAll(/create index concurrently (\w+) on /g),
].map((match) => match[1]);
assert.equal(names.length, 14);
function sql(input, expectedFailure = false) {
  const result = spawnSync(
    "psql",
    [
      "-X",
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    {
      input,
      encoding: "utf8",
      env: {
        ...process.env,
        PGPASSWORD: "postgres",
        PGOPTIONS: "-c statement_timeout=30000",
      },
    },
  );
  if (result.error) throw result.error;
  assert.equal(result.status === 0, !expectedFailure, result.stderr);
  return result.stdout.trim();
}
// Preserve a partial successful install, then leave one invalid concurrent index.
sql(`drop index public.routines_search_idx;
create table public.search_index_retry_probe (id integer);
insert into public.search_index_retry_probe values (1), (1);`);
sql(
  "create unique index concurrently routines_search_idx on public.search_index_retry_probe (id);",
  true,
);
assert.equal(
  sql(
    "select indisvalid from pg_index where indexrelid='public.routines_search_idx'::regclass;",
  ),
  "f",
);
// Execute the actual migration's index phase, including the cleanup on retry.
sql(indexSql);
sql(indexSql);
const listed = names.map((name) => `'public.${name}'::regclass`).join(",");
assert.equal(
  sql(
    `select count(*) from pg_index where indexrelid in (${listed}) and indisvalid and indisready;`,
  ),
  "14",
);
assert.equal(
  sql(
    "select indrelid::regclass::text from pg_index where indexrelid='public.routines_search_idx'::regclass;",
  ),
  "routines",
);
sql("drop table public.search_index_retry_probe;");
console.info(
  "Search index retry recovered an invalid index and retained all 14 valid indexes.",
);
