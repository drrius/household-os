# Shared form and shell reliability

`settleFormAction` now passes framework interrupts to the installed Next.js `unstable_rethrow` API before converting application errors to form rejection state. Four tests reproduced the old behavior: redirects became a visible `NEXT_REDIRECT` message, not-found signals became ordinary errors, and wrapped framework causes were swallowed. The updated tests preserve the original signal objects, while ordinary errors still retain field values and increment the rejection counter.

`FormPage` accepts an optional `backLabel`; the default remains `Cancel`. Detail-screen callers can supply appropriate navigation copy after integration. No downstream product callers changed in this lane.

## Skip-link investigation

The existing AppShell CSS is unchanged. At rest, both desktop Chromium and iPhone 15 WebKit compute `translate: 0px calc(-100% - 8px)`. The link’s viewport rectangle has top `-40` and bottom `0`, and it is unfocused. Keyboard Tab exposes it; Enter moves focus to `#main-content` and hides it again.

The reported image is reproducible in WebKit: scroll to 650px and take a full-page screenshot. The image paints the fixed translated link partway down the page even though its actual viewport rectangle remains entirely above the viewport. A viewport screenshot at the same scroll position correctly contains no skip link. This is screenshot behavior, not a visible page or focus defect. Do not change valid shell CSS to accommodate the full-page capture.

## Browser verification

Browser plugin not available; used the repository’s Playwright workflow with the existing browsers. Target: `http://127.0.0.1:3035/m7-fixture/form-shell`, desktop Chromium 1280×720 and iPhone 15 WebKit 393×852. The 10 settled cases pass. The flows cover default/custom back labels, real Server Action redirect and not-found boundaries, ordinary error focus/value retention, skip-link keyboard access, hidden geometry before and after scrolling, no horizontal overflow, correct page identity, one main landmark, no framework overlay and no console/page errors in the shell flow. The server was stopped after verification.

Screenshot evidence is intentionally outside the repository:

- `/tmp/form-shell-before-mobile-scrolled.png`: matching full-page WebKit artifact.
- `/tmp/form-shell-chromium-focused.png`: visible focused keyboard skip link.
- `/tmp/form-shell-mobile-safari-initial.png`: hidden unfocused link in initial viewport.
- `/tmp/form-shell-mobile-safari-focused.png`: visible focused link on mobile.
- `/tmp/form-shell-mobile-safari-scrolled-viewport.png`: actual scrolled viewport without the artifact.

`pnpm verify` passes formatting, lint, type checks, 46 test files / 270 tests and the production build. Unit tests use real Next.js navigation signal producers. Browser authentication is a fixed fixture redirect to a sign-in destination, with no live identity mutation. No database, migration, service-worker, package or generated-type change is required. Real sign-out/enrollment behavior belongs to its separate lane.

## Substantial forms and field labels

Expense and routine forms now opt into unsaved-change protection. Cancel and same-tab internal links ask before discarding actual changed values. Reverted/pristine forms leave directly; small action forms remain opt-out by default. Failed saves retain the original baseline across recovery remounts, while a successful returned save resets it. Pending disabled fields do not create false changes. Framework metadata is excluded, while selected values and attachment paths count as input. Refreshed untouched text defaults do not prompt; edited text retains its original baseline.

This protects document unload where the browser supports `beforeunload`. App Router browser Back/Forward and programmatic navigation are not intercepted; no history patching or persistent/offline draft storage is introduced. Browser unload confirmation is subject to browser activation and mobile lifecycle restrictions.

The routine regression exposed missing label/control association during React Server Component hydration. `FormField` now normalizes its single child through React's public `Children.toArray` API before cloning the control with its ID and validation attributes. Both server and client resolve the same child; the actual routine title remains accessible by its label, without hydration warnings.

Final verification: `pnpm verify` passed 273 tests in 47 files, formatting, lint, type checks and production build. A fixture-enabled production build passed 54 Playwright cases across Chromium, WebKit and mobile Safari, including the existing full routine scheduling and exact-split expense flows. The pending-state case holds its network request until assertions finish, avoiding a short timer race. A development-server run had two timing/reload failures; the trace showed a full development reload resetting the error fixture. The final production run passed the same recovery assertions. Ordinary production builds still exclude fixtures.

Evidence: `/tmp/discard-final-verify.log`, `/tmp/discard-production-e2e.log` and `/tmp/discard-fixture-build.log`. Codex's review quota remains exhausted; no new positive review is claimed.

## Codex review follow-up

Findings 3939657986 and 3939657987 are addressed. Protected form fields are disabled while their submitted request is pending, so a successful response cannot silently mark newer, unsubmitted edits saved. Calendar selection dispatches an input event before changing its controlled value, retaining the original comparison baseline; a calendar already open also refuses selections while its field is disabled. Calendar-only edits prompt, and restoring the original date leaves without a prompt.

Verification: full `pnpm verify` passed all 273 tests and build. A fixture-enabled production build passed all 60 browser cases across Chromium, WebKit and mobile Safari, including both expense and routine calendar-only edit/revert regressions and the held-request disabled-controls assertions. Evidence: `/tmp/discard-review-fixes-verify.log`, `/tmp/discard-review-fixture-build.log`, `/tmp/discard-review-e2e.log`. Codex review is available again; the fixed head requires rereview.
