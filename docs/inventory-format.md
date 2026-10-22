# Inventory format

LemonAId reads one row per project. Any column names work; the import screen proposes a mapping and you confirm it. These are the planning fields it looks for, with the header aliases it recognises automatically.

| Planning field | Recognised headers (case and punctuation ignored) | Needed to start? |
| --- | --- | --- |
| Project ID | project_id, id, project | yes |
| Dataset / project name | Dataset_Name, dataset, title, name | yes |
| Project date | project_date, project_data, date | yes |
| Laboratory | lab, Lab_PI, laboratory, pi, group | no |
| Contact | contact_person, contact, owner, trainee, requester | no |
| Species / genome reference | genome_reference, genome, species, organism | no |
| Reporters | reporters, reporter | no |
| Assay type | experiment_type, assay, assay_type, platform | no |
| Purpose | purpose_of_experiment, purpose, description, objective, aim | no |
| Analysis viewer link | analysis_visualization_link, viewer, url | no |
| Shiny link | shinyapp_link, shiny | no |
| Public accession | geo_accession, geo, accession, sra, repository | no |

Optional provenance columns, read when present: `lab_assignment` (recorded / inferred / none) and `purpose_source` (any value; values containing "llm" or "suspect" are flagged).

Empty cells and `NA` count as missing. Unmapped columns are kept and shown under "all original columns". Nothing in the file is changed.

## Embedding an inventory in a build

`src/data.blank.js` shows the shape: `window.CREM_DATA = {source:{name,path,sha256,sheet,records,label,default_selected}, records:[{key,row,raw:{...}}]}`. `raw` holds the row exactly as read, keyed by the original headers. Build with `node build.cjs --data your/data.js --name LemonAId_YourCenter`. Do not commit a data.js that contains people's names unless your center has decided it is public.
