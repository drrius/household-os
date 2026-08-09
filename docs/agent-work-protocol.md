# Parallel-agent work protocol

## Integration model

Use one integration lead and bounded implementation lanes. Agents work from explicit contracts and path ownership; they do not independently reinterpret product scope. The integration lead sequences shared migrations, generated types, package metadata, and cross-feature tests.

Each task must state:

- milestone and acceptance criteria;
- owned paths;
- files that are read-only for that lane;
- prerequisite commits or schema contracts;
- required checks;
- evidence expected at handoff.

## Permanent lanes

### Integration and platform

Owns root configuration, CI, dependency pins, shared generated types, Vercel configuration, Supabase project configuration, and final integration. This is the only lane allowed to change root package metadata during parallel work.

### Identity and authorization

Owns passkey flows, enrollment and recovery commands, session protection, household bootstrap, membership RLS, and auth tests. It does not design navigation or visual components.

### Routine domain

Owns pure recurrence rules, routine migrations and commands, occurrences, assignment, pets, areas, completion history, and property tests.

### Meals and groceries

Owns meal definitions and planning, grocery provenance and categories, duplicate suggestions, shopping sessions, and their database and domain tests.

### Money domain

Owns ledger migrations and commands, allocation rules, drafts, refunds, settlements, corrections, balance explanations, and adversarial financial tests. It cannot weaken append-only or zero-sum invariants.

### Notifications and synchronization

Owns inbox records, push subscriptions, digest and reminder jobs, realtime invalidation contracts, and retention cleanup.

### Product UI

Begins only after the user provides the accepted visual design. It owns application composition and presentation while consuming frozen domain commands; it must not move invariants into client code.

### Verification

Owns adversarial RLS, concurrency, property, integration, accessibility, and critical-path browser tests. It reports failures independently and does not silently relax assertions to make a lane pass.

## Collision rules

- One active owner per migration sequence. Other lanes draft SQL in lane-specific scratch files until the integration lead allocates timestamps.
- Do not regenerate shared database types while another migration is unmerged.
- Do not edit root lockfiles manually. The integration lead installs dependency changes in one batch.
- Prefer new focused files over shared registries and barrel files.
- When a required shared contract is missing, stop that branch and report the exact dependency rather than inventing a parallel contract.

## Review gates

Every lane receives two reviews before integration:

1. A domain review checks behavior against the ADRs and domain model.
2. An adversarial review searches for authorization gaps, retries, races, destructive history changes, and free-tier violations.

The integration lead resolves cross-lane conflicts and runs the full verification suite. A passing lane is not a releasable milestone until its migrations, generated types, and cross-feature tests are integrated.

## Suggested first cluster

Start M1 and the pure portions of M2 and M4 in parallel after M0 passes:

- Agent A: passkey and tenancy implementation.
- Agent B: recurrence algebra and property tests, without database migration edits.
- Agent C: ledger algebra and property tests, without database migration edits.
- Integration lead: core schema contracts, CI, dependency changes, generated types, and merge sequencing.

This first cluster maximizes independent work while the integration lead freezes the database command interfaces needed by later milestones.
