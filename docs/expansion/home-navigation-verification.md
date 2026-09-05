# Home collection navigation

Home now exposes Inventory, Commitments, Decisions, Documents and Contacts directly below its header. The compact grid uses the container width, comfortable whole-card links, keyboard focus outlines and short descriptions. Each destination is implemented in this PR; detail and relationship workflows retain their existing tests.

Full verification passed with 361 tests and a production build before the final compact layout adjustment. The final layout passed three browser cases across Chromium, WebKit and mobile Safari, checking all five destinations, touch target bounds, overflow and keyboard focus. The phone viewport screenshot was inspected. The activity follow-up will run the full verification suite again against the combined branch.

These checks verify the normal Home screen and real destination URLs using fixtures. Authenticated cross-feature navigation must also be checked after the required schema and route dependencies are integrated. No production changes were made.
