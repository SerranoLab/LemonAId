# LemonAId changelog

## Unreleased
- Roadmap and decisions: aligned to CReM-KG (CREM.* identifiers by configuration, schema read from its BioCypher file, its competency questions and coverage fields); LemonAId recorded as the Aim 1 instrument.
- Roadmap: v0.8.0 re-sequenced after a hands-on review (general build, file-backed sessions, import that forgives, plain-language pass first); reports and Excel import added to v0.9.0. Decision recorded.

## v0.7.2, 30 October 2026 (deployment release; the app is unchanged)
- The app file is byte-identical to v0.7.1: dist/LemonAId.html built at 560c94d (v0.7.1) and at this tag both have SHA-256 100a75af03b72fedc72bedd52f456a9ec0d00bed839ed793bc93fa6e448129dd. This release exists so the first deploy runs from a tag that carries the deploy tooling.
- Since v0.7.1: MIT licence, CITATION and README credits, the roadmap, decision log, governance draft, landscape notes and handoff (see the 30 October entry below), tools/lookup_public.py, and the CI workflow fix (the workflow file had never parsed; the first green run is 64fccd0).
- deploy: corrections from the first real run (30 October): DNS is at Porkbun; any region with the Basic plan (NYC1 used); the gate is proved on /LemonAId.html (the bare address redirects before the gate is checked); nginx no longer advertises its version (server_tokens off), checked by the local test.
- deploy: an access gate (an include file that lives only on the server) keeps the site visible from BU only until the v0.8.0 review; port 80 stays open for certificate renewal; the local test checks both the allowed and the closed state.
- deploy: certificate renewal is proved, not assumed: the renewal config (webroot, reload hook) and a dry run are step 6 proofs, and the served expiry date is read in the hand check (Let's Encrypt no longer emails before expiry).
- deploy/local-test.sh: serves the build locally through the droplet's own server blocks (ports 8080/8443, self-signed certificate) and checks redirects, security headers, checksum and 404 before anything is deployed.
- deploy.sh --rollback now verifies the served checksum and logs a line, like a deploy; it used to exit before logging. The script refuses to run when git user.name is empty. The clean-tree check ignores deploy/DEPLOY_LOG.md only, so a second deploy of the same tag (the rollback drill) is possible.
- deploy: the app file (/LemonAId.html) is now served with the security headers (CSP, HSTS, nosniff, Referrer-Policy); nginx had been dropping them in that location. Droplet before DNS in the procedure; certificate by webroot, so certbot never edits the nginx file.

## 30 October 2026 (Phase 0 decisions applied; no code change)
- Licence changed from BSD-2-Clause to MIT (LICENSE, CITATION.cff, README).
- CITATION.cff: version 0.7.1, ORCID for M.A. Serrano, abstract mentions the lookup tool and the Biolink-aligned export.
- README: credits for the CReM Bioinformatics Core, Darrell N. Kotton and Gustavo Mostoslavsky; maintainer named (the Core, Serrano Lab as backup); tool credits (Codex, Claude) with the accountability sentence; the session-export note says notes stay in one browser on one machine until file-backed sessions arrive.

## v0.7.1, 24 October 2026 (accession rule)
- Only a repository identifier (GSE, GSM, E-MTAB, PRJNA, PRJEB, SRP, ERP, PXD, phs, EGA) counts as a public accession. Other text in the field is kept as recorded and flagged "Accession field holds other text, not an accession" (or "a publication reference"). New filter for those rows.
- On the CReM registry this changes the headline: 17 projects with an accession, not 34; 17 rows (2025 to 2026) hold a person's name in geo_accession. Reach, readiness, the share plan's deposit step, the overview export and the graph export all use the rule; completeness now reports `accessionText`.
- Engine exports `accessionOf`, `hasAccession`, `accessionNote`. Tests: 37.

## v0.7, 23 October 2026 (from Angie's review notes)
- Reach labels defined on screen and in the overview; "Core only" renamed "Local only".
- Readiness score shown for every project as a sortable column; rule printed; shortlist renamed "Closest to shareable, by what the inventory records".
- Query panel reworded: purpose stated (a baseline), "needs all of", "met by N", "N of 409 meet all requirements".
- Structure screen in plain words: "One chain for every dataset; the assay comes last"; edge names demoted to small print.
- Normalisation table shows target namespace and Biolink category per field.
- Graph export: Biolink knowledge_level, agent_type and primary_knowledge_source on every edge; biolink_category on every node; new provenance word `reviewed` when a normalisation row has a reviewer. See docs/provenance.md.

# v0.2 to v0.6 (21 October 2026, evening)

## v0.6, panels and reagents
- Reagent inventory from the EpiFlow Panel Builder embedded (267 entries).
- fcs_panel_manifest.py: FCS header reader and inventory matcher; the first
  tool here that opens a data file. Real run on ZF_FLOW_EdU_UTAH: EdU resolves
  to AB228 via the APC detector; Sox2 and HuC/D match by marker only because
  the 2019 conjugates are not in the current inventory.
- Graph export: DataFile and Reagent nodes, STAINED_WITH edges with provenance.
- Tests: 36/36.


## v0.5, the sample-sheet reader
- validateSampleSheet in the engine and tools/validate_samplesheet.cjs on the
  command line share one rule set: identity, file presence (exact, or one
  name-based match marked recoverable), read pairing, design completeness,
  controls (column or inferred), exclusions by resolved filename, replicates
  per condition, derived files credited by sample ID, analysis products set
  aside, orphans listed, checksums recorded or verified. Nothing is repaired.
- First real runs: iNPC_KMT2DdTAG_CUT_RUN (clean; n = 1 is the finding) and
  ZF_FLOW_EdU_UTAH (51 names resolve once the stage prefix is honoured; two
  exclusions applied; a trailing path kept as a note). Reports in
  03_Review_and_intake/validation_reports; inputs double as test fixtures.
- Inventory of the 49 Serrano Lab GitHub projects in 02_Source_inventory.
- Tests: 35/35.


## v0.4, after Carlos's CReM-KG explainer
- Graph export in the CReM-KG shape (nodes.csv, edges.csv) with provenance
  on every edge; LemonAId sessions become direct graph intake.
- Provenance badges per project from lab_assignment and purpose_source.
- Normalisation table for assay and organism (original, proposed term,
  reviewer, status), exported as CSV; target ontologies named, not looked up.
- Query readiness: five center questions, the hops each needs, and the
  count of projects that can answer each today (all zero at baseline; the
  number is the point).
- Last-export nudge in the footer; honest reset prompt.
- Tests: 32/32.


## v0.3, same evening
- Renamed LemonAId (brand sheet: LemonAId_brand.png). Standalone files are
  now LemonAId_CReM_registry.html and LemonAId_blank.html. CReM branding
  removed from the interface; copyright line for the Center for
  Regenerative Medicine, Boston University, in the footer and exports.
- Start-here shortlist (screen 01 and overview export): projects closest to
  shareable and not yet deposited, ranked by recorded context, viewer and
  recency, each with its next step.
- Inventory-level exports: overview HTML (coverage, reach by lab, shortlist)
  and all-projects CSV with derived columns.
- Blank build (`node build.cjs --blank --brand "Name|SUB"`) for other centers;
  the app now handles an empty inventory and a configurable brand.
- Tests: 28/28.


Audit of the v0.1 package and the changes made in response. Scope of the tool,
as restated by Angie: help other laboratories and centers become AI-ready,
starting from the inventory they already keep. Not proposal evidence.

## What held up in v0.1
- Self-contained, dependency-free, hashed manifest, every relative link resolves.
- 22/22 tests passed on Angie's machine; all three exports download correctly
  (the v0.1 VERIFICATION.txt had left this unconfirmed).
- No script errors on any screen. Source text is never altered by review answers.

## What the audit found, and what changed
1. Meaningfulness. v0.1 forced every project through a flow + scRNA-seq lens,
   so bulk, ATAC, CUT&RUN and unlabelled projects (about half the registry)
   opened with a "confirm whether this is single-cell" action. v0.2 adds an
   assay-agnostic intended use, "Describe and share this dataset", with a
   repository-deposit action when no accession is recorded.
2. Scale. v0.1 embedded 30 Kotton trainee projects. v0.2 embeds the Core
   registry, 409 projects across 14 labs and two external collaborators, with
   lab, assay type and GEO accession as mapped fields. The project list is
   grouped by lab; a lab filter and a reach filter were added.
3. Where to start. Screen 01 now leads with field coverage and public reach
   (34 with an accession, 124 viewer only, 251 reachable only through the
   Core), which is the question an incoming lab asks first.
4. Hedging. The same disclaimer appeared three to four times per screen. It is
   now stated once per screen and once in the footer. Nothing was removed
   from the exports' evidence-status columns.
5. Data hygiene. The TSV header typo project_data is now project_date in the
   app (the legacy header still maps on import). Two registry rows,
   24_04_19_Darrell and 24_05_02_Darrell, carry "bulk RNA-seq" in the title
   and "scRNA-seq" in the assay field; the app now flags such disagreements
   instead of trusting either. Ask Carlos which is right.
6. Count. The registry holds 409 projects, not 410 as the insights document
   and the summary sheet state. No blank row, no duplicate ID.

## Not changed, by decision
- Visual design: already calm and low-density; kept. Four stat tiles instead
  of three, a coverage panel, and an evidence column are the only additions.
- Excel import: still CSV/TSV, to stay dependency-free.
- Protocols and Western blots: still future scope.

## Still open
- Real-file validation has not happened. The planner records who checked
  what; it does not open files. One EpiFlow bundle from the Serrano lab plus
  its sample sheet would be the fastest first pilot.
- PACKAGE_MANIFEST.json was regenerated for v0.2; the companion ZIP at the
  06_MVP level is from v0.1 and should be regenerated or deleted.
- The package carries transcripts and contacts; scrub before it leaves BU.

Tests: 26/26 pass (node --test tests/engine.test.cjs tests/app.test.cjs).
Browser check: all screens, filters, evidence save, three exports, 409 rows
load in under a second.
