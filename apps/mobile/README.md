# @household-os/mobile

Expo iOS client (ADR 0030). Online-only. The browser and this app use the
Supabase **publishable** URL + anon key only. Never add the service-role secret.

## Run (no Apple Developer account needed)

```sh
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @household-os/mobile start
```

`EXPO_PUBLIC_USE_MOCK=true` (the example default) shows a fake household so
you can walk the five tabs without Sign in with Apple. Preview and production
EAS profiles set the flag to `false`.

Open with Expo Go or an iOS Simulator dev build
(`eas build --profile development --platform ios --local` on a Mac).

## Session storage

The Supabase session lives in **AsyncStorage**. That matches a publishable-key
client: the token is not a secret, and SecureStore is reserved for a later
credential if we need one. The README previously mentioned SecureStore; the
client never used it for the session.

## Needs Apple Developer account (owner, not an agent)

- Team ID, bundle ID `ch.household.os`, ASC App ID → fill `eas.json`
- Sign in with Apple capability → wire `src/lib/auth-apple.ts` to
  `supabase.auth.signInWithIdToken`
- APNs Auth Key → Expo push via `expo-notifications`

## Boundaries

- Pure money and date rules stay in `src/domain` and `src/lib/ui/zurich-date`.
  Mobile imports those modules; `packages/domain` is still a placeholder.
- Money stays integer centimes, server-authoritative, no offline queue.
- Web (`pnpm build` / Vercel) is unchanged as a deployable Next.js app.
