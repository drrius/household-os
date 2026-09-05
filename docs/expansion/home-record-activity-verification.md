# Home record activity

Migration `20260905005500_home_record_activity.sql` extends the existing activity
kind/type checks, retaining every prior allowed value. Seven AFTER row triggers
write the actual authenticated household member, immutable label snapshot, record
kind, and operation. Source changes fail atomically if activity cannot be written.
No client activity permissions change. Existing Home realtime invalidation and
90-day retention include the new records without separate infrastructure.

The Home read model renders the actor, action, record kind, and label, with safe
fallback copy for malformed snapshots. Database tests cover each table's member
and foreign-tenant behavior, actor spoofing, insert/edit, repeated no-op saves,
archive/restore, private trigger access, and injected activity failure rollback.
Choice commands can emit both parent and option changes when both are meaningful.

## Dependency gate

The branch's old connected schema does not include the current PR48 command
ownership and attachment foundation. Do not copy these dependencies into this
lane. Run the combined database suite after authorized integration. In particular,
`choose_household_decision_option` must have PR48's no-op predicates so repeating
an already-chosen option does not briefly unchoose/rechoose it and emit spurious
activity. Test026 retains that required replay assertion. Document fixtures create
real storage objects and register them when the pending-upload registry exists.

## Verification

- Focused Home read-model tests: 16 passed, covering all seven record kinds and
  four operations, safe fallback, and acceptance of the new kind.
- Full `pnpm verify`: passed, 60 test files / 373 tests and production build.
- Six Home collections/activity browser cases passed in Chromium, desktop WebKit,
  and mobile Safari. Mobile screenshot inspected: labels wrap inside the card,
  all four operations are visible, and no horizontal overflow or page errors.
- `pnpm db:test` attempted; the local stack refused connection on 127.0.0.1:54322.
  Database behavior remains a combined CI gate, including PR #48 migration 027.
- Read-only review corrected pgTAP expected VALUES queries to cursor-compatible
  SELECT queries. Tests also cover a late decision activity failure rolling back
  an option update and its earlier activity in the same command.
- No live household records were changed and no branch dependencies were copied.
