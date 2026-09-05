# Project lifecycle review follow-up

Archived projects and trips now reject detail changes in both their server action and the database. The edit route excludes archived plans. A separate restoration remains available, but a single UPDATE cannot combine restoration with a hidden detail or status change.

Project tasks retain their original parent. The UI has no task-move operation, and the database now rejects direct parent changes, including attempts to move work out of an archived plan. Existing task editing, completion and archive behavior under active parents is preserved.

`pnpm verify` passed with 383 tests and the production build. SQL039 covers direct archived edits, restoration plus hidden edits, immutable parent identity, partner restoration, continued ordinary editing and tenant isolation. Hosted database execution remains required. The hard-reload creation-identity follow-up is described below.

## Creation retry identity

New project, trip and task routes now establish a UUID in the creation URL before showing the form. Reloading and retrying the same URL keeps one identity. Opening the ordinary New route establishes a fresh operation; the editor remounts for that new identity. A reload after a successful but unacknowledged save opens the already-created plan or returns to its task checklist. No draft content is stored in browser storage.

The new server-page tests exercise that already-created recovery, and browser flows cover rejected saves, hard reloads, repeated submissions, deliberate new operations and the directly affected pristine/dirty editor refreshes. All 27 affected browser cases passed across desktop Chromium, desktop Safari and mobile Safari. Full local verification (started before the new minimal-local-check policy was picked up) passed with 391 tests/build. Subsequent work uses focused local checks and hosted full verification.

Evidence: `/tmp/project-creation-final-verify.log` and `/tmp/project-creation-e2e.log`. Hosted SQL039 and combined dependency verification remain required; this follow-up does not merge its parent dependencies.
