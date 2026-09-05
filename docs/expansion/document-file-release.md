# Replaced document files

A successful document file replacement claims the new object and checks whether the old object is still referenced by any document (including archived ones), financial event, shopping session, routine completion, pet or member profile. Financial receipts remain attached to append-only history, including reversed and corrected events.

Only a file with no remaining reference becomes pending again. Its pending-cleanup age restarts at replacement, giving it the existing 24-hour grace period before either household member's next upload can reclaim it. The original uploader can also explicitly remove it through the existing pending-file cleanup command. Upload identity, uploader and content remain unchanged; replacement never overwrites bytes or performs immediate object deletion.

Replacement locks the old and new registry rows in path order before claiming, avoiding opposite-order locks during concurrent file swaps. Release reuses that lock and rechecks references. A new reference claims a pending file again; cleanup-owned files reject new claims. The two legacy profile photo fields now use that same lock when they reference household private paths. Unrelated legacy photo values retain their prior behavior. All changes are transactional: a failed document replacement rolls back both claims and release.

This migration depends on PR44's current attachment registry and claim helpers. Test023 exercises the reference, rollback, grace-period and authorization boundaries. Local database execution is unavailable and CI must pass before integration. Concurrent outcomes are tested in serialized order; a real parallel database race has not been executed locally. No production migration or file deletion was performed.

Verification: full `pnpm verify` passed with355 tests and a production build. Focused formatting and diff checks passed after the final ordered-lock review fix. Both local database attempts failed because PostgreSQL at127.0.0.1:54322 is unavailable; tests015/023/024 require CI. Independent review checked reference safety, rollback and lock ordering.
