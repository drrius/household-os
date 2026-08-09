import { describe, expect, it } from "vitest";

import {
  executeIdentityAdminCommand,
  parseIdentityAdminArguments,
  runIdentityAdmin,
  type HouseholdRecord,
  type IdentityAdminGateway,
  type MembershipRecord,
  type UserRecord,
} from "./identity-admin.ts";

class FakeIdentityAdminGateway implements IdentityAdminGateway {
  readonly households: HouseholdRecord[] = [];
  readonly users: UserRecord[] = [];
  readonly memberships: MembershipRecord[] = [];
  readonly generatedLinks: string[] = [];
  readonly createdUsers: string[] = [];
  readonly confirmedUsers: string[] = [];

  async listHouseholds() {
    return structuredClone(this.households);
  }

  async createHousehold(name: string) {
    const household = { id: `household-${this.households.length + 1}`, name };
    this.households.push(household);
    return structuredClone(household);
  }

  async listUsers() {
    return structuredClone(this.users);
  }

  async createConfirmedUser(email: string) {
    const user = {
      id: `user-${this.users.length + 1}`,
      email,
      confirmed: true,
    };
    this.users.push(user);
    this.createdUsers.push(email);
    return structuredClone(user);
  }

  async confirmUser(userId: string) {
    const index = this.users.findIndex(({ id }) => id === userId);
    const user = this.users[index];

    if (user === undefined) {
      throw new Error(`Unknown fake user: ${userId}`);
    }

    const confirmedUser = { ...user, confirmed: true };
    this.users[index] = confirmedUser;
    this.confirmedUsers.push(userId);
    return structuredClone(confirmedUser);
  }

  async listMemberships() {
    return structuredClone(this.memberships);
  }

  async createMembership(membership: MembershipRecord) {
    this.memberships.push(structuredClone(membership));
  }

  async updateMembership(membership: MembershipRecord) {
    const existingMembershipIndex = this.memberships.findIndex(
      ({ householdId, userId }) =>
        householdId === membership.householdId && userId === membership.userId,
    );

    if (existingMembershipIndex === -1) {
      throw new Error("Cannot update a missing membership");
    }

    this.memberships[existingMembershipIndex] = structuredClone(membership);
  }

  async generateMagicLink(email: string) {
    this.generatedLinks.push(email);
    return `token-for-${email}`;
  }
}

const bootstrapArguments = [
  "bootstrap",
  "--project-url",
  "https://project.supabase.co",
  "--app-origin",
  "https://household.example",
  "--household",
  "Home",
  "--member",
  "one@example.com:One",
  "--member",
  "two@example.com:Two",
  "--secret-stdin",
];

describe("bootstrap", () => {
  it("creates a household, confirmed users, memberships, and links", async () => {
    const gateway = new FakeIdentityAdminGateway();
    const links = await executeIdentityAdminCommand(
      parseIdentityAdminArguments(bootstrapArguments),
      gateway,
    );

    expect(gateway.households).toEqual([{ id: "household-1", name: "Home" }]);
    expect(gateway.users.every(({ confirmed }) => confirmed)).toBe(true);
    expect(gateway.memberships).toEqual([
      {
        householdId: "household-1",
        userId: "user-1",
        displayName: "One",
      },
      {
        householdId: "household-1",
        userId: "user-2",
        displayName: "Two",
      },
    ]);
    expect(links).toEqual([
      "https://household.example/auth/consume?token_hash=token-for-one%40example.com&type=magiclink",
      "https://household.example/auth/consume?token_hash=token-for-two%40example.com&type=magiclink",
    ]);
  });

  it("reconciles a partial run and remains idempotent", async () => {
    const gateway = new FakeIdentityAdminGateway();
    gateway.households.push({ id: "household-1", name: "Home" });
    gateway.users.push({
      id: "user-1",
      email: "one@example.com",
      confirmed: false,
    });
    gateway.memberships.push({
      householdId: "household-1",
      userId: "user-1",
      displayName: "Old name",
    });
    const command = parseIdentityAdminArguments(bootstrapArguments);

    await executeIdentityAdminCommand(command, gateway);
    await executeIdentityAdminCommand(command, gateway);

    expect(gateway.households).toHaveLength(1);
    expect(gateway.users).toHaveLength(2);
    expect(gateway.memberships).toHaveLength(2);
    expect(gateway.memberships[0]?.displayName).toBe("One");
    expect(gateway.createdUsers).toEqual(["two@example.com"]);
    expect(gateway.confirmedUsers).toEqual(["user-1"]);
  });

  it("refuses a third membership before mutation", async () => {
    const gateway = new FakeIdentityAdminGateway();
    gateway.households.push({ id: "household-1", name: "Home" });
    gateway.users.push(
      {
        id: "user-1",
        email: "one@example.com",
        confirmed: true,
      },
      {
        id: "user-3",
        email: "existing@example.com",
        confirmed: true,
      },
    );
    gateway.memberships.push(
      {
        householdId: "household-1",
        userId: "user-1",
        displayName: "One",
      },
      {
        householdId: "household-1",
        userId: "user-3",
        displayName: "Existing",
      },
    );

    await expect(
      executeIdentityAdminCommand(
        parseIdentityAdminArguments(bootstrapArguments),
        gateway,
      ),
    ).rejects.toThrow(/third version-one member/);
    expect(gateway.createdUsers).toEqual([]);
    expect(gateway.generatedLinks).toEqual([]);
  });

  it("refuses a household name collision before mutation", async () => {
    const gateway = new FakeIdentityAdminGateway();
    gateway.households.push({ id: "household-1", name: "Another home" });

    await expect(
      executeIdentityAdminCommand(
        parseIdentityAdminArguments(bootstrapArguments),
        gateway,
      ),
    ).rejects.toThrow(/conflicts with requested household/);
    expect(gateway.users).toEqual([]);
  });
});

