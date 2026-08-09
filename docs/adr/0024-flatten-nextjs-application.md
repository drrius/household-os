# ADR 0024: Use one root Next.js application

- Status: Accepted
- Date: 2026-08-09
- Supersedes: ADR 0018's repository-layout decision

## Context

Version one has one deployable web application and no second consumer for a shared package. Splitting that application across `apps/web` and `packages/domain` added package manifests, workspace scripts, configuration layers, and dependency wiring without creating a useful deployment or ownership boundary.

## Decision

The repository uses one Next.js application rooted at the repository root and managed with pnpm. Routes and rendering live in `src/app`, application integrations live in `src/lib`, and pure recurrence and money rules live in `src/domain` with lint rules plus a DOM-free TypeScript check that prevent UI, persistence, and browser dependencies.

Supabase migrations, functions, and database tests remain under `supabase`, while cross-boundary browser tests remain under `tests/e2e`. The repository will add separate applications or internal packages only when a second deployable runtime or genuine code consumer exists.

## Consequences

Development, type checking, dependency installation, and Vercel deployment all operate from the repository root. Domain rules remain isolated and independently tested without a separate package, while removing multi-package configuration and indirection.
