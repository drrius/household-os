import { describe, expect, it } from "vitest";

import { appleIdentityTransferSql } from "./apple-identity-transfer.ts";

describe("appleIdentityTransferSql", () => {
  it("moves only the named Apple identity and never mentions bootstrap", () => {
    const sql = appleIdentityTransferSql({
      memberUserId: "11111111-1111-4111-8111-111111111111",
      orphanUserId: "22222222-2222-4222-8222-222222222222",
      appleProviderId: "apple-sub.001",
    });

    expect(sql).toContain("update auth.identities");
    expect(sql).toContain("11111111-1111-4111-8111-111111111111");
    expect(sql).toContain("22222222-2222-4222-8222-222222222222");
    expect(sql).toContain("apple-sub.001");
    expect(sql).toContain(
      "and user_id = '22222222-2222-4222-8222-222222222222'",
    );
    expect(sql).not.toMatch(/createHousehold|admin bootstrap/i);
    expect(sql).not.toContain("insert into public.households");
    expect(sql).not.toContain("insert into public.household_members");
  });

  it("rejects values that would break out of the SQL literals", () => {
    expect(() =>
      appleIdentityTransferSql({
        memberUserId: "11111111-1111-4111-8111-111111111111",
        orphanUserId: "22222222-2222-4222-8222-222222222222",
        appleProviderId: "bad'; drop table auth.users; --",
      }),
    ).toThrow(/Unsafe/);
  });
});
