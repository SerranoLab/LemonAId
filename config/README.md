# Center configurations

The blank build of LemonAId asks five general questions of any project list. A center can replace them
with its own, as data, without touching the code:

    node build.cjs --data src/data.js --name LemonAId_CReM_registry --queries config/crem.queries.json

A queries file has `source` (shown on screen), an optional `panel_intro`, and `queries`, each with `id`,
`title`, `source`, optional `horizon` (true for a question no inventory can answer yet) and `needs`: a
list of named tests from `NEEDS` in `src/engine.js`, as a string (`"files_located"`) or as
`{"need":"files_located","label":"expression files located"}` to relabel it on screen.

`crem.queries.json` is the CReM-KG set and is used only by the registry build. The public build never
contains it; CI fails if any of its text reaches `dist/LemonAId.html`. Identifier prefixes and the
BioCypher schema will join this folder when CReM-KG supplies them (docs/DECISIONS.md, 31 October).
