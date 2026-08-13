# Sign-in gates

Sign-in gates keep anonymous visitors out of the household and tell a signed-in non-member that they have no membership. A member with a discoverable passkey signs in from `/sign-in`.

## Sub-features

- `gate-redirect` sends every product destination to `/sign-in` when there is no session.
- `gate-passkey` shows the passkey sign-in control and does not collect email.
- `gate-invalid-link` turns a bad or empty consume URL into `Sign-in link invalid`.
- `gate-denied` shows `No household membership` on `/access-denied`.

## How to get to it (user POV)

- Open `/`, `/plan`, `/groceries`, `/money`, `/home`, or `/security` while signed out.
- Open `/sign-in` directly.
- Open a broken enrollment or recovery link (`/auth/consume` without a valid `token_hash`).
- Land on `/access-denied` after signing in with an account that is not a household member.

## Driving it with control-household-os

Preconditions:

- Household OS is healthy at `http://127.0.0.1:4173`.
- The browser profile has no member session (fresh launch, or after cleanup).
- `control-household-os doctor` reports `ok` and `url=http://127.0.0.1:4173`.

- **Today redirect.** Open Today while signed out. Run `control-household-os browser goto --path /`. The URL ends with `/sign-in` and a heading named `Sign in` is visible.
- **Other destinations.** Repeat `goto` for `/plan`, `/groceries`, `/money`, `/home`, and `/security`. Each URL ends with `/sign-in`.
- **Passkey control.** Stay on `/sign-in`. Run `control-household-os browser snapshot --aria --path sign-in-gate/sign-in.aria.txt`. The snapshot contains heading `Sign in`, button `Sign in with passkey`, and the text `Use a discoverable passkey. No email is collected here.`
- **Invalid consume.** Open a consume URL with no token. Run `control-household-os browser goto --path /auth/consume`. The URL ends with `/auth/error`, the heading is `Sign-in link invalid`, and a link named `Back to sign in` points at `/sign-in`.
- **Return to sign in.** Choose `Back to sign in`. Run `control-household-os browser click --role link --name "Back to sign in"`. The heading `Sign in` is visible again.
- **Access denied chrome.** Open `/access-denied`. Run `control-household-os browser goto --path /access-denied`. The heading is `No household membership` and a button named `Sign out and return to sign in` is visible. This page is public; it does not prove a real denied membership unless the session is a signed-in non-member.
- **Proof.** Capture the sign-in screen. Run `control-household-os browser goto --path /sign-in`, `control-household-os browser snapshot --aria --path sign-in-gate/proof.aria.txt`, and `control-household-os browser screenshot --path sign-in-gate/proof.png`. Both artifacts identify Household OS and the `Sign in` heading.

## Gotchas

- Clicking `Sign in with passkey` in headless Chromium opens WebAuthn and usually fails. Visibility of the button is the proof; a failure alert is not a product bug unless a bound passkey exists in this profile.
- `/m6-fixture/` and `/m7-fixture/` skip auth when `HOUSEHOLD_OS_E2E_FIXTURES=1`. That is not this feature. Leave the flag unset.
- A leftover member cookie from a previous drive makes `goto --path /` land on Today (`Hoi …`) instead of Sign in. Cleanup and launch again.
- `/access-denied` is reachable without a session. Do not report `gate-denied` as a real membership rejection unless you first consumed a link for a user with no `household_members` row.
- A consume redirect may change the host from `127.0.0.1` to `localhost` while keeping port `4173`. Assert the path (`/auth/error`, `/sign-in`), not the hostname.
