# LemonAId

**Your data. A clearer path.** A local, single-file planner that takes the project inventory a lab already keeps and turns it into a picture of what the lab has, what is missing, and the checks that make each dataset findable and reusable by others.

Center for Regenerative Medicine, Boston University. Version and citation in `CITATION.cff`; the app shows its version in the sidebar.

> **Alpha, open for community feedback.** LemonAId is at https://lemonaid.serranolab.org for anyone to try with their own project list or folder; nothing you load leaves your browser. We are asking for feedback now, before the identifiers and column names settle at v1.0: which sentence on screen you did not understand, which guess about your data was wrong, and whether the plan it proposes is one your lab would follow. Open an issue, or email the maintainer in `CITATION.cff`. Every export says on its first line that it comes from an alpha, and the readiness figures describe paperwork, not data. Known gaps are the open issues.

## What it does

1. **What you have.** Import a spreadsheet of projects. See how far each dataset reaches today (public accession, interactive viewer, or only the people who made it), which fields the inventory records, the ten projects closest to shareable, and how many projects could answer the questions your center wants to ask of its data.
2. **The graph you are working toward.** A proposed structure (project, line, sample, file, assay) and a normalisation table for every distinct spelling of assay and organism, with a place for the reviewer's initials. Original strings are never changed.
3. **Connections to confirm.** The questions nobody has answered yet (are the files located, can libraries be traced to samples, is reuse permitted), each answered only with evidence: a file, a record, or a person. Plus a sample-sheet validator that checks a sheet against a file listing and reports pass, fail, recoverable, unknown or not applicable per check, with a repair and an owner. Nothing is repaired automatically.
4. **Your action plan.** An ordered list of what to do next for the project in focus, with deliverables, done-when checks and suggested roles.

Exports: a readable report and action list per project; an inventory overview and a full CSV for the whole inventory; graph nodes and edges with provenance on every edge, in the shape a knowledge graph can load; the normalisation table; a resumable session.

## Start in five minutes

1. Download `dist/LemonAId.html` and open it in Chrome, Safari, Firefox or Edge. No install, no server, no account. Nothing is sent anywhere.
2. Click **Import inventory** and choose a CSV or TSV with one row per project. Three columns are enough to start: a project ID, a name, a date. Any column names work; you match them on the next screen.
3. Read screen 01. Then pick one project, answer one question with evidence on screen 03, and watch the plan on screen 04 change.
4. **Export plan → Save a resumable session** before you close the browser. Notes live in the browser that opened the file, on that machine only; the session file is how they travel and how they survive a cleared browser. File-backed sessions with history are the first item of the next phase.

`examples/serrano_lab_projects_2026-10-21.csv` is a real 49-project inventory to try, with inferred fields marked as such.

## Command-line tools

```
node tools/validate_samplesheet.cjs <sample_sheet.tsv> <project_dir> [--exclude f] [--md5 f --verify-md5] [--out dir]
python3 tools/fcs_panel_manifest.py <project_dir> --reagents data/reagents.json [--out dir]
python3 tools/lookup_public.py <inventory.tsv|.xlsx> [--sheet name] [--out dir] [--ncbi]
```

The first walks a real project folder, checks the sample sheet against it with the same rules as the app, and writes `report.md` and `checks.csv`. The second reads only the header of each FCS file (never the events), lists every stained channel's detector and label, and matches labels to a reagent inventory. The third finds public records the inventory never wrote down: accessions and publication identifiers hidden in other fields (offline), and, with `--ncbi`, GEO series by the same submitter matched by year and words. Everything it finds is a candidate for a person to confirm. All three are read only.

## Build

```
node build.cjs                                   # dist/LemonAId.html, no inventory embedded
node build.cjs --data path/to/data.js --name LemonAId_MyCenter --brand "My Center|DATA READINESS"
node --test tests/engine.test.cjs tests/app.test.cjs
# the import flow in a real browser (needs Playwright once: npm install --no-save playwright && npx playwright install chromium)
node --test tests/browser.test.cjs
```

