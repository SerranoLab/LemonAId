# Provenance vocabulary

Every edge in `graph-edges.csv` carries LemonAId's plain word in `provenance` and the Biolink edge properties a Biolink-aligned loader (OptimusKG, CReM-KG) expects: `knowledge_level`, `agent_type`, `primary_knowledge_source`. The mapping is fixed in `src/engine.js` (`PROVENANCE`).

| provenance | Meaning | knowledge_level | agent_type | primary_knowledge_source |
| --- | --- | --- | --- | --- |
| recorded | Present in the source inventory as written | knowledge_assertion | manual_agent | infores:<inventory name> |
| inferred | Derived by the inventory compiler (lab from folder paths) | observation | data_analysis_pipeline | infores:<inventory name> |
| absent | No value; placeholder edge | not_provided | not_provided | infores:<inventory name> |
| normalised | Controlled term proposed by LemonAId; source string kept as evidence | knowledge_assertion | automated_agent | infores:lemonaid |
| reviewed | Controlled term confirmed by a named reviewer (initials in the normalisation table) | knowledge_assertion | manual_validation_of_automated_agent | infores:lemonaid |
| user_reported | Answer recorded on screen 03 with evidence named | observation | manual_agent | infores:lemonaid |
| file_header | Read from an FCS header; marker and fluorochrome agree with one reagent | observation | data_analysis_pipeline | infores:file-header |
| proposed | Header label plus detector convention picks the conjugate | prediction | automated_agent | infores:file-header |
| candidate | Marker matched; several conjugates possible; a person chooses | prediction | automated_agent | infores:file-header |

Nodes carry a `biolink_category`: Project `biolink:Study`; Lab and Person `biolink:Agent`; Organism `biolink:OrganismTaxon`; Assay `biolink:Procedure`; DataResource `biolink:InformationResource`; DataFile, ReporterDescription and EvidenceState `biolink:InformationContentEntity`; Reagent `biolink:ChemicalEntity`. Sample, Contrast and Gene nodes are not emitted until sample-level data are ingested.

Identifiers are name slugs in v0.7 and will become stable IDs with a crosswalk (see the implementation plan). Controlled terms will carry CURIEs in the Biolink namespaces: NCBITaxon for organisms, OBI or EFO for assays, CL for cell types, MONDO for diseases, HGNC or Ensembl for genes.

The `infores:` values are placeholders in the Information Resource Registry sense; register `infores:crem-bioinformatics-core-registry` and `infores:lemonaid` when CReM-KG is published.
