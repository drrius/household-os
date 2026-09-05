# Routine implementation status

This is the routine branch checkpoint. The integration branch tracks the application-wide goal, PR matrix and remaining acceptance work. The former 339-test main result was a historical baseline, not verification of the routine expansion.

PR46 implements routine details, exceptions, editing, setup and maintenance controls. Its `5f9fe07` cohort passed 371 tests and the production build. SQL019 covers routine edit versions and lifecycle sequences; hosted execution still needs to be recorded. Archived routines are sorted by title and id.

This branch now includes current main: private attachments with claim/cleanup, meals, inbox paging, and device push. Completion photos use the landed attachment lifecycle instead of the earlier isolated copy.

CodeRabbit replaced Codex as reviewer at the user’s request. Sequential SQL019 scenarios are not a two-session contention proof; the pgTAP suite runs in one transaction and cannot open a second PostgreSQL session.

The repository is public and hosted CI is available. Follow the current main policy: focused local tests, lint and type checks, then full verification in CI. Local PostgreSQL on port 54322 is unavailable. No production database changes were performed. The final assembled-app audit remains a separate gate.
