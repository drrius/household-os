# Home

Home is the household settings destination. It names the household and both members, lists routines, and links to Security for passkeys.

## Sub-features

- `home-open` opens Home and shows the household name and member list.
- `home-security` opens the Security passkey surface from Home.
- `home-new-routine` opens the new-routine form from Home or the add sheet.

## How to get to it (user POV)

- Choose `Home` in primary navigation.
- Open `/home` while signed in.
- From Home, follow the passkeys / Security link.
- Choose `Add something`, then `Routine`, or open `/home/routines/new`.

## Driving it with control-household-os

Preconditions:

- Household OS is healthy at `http://127.0.0.1:4173`.
- A member session is in the verification browser profile.
- `control-household-os doctor` reports `ok`.

- **Open Home.** Choose Home. Run `control-household-os browser goto --path /home`. The heading is `Our home`. A heading `Household` and a list named `Household members` are visible. The list has two equal members, one marked `You · Equal member`.
- **Open Security.** Follow the passkeys link. Run `control-household-os browser click --role link --name "passkeys"`. The heading is `Security` and the URL ends with `/security`.
- **Return to Home.** Choose `Home`. Run `control-household-os browser click --role link --name "Home"`. The `Our home` heading returns.
- **Open new routine from sheet.** Choose `Add something`, then `Routine`. Run `control-household-os browser click --role button --name "Add something"` and `control-household-os browser click --role link --name "Routine"`. The heading is `New routine`, or the page tells you to create a routine area in Home setup first.
- **Cancel routine form.** If the form rendered, choose `Cancel`. Run `control-household-os browser click --role link --name "Cancel"`. Home returns.
- **Proof.** Capture Home. Run `control-household-os browser goto --path /home`, `control-household-os browser snapshot --aria --path home/proof.aria.txt`, and `control-household-os browser screenshot --path home/proof.png`. The artifacts show `Our home`, two members, and Household OS chrome.

## Gotchas

- Home's title is `Our home`. The desktop sidebar brand is `Our Home`. Both are valid identity marks.
- Creating a routine requires at least one area. If the form is blocked, report `home-new-routine` as blocked on Home setup — do not invent an area through SQL.
- Do not register a passkey in headless Chromium unless the run has a virtual authenticator. Opening Security and reading the heading is enough for `home-security`.
- `/m6-fixture/home` is a static shell. It is not Home.
