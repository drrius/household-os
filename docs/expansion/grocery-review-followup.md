# Grocery review follow-up

Findings 3939664846 and 3939664848 are addressed. Both category selectors load the fallback identity and display its configured name exactly once. Unassigned, explicitly fallback-linked and archived-category items resolve to that same fallback choice; an ordinary category named Other remains distinct. Posting or dismissing a draft now invalidates the groceries surface so shopping history can refresh its linked status and destination.

`pnpm verify` passed 388 tests in 65 files and the production build. All 12 production browser cases passed across Chromium, WebKit and mobile Safari, including the renamed selector and existing partner-refresh protections. Pure category identity and realtime invalidation checks passed. No database change is required.

Evidence: `/tmp/grocery-review-verify.log`, `/tmp/grocery-review-fixture-build.log`, `/tmp/grocery-review-e2e.log`.
