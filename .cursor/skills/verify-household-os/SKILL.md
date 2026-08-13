---
name: verify-household-os
description: Drive the Household OS web app the way a member does — launch a disposable Next.js instance, sign-in gates, Today/Plan/Groceries/Money/Home, and write flows — and capture proof. Use when proving a UI change, reproducing a product bug, or checking that a destination still works.
---

# Verify Household OS

Household OS is a private two-member web app (Next.js on `pnpm dev`, local Supabase). The user-facing surface is the browser. There is no product CLI.

Read `features/README.md` before driving. Use the matching feature file as the recipe. A proof that hits one convenient entry point is incomplete when the map lists others.

## Launch

Verification owns a dedicated Next.js process on `127.0.0.1:4173`. Never attach to the user's ordinary `pnpm dev` on `:3000`.

Preconditions:

- Node 22+, pnpm, and a running local Supabase (`pnpm db:start`).
- Repo-root `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `pnpm exec supabase status`.
- Port 4173 is free.

The helper sets `HOUSEHOLD_OS_VERIFY_DIST_DIR=.next-verify` so Next.js does not fight the user's `.next` lock. Do not unset that.

```bash
.cursor/skills/verify-household-os/scripts/control-household-os launch
.cursor/skills/verify-household-os/scripts/control-household-os doctor
```

Ready when `doctor` prints `ok` and `GET http://127.0.0.1:4173/sign-in` is HTTP 200 with title `Household OS`.

Teardown is `control-household-os cleanup`. It kills only the pid recorded at launch. It never deletes evidence.

Do not set `HOUSEHOLD_OS_E2E_FIXTURES=1`. That flag unlocks `/m6-fixture/` and `/m7-fixture/`, which are Playwright-only shells, not member paths.

## Doctor

Run before the first drive and again whenever the instance looks off:

```bash
.cursor/skills/verify-household-os/scripts/control-household-os doctor
```

Doctor is read-only. It checks: the recorded pid is alive, the instance is not on port 3000, `/sign-in` returns 200, and `GET /` is a redirect or 200. If it fails, cleanup and launch again. Do not keep driving a sick instance.

## Drive

Put the helper on `PATH` or invoke it with the repo-relative path above. Treat every command as literal.

```bash
control-household-os browser goto --path /sign-in
control-household-os browser click --role button --name "Sign in with passkey"
control-household-os browser fill --role textbox --name "Item" --value "Oat milk"
control-household-os browser press --key Escape
control-household-os browser url
control-household-os browser snapshot --aria --path sign-in-gate/after.aria.txt
control-household-os browser screenshot --path sign-in-gate/after.png
```

`--path` on `goto` is a URL path on the verification origin, or an absolute `http://127.0.0.1:4173/...` URL (needed for enrollment consume links). Snapshot and screenshot paths are stored under `/tmp/household-os-verify/artifacts/` unless they are already absolute.

Prefer ARIA roles and accessible names. Stable handles in this app:

| Handle | Role / name |
| --- | --- |
| Sign-in submit | `button` named `Sign in with passkey` |
| Primary destinations | `link` named `Today`, `Plan`, `Groceries`, `Money`, `Home` inside `navigation` named `Primary navigation` |
| Global create | `button` named `Add something` |
| Create choices | `link` named `Routine`, `Grocery item`, `Meal`, `Expense` |
| Grocery create | `link` named `Add item` on Groceries; heading `New grocery item`; textbox `Item`; button `Add to groceries` |
| Expense create | `link` named `Add expense` on Money; heading `New expense`; textboxes `Description` and `Amount in CHF`; button `Post expense` |
| Form abandon | `link` named `Cancel` |

Cookies persist in `/tmp/household-os-verify/run/browser-profile` for the life of the run. `cleanup` deletes that profile.

### Member session

Anonymous visitors only reach `/sign-in`, `/auth/error`, `/auth/consume`, and `/access-denied`. Product destinations require a household member cookie.

If the local household already exists, mint a one-time consume URL with the repo admin command. Pipe the local Supabase secret from `pnpm exec supabase status -o json` (`SECRET_KEY` or `SERVICE_ROLE_KEY`) on stdin — never put it in `.env.local`, a flag, or a file:

```bash
# prints one http://127.0.0.1:4173/auth/consume?token_hash=...&type=magiclink URL
printf '%s' "$LOCAL_SUPABASE_SECRET" | pnpm admin enroll-link \
  --project-url http://127.0.0.1:54321 \
  --app-origin http://127.0.0.1:4173 \
  --member-email <existing-member-email> \
  --secret-stdin
```

Then `browser goto --path <that-url>`. A valid consume lands on `/security` (heading `Security`). From there open `Today` via the primary nav, or `goto --path /`.

If no household exists yet, `pnpm admin bootstrap` is the real provisioning path (see the repo README). Do not invent a second household. Version one is one household, two members.

Passkey registration on `/security` needs a real authenticator. Headless Chromium cannot finish `Sign in with passkey` unless a passkey is already bound to this browser profile. Prefer a fresh consume link over clicking the passkey button.

## Evidence

Proof artifacts live in `/tmp/household-os-verify/artifacts/` and survive `cleanup`.

Standards:

- Drive the member path (nav, add sheet, forms, consume links). Do not call server actions, seed SQL, or `/m6-fixture/` / `/m7-fixture/` and call that product proof.
- Capture the action and the resulting state. A final screenshot alone is not enough.
- For a mutation, take a second read-only view (list, Today, Money ledger) after save.
- Record the feature ID and entry point in the artifact directory name.
- UI proof is an ARIA snapshot plus a screenshot that shows the `Household OS` title or the `Our Home` / `Our home` chrome.
- Side effects that matter: grocery rows, ledger events, routine titles. Do not assert derived balances by reading the database; read the Money heading and event list.

## Cleanup

```bash
.cursor/skills/verify-household-os/scripts/control-household-os cleanup
```

Kills the recorded pid only. Deletes `/tmp/household-os-verify/run/` (pid, browser profile). Leaves `/tmp/household-os-verify/artifacts/` in place.

Local Supabase is shared with the user's machine. This helper does not start or stop it. Do not `pnpm db:reset` as cleanup. Restore only rows this run created, and only when the feature file says to.

## Isolation

Two verification instances cannot share port 4173. `launch` refuses if a recorded pid is still alive.

The Next.js origin is isolated. The Postgres household is not. Concurrent authenticated drives mutate the same local household. If another verification run's `/tmp/household-os-verify/run/state.json` exists and its pid is alive, refuse to start a second authenticated drive. Unauthenticated gate checks on a dedicated port are safe.

Never drive a browser tab the user already has open.

## Helpers

`scripts/control-household-os` is executable. Commands are listed under Drive. `doctor` and `cleanup` take no flags. `launch` accepts `--port` only when 4173 is genuinely occupied by something other than the user's `:3000` app.
