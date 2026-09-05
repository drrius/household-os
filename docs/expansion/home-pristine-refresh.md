# Home editor refresh and attachments

Untouched Home editors now adopt partner values and their matching version. A local field change, selection, submission or selected file preserves the rendered record and choice labels. Reverting ordinary fields adopts the waiting server snapshot. New-record identity remains stable through refresh and failed submission.

Attachment upload/removal state explicitly notifies the editor, so a hidden file-path change is treated as an edit. Pending uploads retain their component and original version through refresh; successful uploads keep the new path and failed uploads retain their selected file. Empty selected files also count as an edit until cleared. Pristine attachment paths follow server updates.

Full398 tests, lint, type checks and production build pass. All27 browser cases pass across Chromium, desktop WebKit and mobile Safari, covering pristine fields, dirty drafts, reverting, selection-only edits/labels, new identity, validation retry, same-page reopening, file removal, pending upload and uploaded-path preservation. One upload request remains one request across refresh. Evidence: `/tmp/home-pristine-verify.log`, `/tmp/home-pristine-fixture-build.log`, `/tmp/home-pristine-e2e.log`.

The preceding archived-decision commit4063d64 has positive Codex review5550386931. Its hosted database run stops at the known missing attachment helper before SQL034; the local host attempt confirms PostgreSQL connection refusal. Neither result proves SQL034 and the dependency gate remains open.
