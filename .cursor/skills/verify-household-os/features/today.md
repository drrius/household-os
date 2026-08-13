# Today

Today is the signed-in home. It shows overdue work, today's routines, meals, shopping state, and money that needs confirmation, plus the primary nav and the add sheet.

## Sub-features

- `today-open` opens Today after a member session exists.
- `today-nav` reaches Plan, Groceries, Money, and Home from the primary nav and returns.
- `today-add-sheet` opens and closes the global create sheet without creating anything.

## How to get to it (user POV)

- Finish a valid enrollment or recovery consume link (lands on Security), then choose `Today`.
- Choose the `Today` item in primary navigation from any product destination.
- Open `/` while signed in as a member.

## Driving it with control-household-os

Preconditions:

- Household OS is healthy at `http://127.0.0.1:4173`.
- A member session is in the verification browser profile (consume an `enroll-link` minted for `http://127.0.0.1:4173`).
- `control-household-os doctor` reports `ok`.

- **Open Today.** After consume, choose Today. Run `control-household-os browser goto --path /`. The URL is `http://127.0.0.1:4173/` (no `/sign-in`). A level-1 heading matching `Hoi ` is visible. `navigation` named `Primary navigation` is present.
- **Nav to Plan.** Choose `Plan`. Run `control-household-os browser click --role link --name "Plan"`. The heading is `This week`.
- **Nav to Groceries.** Choose `Groceries`. Run `control-household-os browser click --role link --name "Groceries"`. The heading is `Groceries`.
- **Nav to Money.** Choose `Money`. Run `control-household-os browser click --role link --name "Money"`. The heading is `Money`.
- **Nav to Home.** Choose `Home`. Run `control-household-os browser click --role link --name "Home"`. The heading is `Our home`.
- **Return to Today.** Choose `Today`. Run `control-household-os browser click --role link --name "Today"`. The `Hoi ` heading returns.
- **Open add sheet.** Choose `Add something`. Run `control-household-os browser click --role button --name "Add something"`. A dialog heading `Add something` appears with links `Routine`, `Grocery item`, `Meal`, and `Expense`.
- **Close add sheet.** Choose `Cancel`. Run `control-household-os browser click --role button --name "Cancel"`. The dialog closes and Today remains visible.
- **Proof.** Capture Today. Run `control-household-os browser snapshot --aria --path today/proof.aria.txt` and `control-household-os browser screenshot --path today/proof.png`. The artifacts show the `Hoi ` heading, primary navigation, and Household OS chrome.

## Gotchas

- The Today title is `Hoi <display name>`, not a fixed string. Assert the `Hoi ` prefix, not a hardcoded name.
- Empty households still render Today. Sections may say `Nothing overdue`, `No routines today`, `The list is empty`, or `No drafts waiting`. Those empty states are success, not missing UI.
- `/m6-fixture/today` is a static shell used by Playwright. It is not Today.
- Opening the add sheet on a `/new` form route hides the floating trigger on small viewports. Drive this sub-feature from Today, not from a form.
