# ADR 0031: Effect v4 for the Expo client

- Status: Accepted
- Date: 2026-09-15
- Follows: ADR 0030 (Expo iOS client)

## Context

The Expo rewrite is the right place to adopt Effect: all mobile data
mutations go through Supabase RPCs that can fail (auth, RLS, validation,
network), and the current promise/throw style erases those cases. Effect
v4 is in RC (`4.0.0-rc.115`, stable targeted Q3/Q4 2026) with no broad
breaking changes planned, and v3 is feature-frozen.

## Decision

Pin `effect@4.0.0-rc.115` exact in `apps/mobile`. Prefer stable
top-level modules (`Effect`, `Data`, `Context`); use `effect/unstable/*`
only with a comment. All ecosystem packages share the v4 version line,
so companions are added at matching versions when needed.

Boundaries:

- Mutations and Supabase access are `Effect.gen` programs with tagged
  errors (`NotSignedInError`, `SupabaseError`, `ValidationError`).
- React components stay Effect-free; conversion happens once at the
  call site via `Effect.runPromise` in `src/effect/supabase.ts`.
- Screens keep their loading/error/empty contracts; error messages come
  from `mutationMessage`.

## Tooling

- `@effect/eslint-plugin` with `no-import-from-barrel-package` as an
  error, so v4 tree-shaking holds (deep `effect/Effect`-style imports).
- `typescript-eslint` base config for the mobile package.
- `@effect/language-service` as a TypeScript plugin in
  `apps/mobile/tsconfig.json` for editor diagnostics and refactors.

## Consequences

- The mobile lane tracks the v4 RC and absorbs narrow RC breakages
  until stable. Web (`src/`, `supabase/`) is unaffected.
- New mobile data code follows the Effect pattern; the promise
  boundary keeps screens unchanged.
