# Telegram Mini App release versioning

User preference: the Telegram Mini App must have its own build number,
independent of iOS and Android version/build numbers.

- Every new build prepared for publication must have a unique, increasing build
  identifier, including a rebuilt deployment of the same commit. Do not reuse a
  previously published build identifier.
- Prefer automatic build numbering in the publication workflow rather than
  manual increments for each source edit. Draft edits in the same unpublished
  build do not each need a new number.
- Before publishing Mini App changes, verify that build numbering is wired into
  the actual deployment artifact and that its displayed version is updated.
- The UI must identify the build actually loaded by the client. Fetching the
  latest server version alone must not relabel an older cached client as current.
- Keep commit/release metadata available for diagnosing which code was deployed.

Implementation: `.github/workflows/deploy.yml` runs `scripts/stamp-build.cjs`.
The build identifier is `GITHUB_RUN_NUMBER.GITHUB_RUN_ATTEMPT` (e.g. `142.1`,
then `142.2` for a retry). The workflow refuses older publication runs; dispatch
a new deployment to republish an old commit. Do not reset/replace the deployment
workflow's numbering without preserving ordering against existing releases.

The stamp embeds metadata in HTML, updates local CSS/JS cache versions, and
writes `build.json` for update detection. The profile's `assets/build-info.js`
shows the embedded build, never the remotely fetched version. Source checkouts
show "Local build". Run the stamp only on disposable deployment checkouts.
