# LemonAId roadmap to a beta that deserves the name

Written 30 October 2026. Owner: M.A. Serrano. Reviewed with: C. Villacorta Martin (pending).
This file is the plan of record. Changes to it are commits, so the history is the audit trail.

## Where v0.7.1 stands, honestly

What is solid: source values are never altered; every derived value carries a provenance word;
the rules are tested against real sample sheets and FCS headers; the graph export already speaks
Biolink; nothing leaves the machine.

What is not ready for anyone outside the project to depend on:

1. Notes live in one browser's localStorage. A cleared cache or a second machine loses them.
2. The rules (fields, questions, readiness queries, normalisation targets) are JavaScript arrays.
   Nobody can read, version or validate them without reading code.
3. Graph identifiers are name slugs. Two spellings make two people.
4. Exports have no manifest. A loader cannot tell which version of the rules produced them.
5. Error paths are untested. A malformed CSV, a 50 MB file or a Latin-1 encoding has no promised behaviour.
6. There is no end-to-end browser test; the harness tests the app's functions, not a person clicking.
7. Documentation is written for the people who built it.
8. There is no release process: no tags, no checksums, no DOI, no checklist anyone signed.

A beta is a promise to other people that their time will not be wasted. The eight items above
are the promise. Nothing ships as beta until all eight are closed and checked by someone who did
not build the feature.

## Versioning

Semantic versioning. 0.x until the beta. The beta is tagged `v1.0.0-beta.1`; later betas increment
the suffix; `v1.0.0` follows a completed beta with the exit criteria below met. Every tag has a
CHANGELOG entry, a GitHub Release with `dist/LemonAId.html` and its SHA-256, and (from the beta on)
a Zenodo DOI. The registry build (`*_CReM_registry.html`) is never released or deployed; it is built
locally for CReM use only.

## Milestones and gates

### v0.8.0, Foundations (target: end of November 2026)

Scope: the four engineering items the audit put first, plus error handling and a browser test, and,
after Angie's 30 October hands-on review, a general build and plain language a bench scientist can read.
Pull requests go in the order of the table: general build, file-backed sessions, import that forgives,
plain-language pass, then the remaining rows from schema as data down.

| Item | Done when | Owner | Checked by |
| --- | --- | --- | --- |
| General build | The blank build holds nothing specific to CReM or the case study: the center questions (SFTPC/NKX2-1, KRT17, pre-SKAAR), "Return to the registry", people's names and the teaching scenario move to a CReM configuration used only by the registry build; a CI test fails if those strings reach `dist/LemonAId.html`; the build stamps its git tag on screen and in every export (no hand-written "v0.7" or "v0.3") | Angie | CI, then Sandeep reads every screen for leftovers |
| File-backed sessions | A session saves to a JSON file the user chooses, with a rolling history of the last 20 saves; the browser copy is a cache; opening the file on a second machine shows the same notes | Angie | Sandeep, on a second machine |
| Import that forgives | Three doors (folder, spreadsheet, blank template with one example row and a column guide); visible steps with Back on every one and a preview before import; the template's column names follow the Bioinformatics Core's sample-submission form; demo mode loads the example inventory in one click | Angie | Gustavo Mostoslavsky and the Serrano Lab team, each on their own folder and spreadsheet |
| Plain-language pass | Every on-screen explanation rewritten for a bench scientist: what the screen is for, in a question they would ask, and no curation terms without a one-line meaning (the Reach paragraph is the model: "Where can someone outside your lab find this data?") | Angie | A bench scientist outside the project reads screens 01 to 04 and says each back correctly (to be named) |
| Schema as data | `schema/lemonaid.schema.json` (fields, questions, goals, queries, normalisation targets, provenance words) is loaded by the app and the CLI tools; `schema_version` is written into every export; the graph side is read from CReM-KG's BioCypher `schema_config.yaml` (Carlos's file is the source of truth; LemonAId never generates a competing one); the CReM configuration carries CReM-KG's ten competency questions as the readiness questions and its coverage fields (cell-line id, protocol version, marker values, reagent RRID, lot, gating definition, viability and QC, controls) | Angie | Carlos reads it without the code |
| Stable identifiers | Every Lab, Person, Project, Run and Reagent gets a CURIE at first sight, with the prefix taken from the configuration: CReM uses CReM-KG's scheme (`CREM.PROJECT:`, `CREM.RUN:`, `CREM.LINE:` and so on); another center supplies its own registered prefix, so the app stays general; `crosswalk.csv` maps names to IDs; ORCID and ROR fields exist; notes in a name never become part of an ID | Angie | A renamed lab keeps its ID in a test; every exported ID passes CReM-KG's BioCypher check (Carlos) |
| Export manifest | `manifest.json` beside every export: LemonAId version, schema version, source file names and SHA-256, row counts, time | Angie | Carlos's loader reads it |
| Error handling | Ten malformed inputs (empty file, no header, wrong delimiter, Latin-1, 50 MB, duplicate IDs, binary file, mismatched columns, unknown date formats, a file of only headers) each produce a visible message and leave the session unchanged; all ten are tests | Angie | Test run in CI |
| End-to-end test | Playwright drives the blank build through the five journeys (import, review, answer with evidence, validate a sheet, export) in Chromium and WebKit; runs in CI | Angie | CI |
| Export round trip | Export a session, clear the browser, import it: identical state, tested | Angie | CI |
| Purpose sentence | One sentence on screen 01, above the tiles, says what the tool is for and that nothing leaves the machine | Angie | A stranger reads it and says it back correctly |
| Inventory from a folder | In the app, a chosen folder is read in the browser (webkitdirectory): one row per top-level folder from names, sizes, dates and README or notebook text, never assay files, into the same columns as the 21 October Serrano Lab inventory, every guessed value marked inferred; then the same column-matching step as a spreadsheet. A command-line twin (`tools/inventory_from_folders.py`) follows so the inventory can be regenerated without a browser | Angie | Gustavo Mostoslavsky and the Serrano Lab team on their own folders; CI on a fixture listing |
| Demo mode | A "Try it with the example inventory" button on the empty state loads examples/serrano_lab_projects_2026-10-21.csv; one click, no file dialog | Angie | Sandeep |
| Undo and session diff | Undo the last answer, note or normalisation edit; a "Since last save" panel lists what changed, from the session history | Angie | Sandeep |
| Local timing | Each project's time in focus is recorded in the session file (start, end, screen); a "Time spent" export per project; nothing leaves the machine; off by default, on for the pilot | Angie | Carlos reads the pilot numbers |

