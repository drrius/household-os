# Grocery review follow-up

Findings 3939664846 and 3939664848 are addressed. Both category selectors load the fallback identity and display its configured name exactly once. Unassigned, explicitly fallback-linked and archived-category items resolve to that same fallback choice; an ordinary category named Other remains distinct. Posting or dismissing a draft now invalidates the groceries surface so shopping history can refresh its linked status and destination.

`pnpm verify` passed 388 tests in 65 files and the production build. All 12 production browser cases passed across Chromium, WebKit and mobile Safari, including the renamed selector and existing partner-refresh protections. Pure category identity and realtime invalidation checks passed. No database change is required.

Evidence: `/tmp/grocery-review-verify.log`, `/tmp/grocery-review-fixture-build.log`, `/tmp/grocery-review-e2e.log`.

## Archived fallback identity

Finding3939708831 is addressed without restoring or rewriting archived data. Form, list and checkout category reads retain the stable fallback row even when archived, alongside active selectable categories. Unassigned items continue using its identity and configured order/name. If an ordinary active category has the same name, the fallback receives an unassigned suffix so the two choices and sections remain distinguishable. Both explicit fallback links and null category values stay in the fallback bucket.

Full verification passed 390 tests/build. All 15 production browser cases passed, including an archived fallback with an active namesake and selection of the ordinary category. Domain tests also cover grouping and explicit/null identities. Evidence: `/tmp/grocery-archived-fallback-verify.log`, `/tmp/grocery-archived-fallback-fixture-build.log`, `/tmp/grocery-archived-fallback-e2e.log`.
