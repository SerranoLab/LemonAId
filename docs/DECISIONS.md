# Decisions of record

One entry per decision. Newest first. Format: date, decision, who, why, what it changed.
A decision that is not here was not made.

## 2026-10-30. Separate droplet for LemonAId (Option B)
Decided: Angie. LemonAId is served from its own 1 GB DigitalOcean droplet, not from the EpiFlow D3 droplet,
so a LemonAId deploy can never touch EpiFlow's nginx or containers. deploy/DEPLOYMENT.md Option B is the procedure.

## 2026-10-30. Scope answers on the "still missing" list
Decided: Angie.
- One-sentence purpose on the first screen: yes. No named reader persona.
- Comparison with existing tools (DSW, RDMkit, FAIR-Checker, FAIRshake, ELN/LIMS): yes, with a synergy assessment; goes into README and the paper.
- Spanish interface: deferred until the tool is proven; a strings file is not started yet.
- Demo mode (one click, example inventory, no import): yes, v0.8.
- Undo and a "what changed since my last session" view: yes, v0.8, built on the file-backed session history.
- Measured cost (minutes per project) during the pilot: yes, local-only timing written into the session file, never sent anywhere.
- Hand-off view for a departing trainee: yes, v0.9.
- Governance charter and sustainability statement: to be drafted; no password accounts (see 2026-10-30 note on accounts when written).

## 2026-10-30. Beta criteria and milestones
Decided: Angie. The eight readiness items and three milestones in docs/ROADMAP.md define "beta".
Nothing is tagged beta until all eight are closed and each is checked by someone other than the builder.

## 2026-10-30. Deployment target
Decided: Angie (23 October), recorded today. Private repository until Carlos has reviewed; then public;
then the Serrano Lab DigitalOcean droplet. GitHub Pages is not used. The droplet serves only the blank
build; the registry build never leaves BU. The droplet currently runs EpiFlow D3 in Docker with its own
nginx; LemonAId is added as a second server block without changing EpiFlow's configuration (deploy/DEPLOYMENT.md).

## 2026-10-30. Phase 0 decisions applied (commit ac25498)
Decided: Angie, 23 October review of the pack; applied 30 October.
1. Browser storage through Phase 0; file-backed sessions first in v0.8.
2. MIT licence (the Panel Builder stays BSD-2).
3. SerranoLab/LemonAId now; transfer to a CReM organisation when the Core adopts intake.
4. Repository private until Carlos reviews, then public, then the droplet.
5. Proposal numbers: registry figure, query readiness, zebrafish report as the example.
6. Pilots: zebrafish set for the proposal; Lauren's TGFB iAT2 project for Core intake; Golden set for the paper.
7. Maintainer: CReM Bioinformatics Core, Serrano Lab as backup until the award.
8. Core adoption of the sample sheet asked after one pilot; the proposal says "will".
9. Paper authors: Villacorta Martin, Mostoslavsky, Kotton, Serrano (senior). Software citation: Serrano and
   Villacorta Martin; Sreerama when he contributes. README credits the Core, Kotton, Mostoslavsky, Codex, Claude.

## 2026-10-24. Accession rule
Decided: Angie, from the registry audit. Only a repository identifier counts as a public accession
(GSE, GSM, E-MTAB, PRJNA, PRJEB, SRP, ERP, PXD, phs, EGA). Other text is kept and flagged. Changed the
CReM headline from 34 to 17 recorded accessions. Commit 560c94d.

## 2026-10-23. Source of truth
Decided: Angie. The git repository is the source of truth; the grant-package copy under
06_MVP/CReM_Readiness_Package_2026-10-21 is the archive of v0.1 to v0.6 and is not edited.

## 2026-10-19. Gold data, not raw
Decided: Angie and Carlos. CReM-KG ingests derived tables (gold) with provenance back to the raw files;
raw files stay on the lab server and travel as path, size and checksum.
