# Search review follow-up

Findings 3939661545, 3939661548, 3939661549 and 3939661550 are addressed.

Search request parsing, minimum-length checks and browser input constraints count Unicode code points. Two-character eligibility and the 120-character limit now match PostgreSQL. The browser pattern accepts 120 supplementary Unicode characters and rejects 121 without truncating valid input.

Active decision option titles and notes feed one parent-decision result; the archive filter includes archived options without crossing tenant boundaries or duplicating parent results. Linked documents inherit archive/finished state from their project, booking, inventory or commitment; default search omits those documents, while history remains discoverable with the archive filter.

The search route now has its own refresh surface. Every source and joined label table invalidates it, including saved meals, options, completion notes, areas, pets and expense categories. The CLI-generated publication migration adds missing realtime sources. All payloads remain household-scoped and existing RLS still applies.

Verification: full `pnpm verify` passed 407 tests in 61 files and the production build. All 15 production browser cases passed across Chromium, WebKit and mobile Safari. The first run exposed test selectors matching Next.js's route announcer; scoping assertions to product alerts resolved that test issue. Added SQL coverage for parent lifecycle, option search, archive filtering, tenant isolation and publication membership. Local `pnpm db:test` was attempted but PostgreSQL refused connection. The branch still requires the updated attachment dependency and result-route integration; no complete database or assembled-product pass is claimed.

Evidence: `/tmp/search-review-verify.log`, `/tmp/search-review-fixture-build.log`, `/tmp/search-review-e2e-final.log`, `/tmp/search-review-db.log`.

## Large decisions

Finding 3939721071 is addressed: option rows are vectorized independently, then matches select the best result once per parent decision. Equal scores choose a stable excerpt. No unbounded aggregate is passed to PostgreSQL's text-vector constructor. SQL regression adds 500 options containing more than 1 MiB of distinct cumulative text, checks a term in the final option, and checks deduplicated parent and household-wide results.

Full verification again passes 407 tests/build. Application rendering is unchanged from the 15 passing browser cases. Local database execution was attempted again but PostgreSQL remains unavailable. Search's missing product entry point (finding3939721069) and absent result destinations remain explicit dependency/integration work; they are not marked resolved.

## Search discovery

Finding 3939721069 is now addressed independently of result-destination assembly. The shared shell offers a labeled Search household link above mobile content and in the desktop sidebar, including an accessible name when the sidebar collapses. The existing five mobile primary destinations remain available. Both entry points target the authenticated search route without prefetching household queries.

Latest main-branch AGENTS.md was imported. Targeted lint and TypeScript checking passed; two focused Chromium navigation cases at 390 px and 1280 px passed, including the authentication gate and browser Back. No full suite or build ran locally for this change. Finding 3938766027 remains open until the other modules' detail routes are integrated and verified.
