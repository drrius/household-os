# Household OS agent contract

Read `docs/product-scope.md`, `docs/domain-model.md`, and the relevant ADRs before changing behavior. Version-one product decisions are closed; do not add features or reinterpret scope without an explicit new decision.

## Non-negotiable boundaries

- Do not design or style the product UI. The user is handling frontend visual design separately. Foundation UI must remain neutral.
- Keep household work and financial obligations as separate domains.
- Financial history is append-only. Corrections use reversal and replacement events; balances are always derived.
- Store CHF as integer centimes. Never use floating-point monetary arithmetic.
- Every tenant-owned table must carry or safely derive `household_id` and have tested RLS.
- Browser clients never receive the Supabase secret key.
- Sensitive mutations authenticate and authorize as if they were public API endpoints.
- Version one is online-only, CHF-only, two-member, one-household, and hard-capped at CHF 0 operating cost.
- Do not add backups, exports, bank connections, payment processing, analytics, OCR, offline support, or additional identity providers.

## Repository rules

- Use pnpm and commit `pnpm-lock.yaml`.
- Pin exact dependency versions.
- Keep migrations append-only after merge. Fix a merged migration with a new migration.
- Put pure domain rules in `packages/domain`; keep React, Supabase clients, and browser APIs out of that package.
- Keep server-only modules behind `server-only` imports and never re-export them from client entry points.
- Avoid barrel imports in performance-sensitive application code.
- Add a database or property test with every new invariant.
- Add a Playwright flow only after the user supplies the visual design for the affected surface.

## Parallel work

Agents own paths, not vague features. Declare ownership in the task description and avoid editing another active lane's files. Shared files—root package metadata, generated database types, the first migration, and global CI—belong to the integration lane.

Read `docs/agent-work-protocol.md` before parallel implementation.

## Required checks

Run the smallest relevant checks during development and `pnpm verify` before integration. Database changes additionally require `pnpm db:test`. Financial changes require both example tests and property tests.

## Cursor Cloud specific instructions

Standard commands live in `README.md` and the root `package.json` scripts. These notes only capture non-obvious startup caveats for this VM.

Services:

- Web app (`@household-os/web`, Next.js 16): `pnpm dev` serves http://localhost:3000.
- Local Supabase stack (Postgres, Auth, Realtime, Storage) via the Supabase CLI + Docker: `pnpm db:start` (API `54321`, DB `54322`, Studio `54323`); stop with `pnpm db:stop`.

Startup caveats:

- Docker has no systemd here. Start the daemon once per VM boot before any `db:*` command with `sudo dockerd &` (it uses the `fuse-overlayfs` driver set in `/etc/docker/daemon.json`). The `ubuntu` user is in the `docker` group, so `docker` and `supabase` need no sudo once the daemon is up.
- `next dev` loads env from `apps/web/.env.local`, NOT the repo-root `.env.local` the README implies. Without valid keys there, the Supabase proxy/pages return HTTP 500 from the zod check in `apps/web/src/lib/env.ts`. Copy `.env.example` to `apps/web/.env.local` and fill in the publishable/secret keys printed by `pnpm db:start` (or `supabase status`). Both `.env.local` paths are gitignored.
- Playwright browsers (chromium, webkit) are only needed for `pnpm test:e2e`; if the `@playwright/test` version changes, refresh them with `pnpm exec playwright install chromium webkit`. The Playwright config auto-starts `pnpm dev` and reuses an already-running server.

Checks: `pnpm verify` needs neither Docker nor browsers; `pnpm db:test` (pgTAP) needs the Supabase stack running.
