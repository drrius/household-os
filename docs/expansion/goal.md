# Household OS expansion goal

Status: active. User scope clarification supersedes the narrower wording of the runtime goal.

## Objective

Turn Household OS into a complete, functional, polished operating system for this two-person household. Implement everything agreed in the conversation and actively discover and implement other worthwhile missing features or functionality anywhere in the app. The completeness audit is explicitly not limited to the previously discussed workflows.

The user authorized autonomous product decisions, broad UI redesign, branches, commits, pushes, appropriately divided pull requests, replies to CodeRabbit comments, and repeated CodeRabbit review. Proceed within this authorized expansion without preflight questions. No time deadline or token budget was specified.

## Required starting scope

- Complete groceries, shopping checkout and finance handoff, routines and occurrence exceptions, meal planning and consumption, financial inspection/correction/refunds, concise creation forms, useful starter setup, area maintenance, and consistent feedback and navigation context.
- Deliver trips/vacations, flights/hotels/bookings/itinerary/checklists, projects, shared calendar, private shared-iCloud synchronization, home inventory and maintenance, recurring commitments and renewals, decisions and wishlists, and their useful relationships with tasks and paid expenses.
- Make the app feel excellent on phones and desktop, with clear hierarchy, comfortable touch targets, context-preserving interactions, tasteful responsive motion, reduced-motion support, and robust accessibility.
- Audit the entire application for additional missing product capabilities, dead ends, lifecycle actions, integration gaps, reliability issues, accessibility failures, setup/deployment gaps, and useful household functionality. Implement worthwhile additions beyond the starting scope, recording each decision and its rationale. Avoid filler features or complexity that creates more household administration than it removes.

## Boundaries

Preserve two equal members, one private household, CHF integer-centime accounting, append-only authoritative financial history, separation of work and financial obligations, tenant RLS, public-endpoint-grade mutation authorization, passkeys, online-only operation, and the CHF 0 operating-cost cap. The user has authorized new product scope, including calendar integration and household documents; record superseding ADRs. Do not infer permission to charge money, execute payments, connect banks, publish private information, add paid services, merge PRs, deploy production changes, reset databases containing user data, or weaken security. Existing explicit exclusions remain unless the user's agreed additions require a documented narrow exception.

## Verification and delivery

- Work in isolated branches/worktrees with explicit path ownership and dependency ordering.
- Run focused checks during development and pnpm verify per integrated PR. Database changes require pnpm db:test and RLS/invariant coverage. Financial changes require example and property tests.
- Settle affected designs, then exercise complete Playwright workflows and mobile/desktop browser checks. Validate empty/populated/error/pending/concurrent states where relevant.
- Open a PR for every completed unit. Respond to CodeRabbit review comments. Fix and push substantiated bugs; explain disagreements with evidence. Request rereview until explicit positive CodeRabbit review is received. Never equate missing feedback, rate limits, or failed review jobs with approval.
- Record scope, acceptance evidence, PR URLs, review status, decisions, and remaining gaps in docs/expansion. Keep implementation and completeness audits current through context compaction and goal continuations.
- Implement and test external integrations against controlled fixtures when credentials are unavailable. Distinguish implemented capability from live-account verification. Do not invent credentials or claim unperformed checks.

## Completion

Complete only when the agreed scope and all worthwhile gaps identified in a fresh app-wide completeness audit are implemented and verified, every change has appropriate open PR coverage, and CodeRabbit has positively reviewed all PRs. Continue useful work on other areas while external dependencies are blocked. Report unavoidable external setup or review blockers honestly. The standard is no remaining known worthwhile implementable gap across the whole app, not the impossible claim that no conceivable future feature exists.
