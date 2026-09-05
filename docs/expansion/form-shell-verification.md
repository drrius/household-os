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
