# Add a grocery item

Add a grocery item lets a member put one named item on the shared list from Groceries or from the add sheet, abandon a draft, and see the saved name on the list.

## Sub-features

- `grocery-open-list` opens the Groceries destination.
- `grocery-open-form` opens the create form from each entry point.
- `grocery-save` persists a unique item name.
- `grocery-cancel` discards an unfinished form.
- `grocery-list-confirms` shows the saved name after returning to the list.

## How to get to it (user POV)

- Choose `Groceries` in primary navigation, then `Add item`.
- Choose `Add something`, then `Grocery item`.
- Open `/groceries/new` while signed in.

## Driving it with control-household-os

Preconditions:

- Household OS is healthy at `http://127.0.0.1:4173`.
- A member session is in the verification browser profile.
- No current grocery item is named `Verify oat milk`.
- `control-household-os doctor` reports `ok`.

- **List entry.** Open Groceries. Run `control-household-os browser goto --path /groceries`. The heading is `Groceries` and a link named `Add item` is visible.
- **Open form from list.** Choose `Add item`. Run `control-household-os browser click --role link --name "Add item"`. The heading is `New grocery item` and a textbox named `Item` is visible.
- **Cancel draft.** Type a throwaway name and leave. Run `control-household-os browser fill --role textbox --name "Item" --value "Discard me"` and `control-household-os browser click --role link --name "Cancel"`. The heading `Groceries` returns and the list does not contain `Discard me`.
- **Sheet entry.** Open the add sheet and choose Grocery item. Run `control-household-os browser click --role button --name "Add something"` and `control-household-os browser click --role link --name "Grocery item"`. The heading is `New grocery item` again.
- **Save item.** Enter the proof name and submit. Run `control-household-os browser fill --role textbox --name "Item" --value "Verify oat milk"` and `control-household-os browser click --role button --name "Add to groceries"`. The app returns to Groceries.
- **Confirm persistence.** Read the list. Run `control-household-os browser goto --path /groceries`, `control-household-os browser snapshot --aria --path add-grocery/list.aria.txt`, and `control-household-os browser screenshot --path add-grocery/list.png`. The artifacts contain `Verify oat milk` and heading `Groceries`.
- **Cleanup data.** Leave `Verify oat milk` on the list only if the household is a disposable local database you created for this run. On the shared developer household, remove the item the same way a member would (do not SQL-delete) or record that the row was left in place.

## Gotchas

- Quantity and unit are optional. A name-only item is enough proof.
- Duplicate suggestions may appear if a similar name already exists. Use a unique proof name.
- Submit is `Add to groceries`, not `Save`.
- `/m7-fixture/` grocery forms are not this feature.
- Creating an item writes to the shared local household. Do not run this recipe in parallel with another authenticated drive.
