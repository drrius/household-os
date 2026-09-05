# Project lifecycle review follow-up

Archived projects and trips now reject detail changes in both their server action and the database. The edit route excludes archived plans. A separate restoration remains available, but a single UPDATE cannot combine restoration with a hidden detail or status change.

Project tasks retain their original parent. The UI has no task-move operation, and the database now rejects direct parent changes, including attempts to move work out of an archived plan. Existing task editing, completion and archive behavior under active parents is preserved.

`pnpm verify` passed with 383 tests and the production build. SQL039 covers direct archived edits, restoration plus hidden edits, immutable parent identity, partner restoration, continued ordinary editing and tenant isolation. Hosted database execution remains required. The broader hard-reload creation-identity findings are separate outstanding work on this PR.
