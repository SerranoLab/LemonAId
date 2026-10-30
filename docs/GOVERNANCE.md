# Governance charter (draft for review by C. Villacorta Martin and D. Kotton)

Draft 30 October 2026. One page. It answers four questions: what the data classes are, who may
hold each, who may answer for a lab, and how a lab leaves. It does not create accounts or logins;
the reasoning is at the end.

## 1. Three data classes

| Class | What it is | Where it lives | Who may hold it |
| --- | --- | --- | --- |
| The blank build | `dist/LemonAId.html`, the app with no inventory, plus the example inventory and the public reagent catalogue | GitHub, Zenodo, the droplet | Anyone |
| A lab's own inventory and sessions | The spreadsheet a lab imports, the session file with its answers, notes and evidence, its exports | The lab's own machines and storage | The lab; whoever the PI names |
| A center registry build | The app with a center's project registry embedded (for CReM: 409 projects, contacts, purposes) | Inside the center, never in a repository or on a public server | Named by the registry's owner (for CReM: the Bioinformatics Core director) |

The tool never moves data between classes on its own: it makes no network calls, and the deploy
script copies only the blank build.

## 2. Who may answer for a lab

An answer on screen 03 (where the files are, which sample is which, whether reuse is permitted) is
a statement about a lab's data. It is made by the PI or by a person the PI has named for that
project, and it carries that person's initials, the date, and the evidence (a file, a record, a
person). An answer without evidence is not accepted by the tool. With file-backed sessions (v0.8),
every save is timestamped, so who said what and when is in the file.

Normalisation terms (what "scRNA-seq 10X" maps to) are reviewed by the center's data steward, not
by each lab; the reviewer's initials go in the table.

## 3. How a lab leaves

A lab leaves by exporting its rows (the inventory overview, the graph export, the session file) and
asking the registry owner to remove its projects from the next registry build. Nothing in the tool
retains a lab's data after that, because nothing in the tool retains anything: there is no server
copy.

## 4. Retention

A session file is the lab's record and follows the lab's retention policy. A registry build is
regenerated from the registry; old builds are deleted when a new one is made.

## Why there are no accounts

- An account needs a server, identity management and a breach plan. The day LemonAId holds a
  password it stops being a file a lab can open and becomes a service someone must secure forever.
- The sensitive object is the registry build, not the app. Who holds that file is a decision of the
  registry owner, and no login inside the app changes who has the file.
- Attribution is already solved: initials, date and evidence on every answer; timestamps on every save.
- If shared sessions are ever built (a server-side component), access goes through the institution's
  own login (BU Shibboleth), never through passwords LemonAId stores.

## Open questions for the reviewers

1. For CReM, who names the holders of the registry build, and is a list kept?
2. Should a lab's PI delegation be written in the session (a `delegates` field) or kept outside the tool?
3. How long does the Core keep a lab's validation reports after intake?
