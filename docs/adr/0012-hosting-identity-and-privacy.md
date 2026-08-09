# ADR 0012: Host privately in the EU

- Status: Accepted
- Date: 2026-08-09

## Context

Two phones need synchronized access without requiring home infrastructure. Household activity and financial information are sensitive, and version one has no need for public acquisition flows.

## Decision

Version one uses a hosted backend in an EU region. Public registration is disabled and only the two provisioned household members may authenticate through Supabase passkeys.

The client is online-only for version one. Web push and an in-app inbox deliver household notifications. Each member controls their own digest time and may disable it.

Household content is excluded from analytics and session replay. Minimal technical error reporting requires explicit opt-in.

## Consequences

The product avoids home-server operations and can synchronize promptly across devices. Authentication, authorization, storage, notification delivery, and logs must all prevent household content from leaking outside its membership.
