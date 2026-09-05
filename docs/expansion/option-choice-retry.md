# Option creation retry recovery

Finding 3939819811 identified that a partner could choose an option between an uncertain creation response and its retry. The collision lookup now includes `chosen`, and acknowledgement requires the original unchosen state in addition to matching normalized fields and an active record. A later partner choice is reported as a conflict; the retry does not overwrite it.

Full verification passed397 tests/build. Property coverage varies option content and choice state; command tests verify both unchanged acknowledgement and chosen-state rejection, including the queried column and absence of an update. All 21 Home record lifecycle browser cases pass across Chromium, WebKit and mobile Safari. Fixtures now model the database's initial `chosen=false` value. No database migration changed.

Evidence: `/tmp/option-choice-retry-verify.log`, `/tmp/option-choice-retry-fixture-build.log`, `/tmp/option-choice-retry-e2e.log`. Dependent routes/RPCs and attachment integration remain open gates for PR51.
