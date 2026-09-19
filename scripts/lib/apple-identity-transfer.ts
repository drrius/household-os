function assertSqlLiteral(value: string, label: string): string {
  if (value.length === 0 || /['\\;]/.test(value) || value.includes("--")) {
    throw new Error(`Unsafe ${label} for SQL`);
  }

  return value;
}

export function appleIdentityTransferSql(input: {
  memberUserId: string;
  orphanUserId: string;
  appleProviderId: string;
}): string {
  const memberUserId = assertSqlLiteral(input.memberUserId, "member user id");
  const orphanUserId = assertSqlLiteral(input.orphanUserId, "orphan user id");
  const appleProviderId = assertSqlLiteral(
    input.appleProviderId,
    "Apple provider id",
  );

  return [
    "-- Transfer the Apple identity onto the existing household member.",
    "-- Run in the Frankfurt project's SQL editor. Do not create another household.",
    "-- Re-run `pnpm admin attach-apple` afterwards to delete the leftover auth user.",
    "begin;",
    `update auth.identities`,
    `set user_id = '${memberUserId}'`,
    `where provider = 'apple'`,
    `  and user_id = '${orphanUserId}'`,
    `  and id = '${appleProviderId}';`,
    "commit;",
  ].join("\n");
}