`src/data.blank.js` shows the embedded-inventory format; `docs/inventory-format.md` describes the columns. `data/reagents.json` is the Serrano Lab [EpiFlow Panel Builder](https://github.com/SerranoLab/EpiFlow_Builder) inventory (267 reagents) and is embedded in every build; replace it with your own export.

## Why the name

If life gives you lemons, make lemonade. The lemons are what every lab already has: the ordering spreadsheet, the screenshots, the slide with the lane labels, the sample sheet one trainee keeps. The lemonade is a map of what is known, what is missing, and what to do next. The capital AI in the middle says where the map leads, and the first question the tool asks is the brand kit's: AI-ready for what?

## What already exists, and where LemonAId sits

We surveyed four families of tools in October 2026 (`docs/landscape_2026-10-30.md`). FAIR assessors (F-UJI, FAIR-Checker, FAIRshake) score a record that already has a DOI. Data-management-plan engines (DSW, DMPTool, ARGOS) turn questionnaire answers into a plan document and never look at the data afterwards. Electronic notebooks and LIMS (eLabFTW, RSpace, openBIS, SEEK) link samples to files only for files entered through them, and most academic labs use none. Knowledge-graph projects (Biolink, BioCypher, OptimusKG, HuBMAP, CELLxGENE) validate at intake and expect provenance on every edge. None of them starts from the project list a lab already keeps, checks the files on the lab's own server against it, and returns a plan with an owner and an evidence requirement per item. That is the step LemonAId performs, before deposit, before any notebook, before the graph.

LemonAId does not duplicate any of those layers. It adopts their rubrics (the RDA FAIR Data Maturity levels, the NIH Bridge2AI criteria), their formats (RDA machine-actionable DMP, RO-Crate and `.eln`, Frictionless Table Schema) and their identifiers (infores, ORCID, ROR, RRID, Biolink CURIEs), so what it produces flows into them: a validator report attaches as evidence, a ready project hands off to FAIRSCAPE for packaging, the graph export loads through a BioCypher adapter. The table in `docs/landscape_2026-10-30.md` lists the synergy per tool.

## What is deliberately not here

- No hosted service and no network calls. Local-first is a feature for consent, cost and adoption.
- No automatic repair of sheets. The validator proposes; a person decides.
- No reading of event data from FCS or alignments from BAM. Those belong to analysis pipelines; LemonAId records what they found.
- No center's project inventory. This repository ships the app, the rules, the tools, the reagent catalogue and two real validation fixtures from the Serrano Lab. The CReM Bioinformatics Core registry is not public.

## Sustainability

LemonAId is maintained by the CReM Bioinformatics Core with the Serrano Lab as backup (see `docs/ROADMAP.md`
for the milestones and `docs/GOVERNANCE.md` for who may hold what). Every release is archived on Zenodo with
a DOI. If maintenance ever stops: the licence is MIT, so anyone may fork; the app is one file with no
dependencies and no server, so it keeps opening in any browser; sessions and exports are plain JSON and CSV,
so nothing is locked in. This statement is about the software. Each lab's datasets are governed by that
lab's own data management and sharing plan.

## Provenance vocabulary

Every edge in the graph export carries one of: `recorded` (in the source inventory), `inferred` (derived by the inventory's compiler), `absent`, `normalised` (controlled term proposed by LemonAId; source string kept as evidence), `reviewed` (a normalised term confirmed by a named reviewer), `user_reported` (an answer with evidence on screen 03), `file_header` (read from an FCS header, marker and fluorochrome agree), `proposed` (header label plus detector convention), `candidate` (marker only; a person chooses).

## Feedback we are looking for

- **Labs:** load your own inventory or folder. Tell us what was guessed wrong, what you could not answer on screen 03, and whether screen 04 is a plan you would act on.
- **Cores and centers:** does the template match the columns you already ask for? What would you add to the questions a center wants answered?
- **Data engineers:** the graph export, the provenance vocabulary and the normalisation table; where would a CURIE or a Biolink class be wrong?

Issues are the place: https://github.com/SerranoLab/LemonAId/issues. One confusion per issue, with the screen number, is the most useful report we can get.

## Tests

37 tests on Node's built-in runner. Nineteen run everywhere; eighteen need the private CReM registry and skip when it is absent. Fixtures are two real sample sheets (a KMT2D-dTAG CUT&RUN run and a 2019 zebrafish EdU flow experiment) and one real panel manifest from FCS headers.

## Citation, licence and credits

MIT licence, © 2026 M.A. Serrano, Center for Regenerative Medicine, Boston University Chobanian & Avedisian School of Medicine. Software citation in `CITATION.cff` (Serrano and Villacorta Martin). A Zenodo DOI will be added at the first release.

LemonAId grew out of the CReM knowledge graph (CReM-KG) planned by the CReM Bioinformatics Core. Carlos Villacorta Martin (Bioinformatics Core) co-designed the readiness questions, the intake sheet and the graph export. Darrell N. Kotton and Gustavo Mostoslavsky, CReM leadership, set the center-level questions the tool measures against. The CReM Bioinformatics Core is the intended maintainer, with the Serrano Lab as backup.

Tools: the initial prototype (v0.1, October 2026) was written with OpenAI Codex; v0.2 onward was developed with Claude (Anthropic), which drafted code, tests and documentation. Every design decision, rule and number was reviewed and is owned by the authors.
