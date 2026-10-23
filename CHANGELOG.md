# LemonAId changelog

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
