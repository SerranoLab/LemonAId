# Contributing

LemonAId is maintained by the CReM Bioinformatics Core with the Serrano Lab as backup (see README).
Until the beta, changes come through pull requests from the named maintainers; issues are open to everyone.

## Ground rules
- Source values are never altered by the tool. Every derived value carries a provenance word from `docs/provenance.md`.
- Nothing leaves the user's machine. No network calls in the app, ever.
- No private inventory, registry or order sheet enters this repository.
- Rules change in the schema file, not in the interface code, from v0.8.
- Every rule has a test; every reader has a real fixture.

## Workflow
1. Open an issue first for anything beyond a typo. Say which journey or rule it concerns.
2. Branch from `main`. One change per pull request.
3. Run `node build.cjs` and the tests. CI must be green.
4. Fill in the pull request template. Name who checked the change besides you.
5. Record any decision in `docs/DECISIONS.md` in the same pull request.

## Reporting a problem
Use the bug template. Say which build (the version in the footer), which browser, what you did,
what you expected, and attach the smallest file that reproduces it (never a private registry).
