# @household-os/mobile

Expo iOS client scaffold (ADR 0030). Online-only, Supabase publishable key only.

## Run (no Apple Developer account needed)

```sh
pnpm --filter @household-os/mobile install
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @household-os/mobile start
```

Then open with Expo Go (Android) or an iOS Simulator dev build
(`eas build --profile development --platform ios --local` on a Mac).

## Needs Apple Developer account (async, owner)

- Team ID, bundle ID `ch.household.os`, ASC App ID -> fill into `eas.json`
- Sign in with Apple capability -> wire `src/lib/auth-apple.ts` to
  `supabase.auth.signInWithIdToken`
- APNs Auth Key -> Expo push via `expo-notifications`

## Boundaries

- Pure rules stay in `src/domain` (web-owned for now); `packages/domain`
  extraction is the next change.
- Money stays integer centimes, server-authoritative, no offline queue.
- Never add the Supabase service-role secret here.
