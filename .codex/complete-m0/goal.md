# Complete M0

Companion plan: [plan.md](plan.md)

## Outcome

Complete the repository-foundation milestone defined in `docs/implementation-plan.md`: the pnpm workspace, neutral Next.js shell, local Supabase configuration, tenancy migration, pure domain package, baseline tests, CI, and agent ownership contract are present and independently verified.

## Baseline

- The foundation is committed on `main` and pushed to the private GitHub repository `drrius/household-os`.
- Linting, TypeScript checks, domain tests, and the Next.js production build pass independently.
- `pnpm verify` fails because the separate untracked `Household OS Designs.html` artifact is included in Prettier's repository-wide scan.
- The Next.js build regenerated `apps/web/next-env.d.ts`, leaving a tracked change that the application-level agent contract says should be committed rather than repeatedly discarded.
- Supabase CLI `2.113.0` is pinned, but neither Docker nor a Docker-compatible container runtime is installed, so local Supabase cannot start and `pnpm db:test` has not run.
- The committed tenancy pgTAP suite currently checks schema structure and policy names; its actual behavior must be evaluated against the running local stack before M0 can pass.

## Constraints

- Preserve `Household OS Designs.html` byte-for-byte and do not implement or infer visual design from it.
- Stay within M0. Do not implement passkey enrollment, administrator recovery, protected routing, or other M1 behavior.
- Follow the repository's accepted product scope, ADRs, and `AGENTS.md` contract.
- Keep all dependencies exactly pinned and retain `pnpm-lock.yaml`.
- Treat the already-pushed first migration as merged; any schema correction requires a new append-only migration.
- Keep browser code free of Supabase secret keys and do not commit credentials or generated local secrets.
- Use only free local tooling and create no paid, metered, public, or hosted resource.
- Do not weaken or bypass verification to make the milestone appear complete.

## Non-goals

- M1 identity and passkey implementation.
- Hosted Supabase or Vercel project provisioning.
- Product UI design or Playwright feature flows.
- Backups, exports, analytics, offline support, or any other version-one exclusion.

## Primary verifier

On this Mac, using a running Docker-compatible container runtime and the pinned project CLI:

```bash
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm verify
```

Success means all four commands exit zero against a fresh local database, migrations apply from scratch, pgTAP reports no failed assertions, and the neutral Next.js production build completes.

## Supporting checks

- `git diff --check` reports no whitespace errors.
- The tenancy tables have RLS enabled, tenant membership behavior is covered at the level required by the M0 contract, and no test relies on weakening RLS.
- A committed-file and history scan finds no real Supabase keys, GitHub tokens, private keys, `.env` files, or equivalent credentials.
- `git status -sb` distinguishes project changes from the preserved user-owned design artifact.
- The existing GitHub CI definition still runs the same `pnpm verify` gate with pinned Node and pnpm versions.

## Iteration loop

Inspect the next failing verifier, make one scoped M0 repair, run the smallest relevant check, record the evidence in `plan.md`, and rerun the primary verifier from a fresh local database after database-affecting changes. Do not modify tests merely to conceal a product or authorization failure.

## Approval gates

Do not change GitHub visibility, provision hosted infrastructure, enable billing, publish a deployment, push new commits, or delete the user's design artifact without explicit approval. Installing and running a free local container runtime is within this goal because it is required to execute the declared local verifier.

## Blocker standard

A blocker requires an external capability or permission that remains unavailable after safe alternatives have been exhausted and the same condition has persisted for the required consecutive goal turns. A failing check, a missing package that can be installed for free, or an implementation defect is work to resolve rather than a blocker.

## Completion proof

Before marking the goal complete, record in `plan.md`:

- the container runtime and Supabase CLI versions used;
- successful output summaries for `pnpm db:start`, `pnpm db:reset`, `pnpm db:test`, and `pnpm verify`;
- the database-test assertion count and migration applied from a clean state;
- the secret-scan command and result;
- `git diff --check` and final `git status -sb` output;
- every M0 exit criterion mapped to concrete evidence.
