# ADR 0019: Operate version one at a hard CHF 0 cost

- Status: Accepted
- Date: 2026-08-09

## Context

Version one serves two people and must prove daily value before paid infrastructure is justified.

## Decision

The Next.js application is hosted on Vercel Hobby for personal, non-commercial use. The backend uses one Supabase Free project in Frankfurt. Automatic project pausing after low activity is acceptable.

Version one must be technically unable to create a hosting bill. Paid plans, metered overages, and add-ons are not enabled. If a free quota is exhausted, the affected service may restrict or pause the application.

Cloudflare is not part of the selected runtime.

## Consequences

The two-person workload fits comfortably within current free quotas, but the application has no paid availability guarantee. Commercial distribution or materially increased usage requires a new hosting decision.