Gate: all rows checked; CI green on `main`; CHANGELOG written; tag `v0.8.0`.

### v0.9.0, Readers and terms (target: end of January 2027)

Scope: the building blocks specified in the review pack (tab C), the vocabulary work, and the pilot.

| Item | Done when | Owner | Checked by |
| --- | --- | --- | --- |
| Reagent layer | `tools/reagents_from_orders.py` merges both labs' order sheets, the Kotton log and the Panel Builder inventory; the counts (catalog numbers with clone, host, RRID) are reported | Angie, Sandeep | Darrell sees his lab's numbers first |
| Experiment inventory template | `examples/experiment_inventory_template.csv` with protocol, sample sheet and panel manifest columns; imports into the blank build | Angie | Sandeep imports his own |
| Western reader | Runs on IF-192 to IF-201; emits lane sheets; the four checks answered | Engineer or Angie | Irena confirms the lane sheets |
| Flow gold reader | Runs on Exp 9.102; sample sheet, statistics export, FCS headers, controls, gold table | Engineer or Angie | Sandeep |
| CURIEs and term lists | Bundled term lists (NCBITaxon, CL, OBI, EFO, MONDO, HGNC) for the terms in use; the normalisation table proposes CURIE plus label; ontology versions recorded | Angie | Carlos |
| PROV-O mapping | Beside the Biolink columns in docs/provenance.md | Angie | Carlos |
| Core intake pilot | Lauren's project goes through the reader with Carlos present; report and graph export accepted without editing; minutes per project reported from the local timing | Carlos, Angie | Carlos signs the report |
| Hand-off view | One page per person: every open question, missing evidence and unresolved normalisation on their projects; exportable as the report | Angie | A departing trainee uses it |
| Governance charter and sustainability statement | docs/GOVERNANCE.md and a Sustainability section in the README, reviewed by Carlos and Darrell | Angie | Darrell |
| Reports people want to read | The plan and overview exports open with a one-paragraph summary and a short list of next steps, then the details; LemonAId branding; bullets, not dense tables; printable on letter paper | Angie | Darrell reads one report cold |
| Excel import | `.xlsx` read directly in the browser by a bundled library (nothing leaves the machine), first sheet or a chosen one | Angie | Sandeep |
| Comparison with existing tools | README section and paper section: what DSW, RDMkit, FAIR-Checker, FAIRshake and ELN/LIMS do, where LemonAId sits, how they connect | Angie | Carlos |

Gate: pilot report signed; two Serrano projects end to end; tag `v0.9.0`.

### v1.0.0-beta.1, Beta (target: end of February 2027)

Scope: documentation, deployment, a defined cohort, and a feedback loop.

| Item | Done when |
| --- | --- |
| Docs for a lab manager | Quick start, the four screens, a glossary, a FAQ, what leaves the machine, how to report a problem; read by one person who has never seen the tool and timed |
| Release process | `docs/RELEASE_CHECKLIST.md` completed and signed in the release notes; SHA-256 published; Zenodo DOI minted |
| Deployment | The blank build served over HTTPS from a reproducible deploy script with a rollback; see `deploy/DEPLOYMENT.md` |
| Beta cohort | Three to five named testers (one Core member, one Serrano Lab trainee, one lab outside CReM); each has one real project; a four-week window with a weekly 15-minute check-in |
| Feedback loop | GitHub issue templates for bugs and beta feedback; every issue answered within five working days; the list of what changed because of the beta is in the CHANGELOG |
| Browser matrix | Chrome, Safari, Firefox, Edge on macOS and Windows: the five journeys pass by hand on each |
| Accessibility | Keyboard navigation through the four screens; contrast checked on the brand palette |

Exit criteria for `v1.0.0`: every tester completed the five journeys on their own project; no open
issue labelled `data-loss` or `blocks-journey`; the docs were revised from tester questions.

## Accountability

- Decisions: `docs/DECISIONS.md`, one dated entry per decision, with who decided and why. Nothing is decided in chat only.
- Changes: every commit message says what and why; the CHANGELOG is written per release, not reconstructed.
- Checks: every table row above has a "checked by" who is not the builder. A row is not done until that person says so in the PR or in DECISIONS.md.
- Numbers: every number quoted in a document or a proposal names the commit and the input file it came from.
- Releases: the checklist is completed in the release notes, every item ticked by name.
- Deployment: every deploy is one line in `deploy/DEPLOY_LOG.md` (date, tag, who, checksum, outcome).
- Cadence: one status line per week in the review pack's tab I until the beta ends.

## What this roadmap does not do

- It does not add features to screens 01 to 04 before the foundations are closed.
- It does not promise a hosted service; the deployment serves a static file.
- It does not put the registry build anywhere outside BU.
