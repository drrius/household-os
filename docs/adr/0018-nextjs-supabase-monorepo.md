# ADR 0018: Use Next.js, Supabase, and one pnpm workspace

- Status: Accepted; repository-layout decision superseded by ADR 0024
- Date: 2026-08-09

## Context

Version one needs a phone-first web application, server-controlled domain commands, a hosted relational database, authentication, realtime synchronization, attachments, scheduled work, and a repository structure suitable for parallel implementation.

## Decision

The application uses Next.js with the App Router and TypeScript. Supabase provides hosted Postgres, Auth, Realtime, Storage, Edge Functions, and Cron in Frankfurt.

The project uses one pnpm workspace containing the Next.js application, shared domain packages, Supabase migrations and functions, database tests, and end-to-end tests. Version one has one hosted environment plus local development.

Frontend visual design will be performed separately after product design is complete. These product documents define information architecture, behavior, states, and accessibility requirements but will not prescribe a visual system.

## Consequences

Schema, server commands, generated types, client behavior, and tests can evolve in one atomic change. The UI design process can work against a stable behavioral contract without being constrained by premature styling decisions.
