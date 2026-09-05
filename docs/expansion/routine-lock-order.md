# Routine edit and occurrence locking

Finding 3939660095 is addressed. Ordinary routine edits now acquire the current occurrence before the routine, followed by preview/linked preparation rows. Previously only linked preparation received an occurrence prelock, allowing ordinary closure and schedule edits to deadlock in opposite orders.

The routine and subsequent occurrence locks use NOWAIT. This matters when closure replaces the current row while the initial query waits, or a background window rebuild already owns the routine. The edit returns a retryable contention error instead of waiting while holding a conflicting earlier lock. No mutation or edit receipt commits on that error. The server translates it to “This routine is being updated. Wait a moment and try saving again.” A version conflict still requires reopening the changed record.

`pnpm verify` passed 371 tests in 62 files and the production build. The command regression verifies that retry preserves the same request and idempotency key. Database test019 additionally exercises ordinary completion-based recurrence through rescheduling, assignment rebuild, closure and subsequent window edits while preserving history and recurrence anchors. Local `pnpm db:test` was attempted but PostgreSQL refused connection. Actual two-session contention and the expanded SQL assertions have not been executed locally; hosted SQL checks and review are still required. No browser surface changed beyond the recoverable error message.

Evidence: `/tmp/routine-lock-review-verify.log`, `/tmp/routine-lock-review-db.log`.

Codex finding3939745524 corrected the new SQL fixture to use the supported `assigned` policy. The earlier `fixed` value would have failed validation before reaching the intended rebuild. Production code is unchanged by this correction; database execution remains blocked by unavailable local PostgreSQL and the Home base conflicts.
