# LemonAId

**Your data. A clearer path.** A local, single-file planner that takes the project inventory a lab already keeps and turns it into a picture of what the lab has, what is missing, and the checks that make each dataset findable and reusable by others.

Center for Regenerative Medicine, Boston University · v0.7.1 · October 2026

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
```

`src/data.blank.js` shows the embedded-inventory format; `docs/inventory-format.md` describes the columns. `data/reagents.json` is the Serrano Lab [EpiFlow Panel Builder](https://github.com/SerranoLab/EpiFlow_Builder) inventory (267 reagents) and is embedded in every build; replace it with your own export.

## What is deliberately not here

- No hosted service and no network calls. Local-first is a feature for consent, cost and adoption.
- No automatic repair of sheets. The validator proposes; a person decides.
- No reading of event data from FCS or alignments from BAM. Those belong to analysis pipelines; LemonAId records what they found.
- No center's project inventory. This repository ships the app, the rules, the tools, the reagent catalogue and two real validation fixtures from the Serrano Lab. The CReM Bioinformatics Core registry is not public.

## Provenance vocabulary

Every edge in the graph export carries one of: `recorded` (in the source inventory), `inferred` (derived by the inventory's compiler), `absent`, `normalised` (controlled term proposed by LemonAId; source string kept as evidence), `reviewed` (a normalised term confirmed by a named reviewer), `user_reported` (an answer with evidence on screen 03), `file_header` (read from an FCS header, marker and fluorochrome agree), `proposed` (header label plus detector convention), `candidate` (marker only; a person chooses).

## Tests

37 tests on Node's built-in runner. Nineteen run everywhere; eighteen need the private CReM registry and skip when it is absent. Fixtures are two real sample sheets (a KMT2D-dTAG CUT&RUN run and a 2019 zebrafish EdU flow experiment) and one real panel manifest from FCS headers.

## Citation, licence and credits

MIT licence, © 2026 M.A. Serrano, Center for Regenerative Medicine, Boston University Chobanian & Avedisian School of Medicine. Software citation in `CITATION.cff` (Serrano and Villacorta Martin). A Zenodo DOI will be added at the first release.

LemonAId grew out of the CReM knowledge graph (CReM-KG) planned by the CReM Bioinformatics Core. Carlos Villacorta Martin (Bioinformatics Core) co-designed the readiness questions, the intake sheet and the graph export. Darrell N. Kotton and Gustavo Mostoslavsky, CReM leadership, set the center-level questions the tool measures against. The CReM Bioinformatics Core is the intended maintainer, with the Serrano Lab as backup.

Tools: the initial prototype (v0.1, October 2026) was written with OpenAI Codex; v0.2 onward was developed with Claude (Anthropic), which drafted code, tests and documentation. Every design decision, rule and number was reviewed and is owned by the authors.
