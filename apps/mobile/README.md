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
EAS profiles set the flag to `false`. The signed-out screen calls
`supabase.auth.signInWithIdToken({ provider: "apple", token })` with the
publishable key only. A user who is not already in `household_members` is
signed out immediately.

Open with Expo Go or an iOS Simulator dev build
(`eas build --profile development --platform ios --local` on a Mac).

## Reproduce TestFlight on a simulator

Use the release simulator profile for database and startup debugging:

```sh
cd apps/mobile
eas build --profile preview-simulator --platform ios
eas build:run --platform ios --latest
```

`preview-simulator` inherits TestFlight's `preview` environment and disables
mock data. It embeds the JavaScript bundle and needs no Metro server. The
`development` profile uses a fake household and cannot verify database access.
Running an iOS simulator requires a Mac, or EAS Simulator access enabled for
the project's Expo account.

Idempotency keys use `expo-crypto` because Hermes does not supply browser
Web Crypto. Tab icons use `expo-symbols`. Changes to these native dependencies
require a new native build; rebuilding JavaScript alone is insufficient.

## Session storage

The Supabase session lives in **AsyncStorage**. That matches a publishable-key
client: the token is not a secret, and SecureStore is reserved for a later
credential if we need one. The README previously mentioned SecureStore; the
client never used it for the session.

## Needs Apple Developer account (owner, not an agent)

- Team ID, bundle ID `ch.household.os`, ASC App ID → already in `eas.json`
- Sign in with Apple → `src/lib/auth-apple.ts` calls
  `supabase.auth.signInWithIdToken`. Link Apple to the two existing members
  before the first TestFlight tap (see `pnpm admin attach-apple`).
- APNs Auth Key → Expo push via `expo-notifications`

## Runtime versions

Pin `react` and `react-native` to the exact versions in
`expo/bundledNativeModules.json` (SDK 57: React 19.2.3, RN 0.86.3). RN 0.87
removes `react-native/rn-get-polyfills`, which Expo 57 Metro still loads during
`expo export` / the EAS “Bundle JavaScript” phase. `pnpm test` covers this pin.

## Boundaries

- Pure money and date rules stay in `src/domain` and `src/lib/ui/zurich-date`.
  Mobile imports those modules; `packages/domain` is still a placeholder.
- Money stays integer centimes, server-authoritative, no offline queue.
- Web (`pnpm build` / Vercel) is unchanged as a deployable Next.js app.
