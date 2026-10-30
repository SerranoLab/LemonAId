# Release checklist

Copy this list into the GitHub Release notes and tick every item by name. A release with an
unticked item is not a release.

## Before tagging
- [ ] `node build.cjs` from a clean checkout; `dist/LemonAId.html` has no external script or stylesheet (CI asserts this).
- [ ] `node --test tests/engine.test.cjs tests/app.test.cjs` passes; the end-to-end test passes (from v0.8).
- [ ] No private data in the tree: `git ls-files | grep -iE "registry|kotton|data\.js"` returns nothing but `src/data.blank.js`.
- [ ] CHANGELOG.md has an entry for this version, written from the commits, with the date.
- [ ] CITATION.cff `version` and `date-released` updated.
- [ ] docs/DECISIONS.md holds every decision made since the last release.
- [ ] README numbers (tests, reagents, versions) match the tree.

## Tag and release
- [ ] `git tag -a vX.Y.Z -m "..."`; `git push --tags`.
- [ ] GitHub Release created; `dist/LemonAId.html` attached; its SHA-256 printed in the notes (`shasum -a 256 dist/LemonAId.html`).
- [ ] From the beta on: Zenodo deposit confirmed; DOI pasted into CITATION.cff and README in a follow-up commit.

## After release
- [ ] Deployed per deploy/DEPLOYMENT.md; one line added to deploy/DEPLOY_LOG.md.
- [ ] The deployed file's SHA-256 matches the release asset.
- [ ] The five journeys pass by hand on the deployed page in one browser.

Released by: ______  Checked by: ______  Date: ______
