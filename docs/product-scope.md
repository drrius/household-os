# Household OS version-one scope

## Product promise

One private application tells two partners what their household needs today, coordinates meals and shopping, records pet and cleaning care, and answers who owes whom in CHF.

It replaces fragmented informal coordination and the need to open Splitwise for new shared expenses. It does not score the relationship or turn household labor into money.

## Primary destinations

- **Today**: overdue work, today's routines, meal and preparation work, shopping state, and money requiring confirmation.
- **Plan**: Monday-to-Sunday meal board, meal ideas, reusable meals, leftovers, recipe links, and linked prep.
- **Groceries**: categorized shared list, duplicate suggestions, concurrent shopping sessions, purchased history, and shopping-to-expense handoff.
- **Money**: immediate manual expenses, generated drafts, recurring drafts, refunds, corrections, opening balance, event explanations, and full or partial settlements.
- **Home**: routine definitions, pet profiles, areas, activity, members, notification settings, passkeys, and household settings.

## Included capabilities

- One private household with two equal members.
- Passkey-only normal authentication with manual enrollment and recovery.
- One-off, assigned, alternating, and shared routines.
- Calendar-based and completion-based recurrence.
- Completion, skipping, rescheduling, pausing, archiving, notes, and photos.
- Lightweight pet profiles linked to care routines.
- Weekly meal planning, meal library, leftovers, recipe links, and preparation tasks.
- Shared groceries with explicit concurrent shopping sessions.
- One auditable CHF ledger with 50/50 and exact splits.
- Recurring expense drafts, receipt attachments, refunds, corrections, and external settlements.
- Realtime online synchronization, in-app notifications, optional Web Push, and personal digests.
- Meaningful activity history and transparent financial derivation.

## Explicit exclusions

- Public registration, additional households, additional members, roles, ownership transfer, or member departure.
- Offline operation or native mobile applications.
- Points, leaderboards, chore valuation, or labor-to-money conversion.
- Full recipe management, nutrition, pantry quantities, expiry tracking, or automated meal suggestions.
- Item-level receipt pricing, OCR, receipt extraction, bank connections, payment initiation, budgets, financial analytics, or currency conversion.
- Veterinary records, medication tracking, or pet health measurements.
- Complex recurrence expressions, automatic seasons, or calendar integration.
- Email notifications, outbound authentication email, backups, restore automation, or data export.
- Videos, public sharing, commercial use, or paid infrastructure.

## Technical boundary

- Next.js App Router and TypeScript.
- One root Next.js application managed with pnpm.
- Vercel Hobby for the personal, non-commercial web application.
- One Supabase Free project in Frankfurt for Postgres, Auth, Realtime, Storage, Edge Functions, and Cron.
- One hosted environment plus local development.
- Hard production operating cost of CHF 0; free-tier restriction or pausing is preferable to billing.
- Visual design is a separate later phase.

## Release proof

Technical release requires passing type checks, linting, recurrence tests, property-based financial invariant tests, database and RLS integration tests, and critical Playwright flows on the supported browsers.

Product success requires four consecutive weeks in which both members use the application, all recurring household care is represented, meals and groceries are coordinated there, and no new Splitwise expenses are entered. A critical synchronization error or unreproducible balance restarts the trial.
