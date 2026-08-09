# ADR 0001: Build for one two-person household first

- Status: Accepted
- Date: 2026-08-09

## Context

The first users are Darius and his girlfriend. Designing onboarding, roles, and administration for hypothetical households would add decisions that cannot yet be validated through real use.

## Decision

Version one will support one private household with two separately identified members. Productization for other households is deferred until sustained use demonstrates that the system is valuable.

The implementation should avoid needless assumptions that make later generalization impossible, but future multi-household adoption is not a version-one acceptance criterion.

## Consequences

Onboarding can be minimal, both members can be treated as household administrators, and product decisions can be judged against daily use. Public registration, household discovery, complex roles, subscriptions, and generalized onboarding remain out of scope.
