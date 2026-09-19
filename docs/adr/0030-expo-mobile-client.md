# ADR 0030: Add an Expo iOS client alongside the Next.js web app

- Status: Accepted
- Date: 2026-09-15
- Supersedes: relevant parts of ADR 0004 (phone-first web only), ADR 0024 (one root app)

## Context

Version one is a phone-first Next.js PWA. Animations and feel on iPhone are not smooth enough, and both household members are on iPhone. The household wants a native client distributed via TestFlight for two internal testers, without a full App Store release yet.

Agreed constraints for this step: online-only (no offline queue; revisit later), Sign in with Apple is allowed as a mobile auth path, Expo push notifications are allowed, CHF-only integer-centimes ledger and Supabase RLS model are unchanged.

## Decision

Add `apps/mobile` (Expo, TypeScript, Expo Router) as a second deployable runtime next to the existing root Next.js app. Keep `supabase/` (Postgres, RLS, transactional RPCs, Cron) and `src/domain/` (pure recurrence and money rules) as the shared source of truth.

`packages/domain` extraction follows in a later change; `src/domain` remains canonical until then so the web app keeps working untouched.

Mobile uses the Supabase publishable key only, never the secret key. Financial commands stay transactional server-side with idempotency keys; the client treats responses as authoritative. No offline mutation queue in this phase.

## Consequences

- The repository becomes a pnpm workspace with `.`, `apps/*`, `packages/*`.
- Apple Developer Program ($99/yr) is required for TestFlight, Sign in with Apple capability, and APNs. This lifts the hard CHF 0 cap for the mobile lane only.
- Web stays intact and deployable from the root until the native client reaches parity and the household explicitly retires it.
- `apps/mobile` is ignored by root Next lint/typecheck/test configs in this scaffold; it gets its own Expo lint/typecheck once screens land.
