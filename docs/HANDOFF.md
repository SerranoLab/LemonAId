# Handoff: where LemonAId stands and what to do next

Updated 30 October 2026. Read this first in any new working session.

## Where things are
- Source of truth: this repository (`~/Documents/Boston/TheSerranoLab/GitHub_SerranoLab/Projects/LemonAId`). The grant-folder copy under `06_MVP/CReM_Readiness_Package_2026-10-21` is the frozen v0.6 archive and holds the private registry build; never edit it.
- Plan of record: `docs/ROADMAP.md` (milestones v0.8.0, v0.9.0, v1.0.0-beta.1 with owners and checkers).
- Decisions: `docs/DECISIONS.md`. Governance: `docs/GOVERNANCE.md` (draft). Release: `docs/RELEASE_CHECKLIST.md`. Deploy: `deploy/DEPLOYMENT.md` (Option B, separate droplet, chosen).
- Landscape and positioning: `docs/landscape_2026-10-30.md`; README sections "Why the name" and "What already exists".
- Review pack (Claude doc): "LemonAId review pack, 22 October", tabs A to K; tab I is the running status list.
- Paper first draft (Claude doc): "LemonAId paper, first draft", 30 October.

## Blocked on Angie
1. Create `SerranoLab/LemonAId` on GitHub (private, empty), then push `main`.
2. Create the LemonAId droplet and DNS record (deploy/DEPLOYMENT.md steps 1 to 6).
3. Carlos's ORCID; Darrell's and Sandeep's assent to the credits.
4. One Keyence experiment folder into the Data folder.

## Next engineering step (v0.8.0, first pull request)
File-backed sessions: save to a user-chosen JSON file with a rolling history of 20 saves; browser copy becomes a cache; export round trip tested; undo and "since last save" built on the history. Checker: Sandeep on a second machine.
Then, in order: schema as data, stable identifiers, export manifest, error cases, Playwright journeys, purpose sentence and demo mode.

## Working rules
- One change per pull request; a named checker who is not the author; CI green; CHANGELOG under Unreleased; decision in DECISIONS.md.
- Commits as Angie Serrano <maserr@bu.edu>; git in this folder needs delete permission for its lock files.
- No private inventory, registry or order sheet enters the repository.
