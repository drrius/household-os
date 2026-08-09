import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { canAdmitMember } from "../../src/domain/identity.ts";

export type HouseholdRecord = {
  id: string;
  name: string;
};

export type UserRecord = {
  id: string;
  email: string;
  confirmed: boolean;
};

export type MembershipRecord = {
  householdId: string;
  userId: string;
  displayName: string;
};

export type IdentityAdminGateway = {
  listHouseholds(): Promise<HouseholdRecord[]>;
  createHousehold(name: string): Promise<HouseholdRecord>;
  listUsers(): Promise<UserRecord[]>;
  createConfirmedUser(email: string): Promise<UserRecord>;
  confirmUser(userId: string): Promise<UserRecord>;
  listMemberships(): Promise<MembershipRecord[]>;
  createMembership(membership: MembershipRecord): Promise<void>;
  updateMembership(membership: MembershipRecord): Promise<void>;
  generateMagicLink(email: string): Promise<string>;
};

type BootstrapMember = {
  email: string;
  displayName: string;
};

type BootstrapCommand = {
  kind: "bootstrap";
  projectUrl: string;
  appOrigin: string;
  householdName: string;
  members: BootstrapMember[];
  secretFromStdin: true;
};

type MemberLinkCommand = {
  kind: "enroll-link" | "recover-link";
  projectUrl: string;
  appOrigin: string;
  memberEmail: string;
  secretFromStdin: true;
};

export type IdentityAdminCommand = BootstrapCommand | MemberLinkCommand;

export type IdentityAdminRuntime = {
  createGateway: (projectUrl: string, secret: string) => IdentityAdminGateway;
  readSecret: () => Promise<string>;
  writeLine: (line: string) => void;
};

function requireFlagValue(
  argv: string[],
  index: number,
  flag: string,
): { value: string; nextIndex: number } {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return { value, nextIndex: index + 2 };
}

function parseMember(value: string): BootstrapMember {
  const separator = value.indexOf(":");

  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(
      `--member must use email:DisplayName (received ${JSON.stringify(value)})`,
    );
  }

  const email = normalizeEmail(value.slice(0, separator));
  const displayName = value.slice(separator + 1).trim();

  if (displayName.length === 0) {
    throw new Error("--member display names must be non-empty");
  }

  return { email, displayName };
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!normalized.includes("@")) {
    throw new Error(`Invalid email address: ${email}`);
  }

  return normalized;
}

function normalizeOrigin(origin: string): string {
  const parsed = new URL(origin);

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`--app-origin must be an origin only (received ${origin})`);
  }

  return parsed.origin;
}

export function buildMagicLinkConsumeUrl(
  appOrigin: string,
  tokenHash: string,
): string {
  const url = new URL("/auth/consume", normalizeOrigin(appOrigin));
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", "magiclink");
  return url.toString();
}

