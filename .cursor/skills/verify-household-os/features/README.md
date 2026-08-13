# Household OS verification map

This directory is the maintained source for verifying the user-facing behavior of Household OS. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch Household OS at `http://127.0.0.1:4173` with `control-household-os launch`.
- Run `control-household-os doctor` and require `ok`, `url=http://127.0.0.1:4173`, and a pid that is not the user's `:3000` process.
- Local Supabase is already running. Do not reset it.
- Never drive an instance that was not started by this verification run.
- Never set `HOUSEHOLD_OS_E2E_FIXTURES`.
- Product destinations (`/`, `/plan`, `/groceries`, `/money`, `/home`, `/security`) need a member session. Mint one with `pnpm admin enroll-link` against `--app-origin http://127.0.0.1:4173` and `browser goto` the printed consume URL. Gate-only features do not need that session.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Run browser actions through `control-household-os browser`.
- Restore only data this run created. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with Household OS identity visible (`Household OS` document title, or `Our Home` / `Our home` chrome).
- Mutation proof includes a read-only second view of the stored value (list, Today, or Money).
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-household-os` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Sign-in gates](./sign-in-gate.md) covers anonymous redirect, the passkey button, an invalid consume link, and the membership-denied page.
- [Today](./today.md) covers the signed-in home destination, primary nav, and the add sheet.
- [Add a grocery item](./add-grocery.md) covers creating an item from Groceries and from the add sheet, cancellation, and persistence.
- [Money](./money.md) covers the balance hero, posting an immediate expense, and reading it back from the ledger.
- [Home](./home.md) covers household members, routine entry, and the Security passkey surface.
