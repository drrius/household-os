# Household OS

Household OS is a private, two-person application for household routines, pet care, meal planning, groceries, and auditable CHF shared expenses.

The version-one product contract is frozen in [docs/product-scope.md](docs/product-scope.md). Visual design is intentionally deferred and must not be invented during foundation work.

## Stack

- Next.js App Router and TypeScript
- Supabase Postgres, Auth, Realtime, Storage, Edge Functions, and Cron
- pnpm workspace
- Vitest, fast-check, pgTAP, and Playwright
- Vercel Hobby with one Supabase Free production project

## Workspace

```text
apps/web                  Next.js application
packages/domain           Pure domain rules and property tests
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
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Use the public project URL and publishable key printed by `pnpm db:start` in
`apps/web/.env.local`. The Supabase administrator secret belongs only in the
future local administration tooling; never place it in the web application's
environment or commit it.

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
