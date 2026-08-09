# ADR 0004: Use a phone-first web client with restrained reminders

- Status: Accepted
- Date: 2026-08-09

## Context

Routine completion, grocery updates, and expense entry commonly happen away from a desk. Reminders are useful, but excessive household notifications can feel like one member is supervising the other.

## Decision

Version one will be an installable Next.js web application optimized for phones while remaining useful on desktop and a shared tablet.

The notification model will provide configurable personal reminders and one calm household digest.

## Consequences

Core actions must require little typing and work well on a small screen. Native applications and aggressive overdue-notification behavior are not required for version one.
