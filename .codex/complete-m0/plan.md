# Complete M0 plan

Stable finish line: [goal.md](goal.md)

## Phase 1: Repair the repository verification surface

Status: complete

### Implementation

- [x] Preserve `Household OS Designs.html` without formatting, staging, or deleting it.
- [x] Exclude the separate design artifact from repository formatting checks without weakening checks for application source.
- [x] Reconcile the generated `apps/web/next-env.d.ts` state according to current local Next.js documentation.
- [x] Confirm the workspace, exact dependency pins, lockfile, neutral shell, CI, and agent contracts remain intact.

### Verification

- [x] Run `pnpm verify` and retain the successful output summary.
- [x] Run `git diff --check`.
- [x] Confirm the design artifact's checksum is unchanged.

### Exit criteria

- [x] The non-database M0 checks pass without touching the user's design or adding visual design.

## Phase 2: Establish the real local Supabase surface

Status: complete

### Implementation

- [x] Inspect available free Docker-compatible runtimes and install the smallest supported local option if needed.
- [x] Start the runtime and use the pinned Supabase CLI discovered through `--help` and official current documentation.
- [x] Start Supabase with the committed `supabase/config.toml`.
- [x] Correct the monorepo environment example and README so the Next.js app loads public local values from `apps/web/.env.local` and never receives the administrator secret.

### Verification

- [x] Record the runtime and CLI versions.
- [x] Run `pnpm db:start` successfully and inspect all local service health states.
- [x] Confirm no local credential or runtime output is committed.

### Exit criteria

- [x] The complete local Supabase stack is healthy on the repository's configured ports at CHF 0.

## Phase 3: Verify and repair the tenancy database foundation

Status: complete

### Implementation

- [x] Apply all migrations from a clean local database using `pnpm db:reset`.
- [x] Evaluate the tenancy schema, indexes, privileges, policies, and pgTAP coverage against the M0 contract and current Supabase behavior.
- [x] Assert RLS enablement and policy inventory for both tenant-owned foundation tables; leave passkey and administrator-recovery behavior for M1.
- [x] Add focused tests and an append-only corrective migration for the gaps exposed by the real verifier.

### Verification

- [x] Run `pnpm db:reset` successfully from a clean state.
- [x] Run `pnpm db:test` and retain the assertion count and pass result.
- [x] Rerun database tests after the clean reset and run current security and performance advisors.

### Exit criteria

- [x] The tenancy migration applies from scratch, database tests pass, and RLS is not weakened or left untested at the required M0 boundary.

## Phase 4: Integrate and prove M0

Status: complete

### Implementation

- [x] Review the full diff against M0 and remove accidental scope expansion.
- [x] Scan committed files and Git history for real secrets without printing credential values.
- [x] Review CI action pinning and database coverage against the repository's exact-dependency and M0 verification contracts.
- [x] Map every M0 exit criterion to evidence and record any intentionally uncommitted user-owned file.

### Verification

- [x] Run the complete primary verifier: `pnpm db:start`, `pnpm db:reset`, `pnpm db:test`, and `pnpm verify`.
- [x] Run `git diff --check` and record `git status -sb`.
- [x] Independently review the final M0 diff for authorization, migration, test, and scope regressions.

### Exit criteria

- [x] Every M0 exit criterion has current, reproducible proof and no required work remains.

## Evidence log

