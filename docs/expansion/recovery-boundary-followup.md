# Attachment and push recovery follow-up

This follow-up starts from main after the attachment and push PRs were merged. It addresses their remaining review findings without reopening the original feature branches.

- Failed attachment removal retains the existing path, reports actionable recovery through the browser's constraint validation, and clears that constraint once removal succeeds. The error formatter preserves the existing upload and removal fallback messages.
- Push registration, test enqueue and test status actions rethrow Next.js control-flow exceptions, allowing expired sessions and revoked membership to navigate to sign-in or access denied. Operational failures still return a safe retry message.
- The upload release guide now specifies a dry-run review of all pending migrations and database deployment before the Edge Function. Neither production command was run.
- ADR 0028 explicitly identifies Europe/Zurich for its September 5 date. Its original commit, `8bef32c`, was authored at 00:53:14 on September 5 in that time zone; the UTC date was still September 4.

Focused verification: 18 action/service tests passed, including actual Next.js redirects for both destinations across all three actions. Targeted lint and TypeScript passed. The single new attachment-removal browser case passed in Chromium, exercising rejection, preserved path, actionable validation and successful retry. No full local test suite or production build was run. Hosted CI provides the broader checks and browser profiles.