describe("member links", () => {
  it.each(["enroll-link", "recover-link"])(
    "%s mints a magic link for an existing member",
    async (commandName) => {
      const gateway = new FakeIdentityAdminGateway();
      gateway.users.push({
        id: "user-1",
        email: "member@example.com",
        confirmed: true,
      });
      gateway.memberships.push({
        householdId: "household-1",
        userId: "user-1",
        displayName: "Member",
      });

      const links = await executeIdentityAdminCommand(
        parseIdentityAdminArguments([
          commandName,
          "--project-url",
          "https://project.supabase.co",
          "--app-origin",
          "https://household.example",
          "--member-email",
          "MEMBER@example.com",
          "--secret-stdin",
        ]),
        gateway,
      );

      expect(links).toEqual([
        "https://household.example/auth/consume?token_hash=token-for-member%40example.com&type=magiclink",
      ]);
      expect(gateway.generatedLinks).toEqual(["member@example.com"]);
    },
  );

  it("refuses a confirmed user without membership", async () => {
    const gateway = new FakeIdentityAdminGateway();
    gateway.users.push({
      id: "user-1",
      email: "member@example.com",
      confirmed: true,
    });

    await expect(
      executeIdentityAdminCommand(
        parseIdentityAdminArguments([
          "recover-link",
          "--project-url",
          "https://project.supabase.co",
          "--app-origin",
          "https://household.example",
          "--member-email",
          "member@example.com",
          "--secret-stdin",
        ]),
        gateway,
      ),
    ).rejects.toThrow(/is not a household member/);
  });
});

describe("command boundary", () => {
  it("reads the administrator secret only from stdin", async () => {
    const gateway = new FakeIdentityAdminGateway();
    const gatewayArguments: string[][] = [];
    const output: string[] = [];

    await runIdentityAdmin(bootstrapArguments, {
      createGateway(projectUrl, secret) {
        gatewayArguments.push([projectUrl, secret]);
        return gateway;
      },
      async readSecret() {
        return "secret-from-stdin\n";
      },
      writeLine(line) {
        output.push(line);
      },
    });

    expect(gatewayArguments).toEqual([
      ["https://project.supabase.co", "secret-from-stdin"],
    ]);
    expect(output).toHaveLength(2);
  });

  it("requires the explicit stdin flag", () => {
    expect(() =>
      parseIdentityAdminArguments(
        bootstrapArguments.filter((value) => value !== "--secret-stdin"),
      ),
    ).toThrow(/--secret-stdin must be provided exactly once/);
  });

  it("requires exactly two distinct bootstrap members", () => {
    const duplicateMembers = bootstrapArguments.map((value) =>
      value === "two@example.com:Two" ? "one@example.com:Again" : value,
    );

    expect(() => parseIdentityAdminArguments(duplicateMembers)).toThrow(
      /distinct email addresses/,
    );
    expect(() =>
      parseIdentityAdminArguments([
        ...bootstrapArguments.slice(0, -1),
        "--member",
        "three@example.com:Three",
        "--secret-stdin",
      ]),
    ).toThrow(/exactly two --member/);
    expect(() =>
      parseIdentityAdminArguments([
        ...bootstrapArguments.slice(0, 9),
        "--secret-stdin",
      ]),
    ).toThrow(/exactly two --member/);
  });
});
