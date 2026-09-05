# Household OS agent contract

Read `docs/product-scope.md`, `docs/domain-model.md`, and the relevant ADRs before changing behavior. Version-one product decisions are closed; do not add features or reinterpret scope without an explicit new decision.

## Non-negotiable boundaries

- Product UI design and styling are in scope for post-v1 work. The version-one design freeze is lifted; layout, styling, copy, spacing, contrast, and touch targets may be changed. This does not reopen version-one product scope.
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
- Put pure domain rules in `src/domain`; keep React, Supabase clients, and browser APIs out of that directory.
- Keep server-only modules behind `server-only` imports and never re-export them from client entry points.
- Avoid barrel imports in performance-sensitive application code.
- Add a database or property test with every new invariant.
- Add a Playwright flow only after the design of the affected surface is settled.

## Parallel work

Agents own paths, not vague features. Declare ownership in the task description and avoid editing another active lane's files. Shared files—root package metadata, generated database types, the first migration, and global CI—belong to the integration lane.

Read `docs/agent-work-protocol.md` before parallel implementation.

## Required checks

Run only the minimal local verification that provides the smallest meaningful proof the change works: run the tests you touched and directly affected tests, plus targeted lint and typechecking for the scope you changed. CI runs the full suite; do not run `pnpm verify` or full test suites locally by default. For database changes, run the relevant database tests. For financial changes, run focused example tests and property tests.

Test meaningful logic or observable behavior. Do not render components to static markup to assert props or attributes. Do not add tests that merely assert callback wiring or mirror the implementation.

## Cursor Cloud specific instructions

Cloud VM setup lives in `.cursor/environment.json`, which runs `.cursor/scripts/install.sh` and `.cursor/scripts/start.sh`.

- `start.sh` regenerates the root `.env.local` on every VM start. Manual edits do not survive the next start.
- If Docker or the local Supabase stack looks down mid-session, run `bash .cursor/scripts/start.sh` again. The script is idempotent. Do not start `dockerd` by hand.
- Only `pnpm test:e2e` needs Playwright browsers. After the Playwright version changes, run `pnpm exec playwright install chromium webkit`.
- `pnpm verify` needs neither Docker nor browsers. `pnpm db:test` needs the running Supabase stack.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