- 2026-08-09 baseline: `pnpm verify` failed only at Prettier because it scanned the untracked design HTML; lint, typecheck, three domain tests, and the Next.js production build passed independently.
- 2026-08-09 baseline: Supabase CLI `2.113.0` is pinned and runnable, but `docker`, `podman`, and `orb` commands were absent, so the local database verifier could not start.
- 2026-08-09 baseline: `main` tracks `origin/main`; `apps/web/next-env.d.ts` is modified by Next.js generation and `Household OS Designs.html` is untracked.
- 2026-08-09 Phase 1 attempt 1: the formatting boundary successfully excluded the design artifact and generated declaration, but `pnpm verify` exposed formatting drift in the new goal brief; both durable goal files were then formatted without weakening the verifier.
- 2026-08-09 Phase 1 pass: `pnpm verify` exited zero; Prettier, ESLint, Next type generation, TypeScript, three domain tests, and the neutral production build all passed. `git diff --check` also exited zero, and the design checksum remained `ab9faacf8d71348a12f3666def59d6bae747b2777e0122b58ee8ff901e19d1dc`.
- 2026-08-09 independent repository audit: the package pins, lockfile, domain boundary, neutral shell, committed-secret boundary, and existing GitHub `pnpm verify` run passed. The audit found a wrong monorepo `.env.local` location, web exposure of the administrator-secret placeholder, incomplete RLS baseline assertions, mutable CI action tags, and no CI database job; these are routed into Phases 2 through 4 without expanding into M1.
- 2026-08-09 Phase 2 startup: Colima `0.10.3` started through macOS Virtualization.framework with Docker client `29.7.2`, server `29.5.2`, four CPUs, and 8 GB RAM. `pnpm db:start` applied both tenancy migrations and all twelve Supabase containers reported running, with ten explicit health checks passing.
- 2026-08-09 Phase 3 attempt 1: `pnpm db:test` reached the real database but failed one of seven assertions because the old test still expected `public.is_household_member` after the hardening migration moved it to `private`; the route is to replace that stale assertion with private-helper, privilege, RLS, and live role-based checks.
- 2026-08-09 Phase 3 focused pass: the expanded pgTAP suite passed all 29 assertions against the running database, covering explicit privileges, private-helper exposure, RLS structure, member and nonmember reads, permitted name updates, and blocked cross-household updates. A clean reset and second test run remain before phase exit.
- 2026-08-09 Phase 3 clean pass: `pnpm db:reset` recreated the local database, applied `20260809100000_core_tenancy.sql` and `20260809190100_harden_core_tenancy.sql`, seeded the empty personal-data-safe seed, and restarted services. The subsequent `pnpm db:test` passed all 29 assertions, and `supabase db advisors --local --type all --level info --fail-on warn` reported no issues.
- 2026-08-09 final database review: live ACL readback found that `service_role` retained default `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` privileges because the hardening migration granted CRUD without first revoking defaults. The migration now revokes all service-role table privileges before regranting CRUD, and the suite asserts that exact privilege set plus the absence of `MAINTAIN`.
- 2026-08-09 exact-ACL attempt 1: the clean reset succeeded, but pgTAP's `results_eq` aborted on the differing collation carried by `information_schema` privilege strings. The assertion now verifies an exact count of four standard privileges and membership in the CRUD set, with `MAINTAIN` checked separately; the authorization expectation is unchanged.
- 2026-08-09 final primary pass: `pnpm db:start`, `pnpm db:reset`, `pnpm db:test`, and `pnpm verify` all exited zero on the final state. The reset applied both migrations from scratch, pgTAP passed 34 of 34 assertions, Prettier and ESLint passed, TypeScript and Next type generation passed, all three domain tests passed, and the neutral Next.js production build completed.
- 2026-08-09 final security pass: Supabase advisors reported no issues at info level with warnings configured to fail. Live ACL readback showed only `DELETE`, `INSERT`, `SELECT`, and `UPDATE` for `service_role` on both foundation tables, with `MAINTAIN` false.
- 2026-08-09 final repository pass: working-tree and Git-history token-pattern scans, tracked credential-file checks, and `git diff --check` passed. Both independent read-only reviews reported no remaining M0 blockers. The design artifact checksum remained `ab9faacf8d71348a12f3666def59d6bae747b2777e0122b58ee8ff901e19d1dc` throughout.
- 2026-08-09 integration: implementation commit `db851fc` contains the M0 repository changes. `Household OS Designs.html` remains untouched and untracked; `main` is intentionally not pushed without separate approval.

## M0 exit-criteria mapping

- `pnpm verify` passes: final primary pass recorded above.
- Local Supabase starts and database tests pass: Colima and Docker are healthy, the stack starts, a clean reset applies both migrations, and pgTAP passes 34 of 34 assertions.
- The neutral shell builds without invented design: the Next.js production build passes, both reviewers confirmed the shell remains neutral, and the user-owned design file was never inspected or modified.
- No secrets are committed: public web variables live in `apps/web/.env.example`, no administrator secret enters the web environment, and both current-tree and full-history token scans pass.

## Next action

No M0 work remains. Pushing the two local completion commits is outside the goal's approval boundary and requires separate user approval.