export function parseIdentityAdminArguments(
  argv: string[],
): IdentityAdminCommand {
  const commandName = argv[0];

  if (
    commandName !== "bootstrap" &&
    commandName !== "enroll-link" &&
    commandName !== "recover-link"
  ) {
    throw new Error(
      "Usage: identity-admin <bootstrap|enroll-link|recover-link> ...",
    );
  }

  let projectUrl: string | undefined;
  let appOrigin: string | undefined;
  let householdName: string | undefined;
  let memberEmail: string | undefined;
  const members: BootstrapMember[] = [];
  let secretFromStdin = false;

  for (let index = 1; index < argv.length;) {
    const flag = argv[index];

    switch (flag) {
      case "--project-url": {
        const parsed = requireFlagValue(argv, index, flag);
        projectUrl = parsed.value;
        index = parsed.nextIndex;
        break;
      }
      case "--app-origin": {
        const parsed = requireFlagValue(argv, index, flag);
        appOrigin = normalizeOrigin(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--household": {
        const parsed = requireFlagValue(argv, index, flag);
        householdName = parsed.value.trim();
        index = parsed.nextIndex;
        break;
      }
      case "--member": {
        const parsed = requireFlagValue(argv, index, flag);
        members.push(parseMember(parsed.value));
        index = parsed.nextIndex;
        break;
      }
      case "--member-email": {
        const parsed = requireFlagValue(argv, index, flag);
        memberEmail = normalizeEmail(parsed.value);
        index = parsed.nextIndex;
        break;
      }
      case "--secret-stdin": {
        if (secretFromStdin) {
          throw new Error("--secret-stdin must be provided exactly once");
        }
        secretFromStdin = true;
        index += 1;
        break;
      }
      default: {
        throw new Error(`Unknown argument: ${flag}`);
      }
    }
  }

  if (!secretFromStdin) {
    throw new Error("--secret-stdin must be provided exactly once");
  }

  if (projectUrl === undefined || appOrigin === undefined) {
    throw new Error("--project-url and --app-origin are required");
  }

  if (commandName === "bootstrap") {
    if (householdName === undefined || householdName.length === 0) {
      throw new Error("--household is required for bootstrap");
    }

    if (members.length !== 2) {
      throw new Error("bootstrap requires exactly two --member values");
    }

    const emails = new Set(members.map((member) => member.email));

    if (emails.size !== members.length) {
      throw new Error("bootstrap members must use distinct email addresses");
    }

    if (memberEmail !== undefined) {
      throw new Error(
        "--member-email is only valid for enroll-link/recover-link",
      );
    }

    return {
      kind: "bootstrap",
      projectUrl,
      appOrigin,
      householdName,
      members,
      secretFromStdin: true,
    };
  }

  if (memberEmail === undefined) {
    throw new Error("--member-email is required");
  }

  if (members.length > 0 || householdName !== undefined) {
    throw new Error(
      `${commandName} does not accept --household or --member flags`,
    );
  }

  return {
    kind: commandName,
    projectUrl,
    appOrigin,
    memberEmail,
    secretFromStdin: true,
  };
}

async function resolveHousehold(
  gateway: IdentityAdminGateway,
  householdName: string,
): Promise<HouseholdRecord> {
  const households = await gateway.listHouseholds();

  if (households.length === 0) {
    return gateway.createHousehold(householdName);
  }

  const matching = households.find(
    (household) => household.name === householdName,
  );

  if (matching !== undefined && households.length === 1) {
    return matching;
  }

  if (matching === undefined) {
    throw new Error(
      `Existing household ${households[0]?.name} conflicts with requested household ${householdName}`,
    );
  }

  throw new Error("Version one allows exactly one household");
}

async function ensureConfirmedUser(
  gateway: IdentityAdminGateway,
  email: string,
  users: UserRecord[],
): Promise<UserRecord> {
  const existing = users.find((user) => user.email === email);

  if (existing === undefined) {
    const created = await gateway.createConfirmedUser(email);
    users.push(created);
    return created;
  }

  if (!existing.confirmed) {
    const confirmed = await gateway.confirmUser(existing.id);
    const index = users.findIndex((user) => user.id === existing.id);
    users[index] = confirmed;
    return confirmed;
  }

  return existing;
}

async function executeBootstrap(
  command: BootstrapCommand,
  gateway: IdentityAdminGateway,
): Promise<string[]> {
  const users = await gateway.listUsers();
  const requestedEmails = new Set(
    command.members.map((member) => member.email),
  );

  if (users.some((user) => !requestedEmails.has(user.email))) {
    throw new Error("Refusing to admit a third version-one member");
  }

  const household = await resolveHousehold(gateway, command.householdName);
  const memberships = await gateway.listMemberships();
  const householdMemberships = memberships.filter(
    (membership) => membership.householdId === household.id,
  );

  let projectedMemberCount = householdMemberships.length;

  for (const member of command.members) {
    const alreadyMember = householdMemberships.some((membership) => {
      const user = users.find(
        (candidate) => candidate.id === membership.userId,
      );
      return user?.email === member.email;
    });

    if (alreadyMember) {
      continue;
    }

    if (!canAdmitMember(projectedMemberCount)) {
      throw new Error(
        "Refusing to create a third version-one member for this household",
      );
    }

    projectedMemberCount += 1;
  }

  for (const member of command.members) {
    const user = await ensureConfirmedUser(gateway, member.email, users);
    const existingMembership = householdMemberships.find(
      (membership) => membership.userId === user.id,
    );

    if (existingMembership === undefined) {
      if (!canAdmitMember(householdMemberships.length)) {
        throw new Error(
          "Refusing to create a third version-one member for this household",
        );
      }

      const membership = {
        householdId: household.id,
        userId: user.id,
        displayName: member.displayName,
      };
      await gateway.createMembership(membership);
      householdMemberships.push(membership);
      continue;
    }

    if (existingMembership.displayName !== member.displayName) {
      const updated = {
        ...existingMembership,
        displayName: member.displayName,
      };
      await gateway.updateMembership(updated);
      const index = householdMemberships.findIndex(
        (membership) => membership.userId === user.id,
      );
      householdMemberships[index] = updated;
    }
  }

  if (
    users.length !== 2 ||
    users.some((user) => !user.confirmed) ||
    householdMemberships.length !== 2
  ) {
    throw new Error(
      "Bootstrap did not reconcile exactly two confirmed members",
    );
  }

  const links: string[] = [];

  for (const member of command.members) {
    const tokenHash = await gateway.generateMagicLink(member.email);
    links.push(buildMagicLinkConsumeUrl(command.appOrigin, tokenHash));
  }

  return links;
}

async function executeMemberLink(
  command: MemberLinkCommand,
  gateway: IdentityAdminGateway,
): Promise<string[]> {
  const users = await gateway.listUsers();
  const user = users.find(
    (candidate) => candidate.email === command.memberEmail,
  );

  if (user === undefined) {
    throw new Error(`No confirmed user for ${command.memberEmail}`);
  }

  if (!user.confirmed) {
    throw new Error(`${command.memberEmail} is not confirmed`);
  }

  const memberships = await gateway.listMemberships();
  const isMember = memberships.some(
    (membership) => membership.userId === user.id,
  );

  if (!isMember) {
    throw new Error(`${command.memberEmail} is not a household member`);
  }

  const tokenHash = await gateway.generateMagicLink(user.email);
  return [buildMagicLinkConsumeUrl(command.appOrigin, tokenHash)];
}

export async function executeIdentityAdminCommand(
  command: IdentityAdminCommand,
  gateway: IdentityAdminGateway,
): Promise<string[]> {
  switch (command.kind) {
    case "bootstrap":
      return executeBootstrap(command, gateway);
    case "enroll-link":
    case "recover-link":
      return executeMemberLink(command, gateway);
    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled command: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export async function runIdentityAdmin(
  argv: string[],
  runtime: IdentityAdminRuntime,
): Promise<void> {
  const command = parseIdentityAdminArguments(argv);
  const secret = (await runtime.readSecret()).trim();

  if (secret.length === 0) {
    throw new Error("Administrator secret read from stdin was empty");
  }

  const gateway = runtime.createGateway(command.projectUrl, secret);
  const links = await executeIdentityAdminCommand(command, gateway);

  for (const link of links) {
    runtime.writeLine(link);
  }
}

type HouseholdRow = {
  id: string;
  name: string;
};

type MembershipRow = {
  household_id: string;
  user_id: string;
  display_name: string;
};

export function createSupabaseIdentityAdminGateway(
  projectUrl: string,
  secret: string,
): IdentityAdminGateway {
  const supabase: SupabaseClient = createClient(projectUrl, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      experimental: { passkey: true },
    },
  });

  return {
    async listHouseholds() {
      const { data, error } = await supabase
        .from("households")
        .select("id, name")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`listHouseholds failed: ${error.message}`);
      }

      return ((data ?? []) as HouseholdRow[]).map((row) => ({
        id: row.id,
        name: row.name,
      }));
    },

    async createHousehold(name) {
      const { data, error } = await supabase
        .from("households")
        .insert({ name })
        .select("id, name")
        .single();

      if (error || data === null) {
        throw new Error(
          `createHousehold failed: ${error?.message ?? "no row returned"}`,
        );
      }

      const row = data as HouseholdRow;
      return { id: row.id, name: row.name };
    },

    async listUsers() {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (error) {
        throw new Error(`listUsers failed: ${error.message}`);
      }

      return (data.users ?? []).flatMap((user) => {
        if (user.email === undefined) {
          return [];
        }

        return [
          {
            id: user.id,
            email: normalizeEmail(user.email),
            confirmed: user.email_confirmed_at !== null,
          },
        ];
      });
    },

    async createConfirmedUser(email) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (error || data.user === null) {
        throw new Error(
          `createConfirmedUser failed: ${error?.message ?? "no user returned"}`,
        );
      }

      return {
        id: data.user.id,
        email: normalizeEmail(email),
        confirmed: true,
      };
    },

    async confirmUser(userId) {
      const { data, error } = await supabase.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (error || data.user === null) {
        throw new Error(
          `confirmUser failed: ${error?.message ?? "no user returned"}`,
        );
      }

      if (data.user.email === undefined) {
        throw new Error("confirmUser failed: user has no email");
      }

      return {
        id: data.user.id,
        email: normalizeEmail(data.user.email),
        confirmed: true,
      };
    },

    async listMemberships() {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, user_id, display_name");

      if (error) {
        throw new Error(`listMemberships failed: ${error.message}`);
      }

      return ((data ?? []) as MembershipRow[]).map((row) => ({
        householdId: row.household_id,
        userId: row.user_id,
        displayName: row.display_name,
      }));
    },

    async createMembership(membership) {
      const { error } = await supabase.from("household_members").insert({
        household_id: membership.householdId,
        user_id: membership.userId,
        display_name: membership.displayName,
      });

      if (error) {
        throw new Error(`createMembership failed: ${error.message}`);
      }
    },

    async updateMembership(membership) {
      const { error } = await supabase
        .from("household_members")
        .update({ display_name: membership.displayName })
        .eq("household_id", membership.householdId)
        .eq("user_id", membership.userId);

      if (error) {
        throw new Error(`updateMembership failed: ${error.message}`);
      }
    },

    async generateMagicLink(email) {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (error) {
        throw new Error(`generateMagicLink failed: ${error.message}`);
      }

      const tokenHash = data.properties.hashed_token;

      if (typeof tokenHash !== "string" || tokenHash.length === 0) {
        throw new Error("generateMagicLink failed: missing hashed_token");
      }

      return tokenHash;
    },
  };
}
