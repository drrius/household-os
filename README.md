# Household OS

Household OS is a private, two-person application for household routines, pet care, meal planning, groceries, and auditable CHF shared expenses.

The version-one product contract is frozen in [docs/product-scope.md](docs/product-scope.md). Visual design is intentionally deferred and must not be invented during foundation work.

## Stack

- Next.js App Router and TypeScript
- Supabase Postgres, Auth, Realtime, Storage, Edge Functions, and Cron
- pnpm
- Vitest, fast-check, pgTAP, and Playwright
- Vercel Hobby with one Supabase Free production project

## Repository layout

```text
src/app                   Next.js routes and application shell
src/domain                Pure domain rules and property tests
src/lib                   Environment and Supabase integration
supabase/migrations       Append-only database migrations
supabase/tests/database   RLS and database invariant tests
tests/e2e                 Cross-feature acceptance tests
docs                      Product, architecture, ADRs, and agent contracts
```

## Local development

Requirements: Node.js 22+, pnpm 11+, and a Docker-compatible container runtime
such as Docker Desktop or Colima for local Supabase.

```bash
pnpm install
pnpm db:start
cp .env.example .env.local
pnpm dev
```

Use the public project URL and publishable key printed by `pnpm db:start` in
`.env.local`.

## Identity administration

After a local `db reset`, Auth users and passkeys are gone. Set up once:

```bash
cp .local/identity.example.json .local/identity.json
# edit both members
```

Then whenever local Auth is empty:

```bash
pnpm admin:local
# or wipe + re-bootstrap:
pnpm db:fresh
```

`admin:local` reads `.local/identity.json`, pulls the local `SECRET_KEY` from
`supabase status`, bootstraps both members, and prints enroll URLs. Open a URL
on `http://localhost:3000`, register a passkey, sign in. Pass `--open` to open
the first enroll link in the browser.

Production and one-off admin still use stdin for the secret. Pipe it from a
password manager:

```bash
op read "op://Private/Household OS/Supabase secret key" | pnpm admin bootstrap \
  --project-url https://project-ref.supabase.co \
  --app-origin https://household.example \
  --household "Our home" \
  --member "alice@example.com:Alice" \
  --member "bob@example.com:Bob" \
  --secret-stdin
```

The command prints one enrollment URL per member. Transfer each URL privately
to the matching member.

Generate another one-time link for an existing member with `enroll-link` or
`recover-link`:

```bash
op read "op://Private/Household OS/Supabase secret key" | pnpm admin recover-link \
  --project-url https://project-ref.supabase.co \
  --app-origin https://household.example \
  --member-email alice@example.com \
  --secret-stdin
```

Never put the administrator secret in `.env.local`, another Next.js environment
file, a command argument, or a file in this repository.

Production passkeys bind to one stable Vercel hostname chosen before enrollment.
Set `HOUSEHOLD_OS_WEBAUTHN_RP_ID` to that bare hostname when running
`pnpm check:webauthn`. Local Supabase keeps `rp_id = "localhost"`. Renaming the
production hostname after enrollment invalidates every registered passkey.

## Verification

```bash
pnpm verify
pnpm db:test
pnpm test:e2e
```

Database and browser tests require their respective local services. The default `verify` command remains independent of Docker and browser installation.

## Product and implementation references

- [Version-one scope](docs/product-scope.md)
- [Domain model](docs/domain-model.md)
- [Architecture](docs/architecture.md)
- [Implementation milestones](docs/implementation-plan.md)
- [Parallel-agent protocol](docs/agent-work-protocol.md)
- [Glossary](docs/glossary.md)
- [Architecture decisions](docs/adr)
