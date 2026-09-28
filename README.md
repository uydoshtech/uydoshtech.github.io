# UyDosh Telegram Mini App

## Build version

Each Pages publication uses `Build <run>.<attempt>` (for example, `142.1`). A
retry gets a new attempt number; a new push/manual dispatch gets a new run
number. This is independent of native iOS/Android builds. Older workflow runs
cannot overwrite a newer release; use a fresh workflow dispatch to publish again.

The deploy workflow minifies assets, then stamps all HTML pages with immutable
metadata and versions their local JS/CSS links. Dynamically loaded dictionaries
use the same build identifier. `build.json` carries the matching metadata for
update detection; it never replaces the loaded client's displayed build.

At the bottom of the Telegram profile, tap the build label to view/copy the
build time and short commit hash. When a newer release is detected, "Update
available" reloads the profile. Offline clients keep showing their loaded
version. Unpublished source checkouts display "Local build".

Build stamping runs only on disposable CI checkouts:
`node scripts/stamp-build.cjs` requires GitHub run number, attempt, and commit
variables. Do not run it on a working checkout. No manual build increment is
needed. The published build also appears in the GitHub Actions run summary.

Checks: `node --test tests/build-version.test.cjs tests/build-info.test.cjs`.
