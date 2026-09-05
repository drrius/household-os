# Grocery CodeRabbit follow-up

The cancellation lifecycle constraint is now added without an initial validation scan, then validated in a separate migration transaction. Existing lifecycle rules are unchanged.

The fallback follow-up creates a persistent, active Other category for a household whose renamed pre-release default could not be identified. Existing category identities, item assignments and already-identified fallbacks are preserved. The new database regression reconstructs a household with a renamed default, executes the same restricted repair command used by the migration, checks repeatability, and verifies tenant isolation.

Two reported problems were not reproduced and were explained in review:

- Cancelled sessions cannot acquire purchased links through the supported commands. Only finish stamps those links, and cancellation rejects a finished session under the same session lock. The existing inner purchased-link filter excludes cancelled sessions.
- All three production checkbox callers echo values on rejection and redirect on success. No mounted production checkbox action discards its submitted values. Absence of a checkbox from echoed values must continue to mean intentionally unchecked.

`pnpm verify` passed (390 tests and production build). No product UI changed in this follow-up. SQL038 exercises the data migration repair command and is awaiting hosted `pnpm db:test`; no local database pass is claimed. The direct branch CI workflow can validate this head even if the PR target has integration conflicts. Combined-product validation remains a separate gate.

The first hosted run exposed the CLI test container’s missing migration-file mount and an older shopping fixture with a pre-attachment receipt path. The repair now has a private invoker function, revoked from application roles, so the migration and SQL038 execute identical logic without file inclusion. The existing checkout fixture now uses a valid household receipt path. The failed run is retained as evidence; a fresh hosted pass is required.
