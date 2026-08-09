# ADR 0022: Authenticate the two members with Supabase passkeys

- Status: Accepted
- Date: 2026-08-09

## Context

The two household members need passwordless authentication without paid email delivery or a shared social-login provider. Supabase offers native WebAuthn passkeys, but currently labels the API experimental.

## Decision

Version one uses Supabase Auth passkeys. The project explicitly enables the experimental passkey API and pins the exact `@supabase/supabase-js` version. Authentication dependency upgrades are deliberate changes gated by authentication tests.

Passkeys bind to one stable production `*.vercel.app` hostname selected before enrollment. The hostname is not renamed after passkeys are registered, although the application's visible name may change.

An administrator script provisions the two confirmed users and generates one-time authentication links without sending email. Each link is transferred privately to the correct member and provides the session required to register the first passkey.

If a member loses all passkeys, a local administrator command generates another one-time enrollment link. The required Supabase administrator secret is stored in the owner's password manager and never exposed to the client.

Members can list, rename, add, and revoke their passkeys from a Security screen. A second authenticator is encouraged but not required.

## Consequences

Authentication remains passwordless and free without introducing another identity system. Version one accepts API churn risk and makes the stable production hostname and recovery command release prerequisites.
