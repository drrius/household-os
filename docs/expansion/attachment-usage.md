# Household attachment usage warning

Home now measures attachment storage instead of always showing an empty usage label. The authenticated `household_attachment_usage()` RPC sums Storage metadata only for the current household's UUID path segment and household-files bucket. Both partners see the same total; other households, buckets and nonmembers are excluded. It does not fetch file bytes or expose object names or global totals.

ADR 0020's 500 MB warning uses 500,000,000 integer bytes. SQL transports exact decimal strings and the UI uses BigInt, including above JavaScript's safe-integer range. Missing or malformed size metadata makes the total unavailable instead of silently undercounting. Home streams a distinct loading state; failures offer a refresh button. The warning does not itself disable uploads or authorize paid infrastructure.

## Verification

Full `pnpm verify` passed 413 tests across 62 files, types, lint, formatting and production build. Eighteen browser cases passed across Chromium, WebKit and mobile Safari, covering zero, below/at/above threshold, exact large totals, loading and recovery. The warning fits mobile without horizontal overflow. Database test 029 covers household/partner/outsider boundaries, uppercase legacy prefixes, other buckets, direct-write denial, exact sums and unknown metadata. Local database execution was attempted but requires the unavailable local Supabase stack; hosted database CI remains outstanding.

No production changes or live file uploads were performed. Codex review remains pending while the review service quota is exhausted.
