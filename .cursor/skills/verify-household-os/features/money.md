# Money

Money shows who owes whom in CHF, lists drafts that need confirmation, and records an append-only event history. A member can post an immediate expense with a 50/50 or exact split.

## Sub-features

- `money-open` opens the Money destination and its balance hero.
- `money-open-form` opens the immediate expense form from Money and from the add sheet.
- `money-post` posts a small unique expense.
- `money-ledger-confirms` shows the new event in the ledger after save.

## How to get to it (user POV)

- Choose `Money` in primary navigation.
- Choose `Add expense` on Money.
- Choose `Add something`, then `Expense`.
- Open `/money/expenses/new` while signed in.

## Driving it with control-household-os

Preconditions:

- Household OS is healthy at `http://127.0.0.1:4173`.
- A member session is in the verification browser profile.
- No ledger description is `Verify coffee`.
- `control-household-os doctor` reports `ok`.

- **Open Money.** Choose Money. Run `control-household-os browser goto --path /money`. The heading is `Money`. A heading `Settled up`, `<name> owes you`, or `You owe <name>` is visible. A link named `Add expense` is visible.
- **Open form from Money.** Choose `Add expense`. Run `control-household-os browser click --role link --name "Add expense"`. The heading is `New expense`.
- **Sheet entry.** From Money, choose `Add something` then `Expense`. Run `control-household-os browser goto --path /money`, `control-household-os browser click --role button --name "Add something"`, and `control-household-os browser click --role link --name "Expense"`. The heading is `New expense`.
- **Fill expense.** Enter a unique description and a 2-franc amount. Run `control-household-os browser fill --role textbox --name "Description" --value "Verify coffee"` and `control-household-os browser fill --role textbox --name "Amount in CHF" --value "2.00"`. Leave Allocation on the default 50/50.
- **Post expense.** Choose `Post expense`. Run `control-household-os browser click --role button --name "Post expense"`. The app returns to Money.
- **Confirm ledger.** Read Money again. Run `control-household-os browser goto --path /money`, `control-household-os browser snapshot --aria --path money/ledger.aria.txt`, and `control-household-os browser screenshot --path money/ledger.png`. The artifacts contain `Verify coffee` and a CHF amount. The balance hero is still one of the three kinds above.
- **Cleanup data.** Financial history is append-only. Do not delete the event. If this household is shared developer data, prefer a reversal through the product (not SQL) or record that the proof event remains.

## Gotchas

- Amounts are CHF with two decimals in the form. The UI may render `CHF 2.00` or a similar formatted string. Assert the description and that a two-franc amount is visible, not a raw centime integer.
- Do not compute the new balance yourself from the database. The hero text is the user-visible proof.
- `Set opening balance` appears when none exists. That path is adjacent, not this feature.
- `/m7-fixture/expense` is a form shell. It does not post a ledger event.
- Posting writes to the shared local household. Refuse a second parallel authenticated drive.
