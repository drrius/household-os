# Routine implementation status

This is the routine branch checkpoint. The integration branch tracks the application-wide goal, PR matrix and remaining acceptance work. The former 339-test main result was a historical baseline, not verification of the routine expansion.

PR46 implements routine details, exceptions, editing, setup and maintenance controls. Its `5f9fe07` cohort passed 371 tests and the production build. SQL019 covers routine edit versions and lifecycle sequences; hosted execution still needs to be recorded. The new CodeRabbit follow-up sorts archived routines consistently and uses the precise 4 MiB attachment limit in user-facing messages.

CodeRabbit replaced Codex as reviewer at the user’s request. This follow-up removes the stale statement that the user is asleep while retaining authorization for this expansion. The actual two-session contention test requested in review remains outstanding work; the sequential SQL019 scenarios are not claimed as that proof.

The repository is public and hosted CI is available. Follow the current main policy: focused local tests, lint and type checks, then full verification in CI. Local PostgreSQL on port 54322 is unavailable. No production database changes were performed. Pending base integration and the final assembled-app audit remain separate gates.
