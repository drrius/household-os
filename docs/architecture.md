# Implementation architecture

## Runtime shape

The Next.js application runs on Vercel Hobby. Supabase Free in Frankfurt owns Postgres, authentication, realtime change delivery, attachments, scheduled jobs, and Edge Functions. The browser talks to Supabase with its publishable key under RLS; it never receives the secret key.

Next.js Server Components load authenticated read models where server rendering materially helps. Client Components own interactive household flows and subscribe to narrowly scoped Supabase changes. Realtime events invalidate affected queries rather than carrying a second source of domain truth.

## Command boundary

Simple descriptive edits may use RLS-protected table operations. Commands that close occurrences, post or correct ledger events, finish shopping sessions, or confirm expense drafts execute as transactional Postgres functions. Each accepts an idempotency key and rechecks household membership inside the transaction.

The browser must treat financial command responses as authoritative. It may optimistically update routine, meal, and grocery interactions, but must roll them back visibly if the server rejects the operation.

## Source boundaries

- `src/app` owns routing, rendering, and application composition.
- `src/lib` owns Supabase session integration, browser state, and server/client service boundaries.
- `src/domain` owns pure recurrence and money rules that require no React, network, clock, or database.
- `supabase` owns durable schema, authorization, transactional commands, scheduled generation, and database tests.
- `tests/e2e` owns only cross-boundary user workflows; it does not replace domain or RLS tests.

## Data and authorization

Every tenant row carries or safely derives `household_id`. RLS uses indexed membership checks. Authorization data is stored in relational membership rows rather than user-editable JWT metadata. Tables expose the narrowest required operations; privileged enrollment and recovery remain local administrator commands.

Financial events and their ledger entries are append-only. Corrections atomically reverse and optionally replace an event. Any operation that would leave ledger entries unbalanced fails its transaction.

## Scheduling

Supabase Cron invokes idempotent database functions for due occurrence generation, recurring expense drafts, digest candidates, and retention cleanup. Jobs process bounded batches and record a stable schedule key so retries cannot duplicate work.

Optional Web Push uses the same Cron plane. `run_drain_push_outbox` reconciles pending outbox rows that lost their subscription. `private.invoke_push_dispatch` posts to the `push-dispatch` Edge Function through `pg_net` only when Vault holds `push_dispatch_url` and a secret key under `push_dispatch_secret_key` (with the legacy service-role name supported during migration). The Edge Function accepts that key only through `apikey`, atomically leases one outbox row immediately before processing it, bounds external push requests within the lease, and requires the matching lease token to finalize it. Overlapping workers therefore claim different rows instead of duplicating a late batch. Successful subscription IDs persist across retries so a transient failure on one device does not resend to devices that already succeeded. Missing VAPID configuration defers delivery without consuming attempts. Local `start.sh` seeds Vault and injects VAPID into the Edge runtime. Production sets the matching public key in Vercel, sets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` with `supabase secrets set`, and stores the invoke URL plus dedicated secret key in Vault before enabling dispatch.

## Passkeys

The client opts into Supabase's experimental passkey API with an exactly pinned SDK. Local Supabase uses `localhost` as the WebAuthn relying party. Production chooses one stable Vercel hostname before enrollment and never changes it without re-enrolling both members.

## Attachments

The browser compresses images before upload. Storage enforces a 4 MiB object limit and private household paths. Attachment metadata belongs to its parent record; signed access is authorized through Storage RLS. No videos, transformations, OCR, or backup pipeline are included.

## Failure model

The application is online-only. A failed mutation remains visibly unsaved. Free-tier pausing or quota restriction is acceptable and must not trigger a paid overage. No background path may silently convert a draft into a financial event.
