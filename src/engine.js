(function (root) {
  'use strict';
  const FIELDS = [
    ['project_id','Project ID'], ['Dataset_Name','Dataset / project name'],
    ['lab','Laboratory'], ['project_date','Project date'], ['contact_person','Contact'],
    ['genome_reference','Species / genome reference'], ['reporters','Reporters'],
    ['experiment_type','Assay type (as recorded)'], ['purpose_of_experiment','Purpose'],
    ['analysis_visualization_link','Analysis viewer link'], ['shinyapp_link','Shiny link'],
    ['geo_accession','Public accession (GEO)']
  ];
  // Fields a reader needs to find, understand and reuse a dataset. Used for the completeness summary.
  const READINESS_FIELDS = ['Dataset_Name','contact_person','genome_reference','experiment_type','purpose_of_experiment','reporters','analysis_visualization_link','shinyapp_link','geo_accession'];
  const DEFAULT_MAP = Object.fromEntries(FIELDS.map(([k])=>[k,k==='lab'?'Lab_PI':k]));
  const ALIASES = {
    project_id:['projectid','id','project'], Dataset_Name:['datasetname','dataset','title','projectname','name'],
    lab:['lab','labpi','laboratory','pi','group','primarylab'],
    project_date:['projectdate','projectdata','date','dateregistered'], contact_person:['contactperson','contact','owner','trainee','requester'],
    genome_reference:['genomereference','genome','species','organism'], reporters:['reporters','reporter'],
    experiment_type:['experimenttype','assay','assaytype','experiment','platform','datatype'],
    purpose_of_experiment:['purposeofexperiment','purpose','description','objective','aim'],
    analysis_visualization_link:['analysisvisualizationlink','analysislink','viewer','url','viewerlink'],
    shinyapp_link:['shinyapplink','shiny','shinylink'],
    geo_accession:['geoaccession','geo','accession','sra','publicaccession','repository']
  };
  const clean = x=>String(x??'').trim();
  const missing = x=>!clean(x)||/^(na|n\/a|unknown|null)$/i.test(clean(x));
  const norm = x=>clean(x).toLowerCase().replace(/[^a-z0-9]/g,'');
  // A public accession is a repository identifier. Any other text in the field (a person's name, a
  // PMID, a note) is kept as recorded but does not count as deposition.
  const ACCESSION_RE=/\b(GSE\d+|GSM\d+|E-MTAB-\d+|E-GEOD-\d+|PRJNA\d+|PRJEB\d+|PRJDB\d+|SRP\d+|ERP\d+|SRX\d+|PXD\d+|phs\d{6}(?:\.v\d+(?:\.p\d+)?)?|EGAS\d+|EGAD\d+|CRA\d+|HRA\d+)\b/i;
  function accessionOf(v){const m=ACCESSION_RE.exec(clean(v));return m?m[1]:'';}
  function hasAccession(p){return !!accessionOf(p.geo_accession);}
  function accessionNote(p){
    if(missing(p.geo_accession)||hasAccession(p))return '';
    return /\bPMID\b|\bdoi\b|10\.\d{4,}/i.test(p.geo_accession)?'Accession field holds a publication reference, not an accession':'Accession field holds other text, not an accession';
  }
  function suggestMap(headers){return Object.fromEntries(FIELDS.map(([k])=>[k,headers.find(h=>ALIASES[k].includes(norm(h)))||'']));}
  function canonical(record,map=DEFAULT_MAP){return Object.fromEntries(FIELDS.map(([k])=>[k,clean(record.raw[map[k]])]));}
  function parseDelimited(text,delimiter){
    text=String(text).replace(/^\uFEFF/,'');
    if(text.length>5_000_000)throw Error('Please use a metadata inventory smaller than 5 MB.');
    if(!delimiter){
      let quote=false,tab=0,comma=0;
      for(let i=0;i<text.length;i++){
        const c=text[i]; if(c==='"'){if(quote&&text[i+1]==='"')i++;else quote=!quote;}
        else if(!quote){if(c==='\n'||c==='\r')break;if(c==='\t')tab++;if(c===',')comma++;}
      } delimiter=tab>comma?'\t':',';
    }
    const rows=[]; let row=[],value='',quoted=false,afterQuote=false;
    const field=()=>{row.push(value);value='';afterQuote=false;};
    const line=()=>{field();if(row.some(x=>x.trim()))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;afterQuote=true;}}else value+=c;}
      else if(c==='"'&&value===''&&!afterQuote)quoted=true;
      else if(c===delimiter)field();
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line();}
      else {if(afterQuote&&!/\s/.test(c))throw Error('Unexpected text after a quoted field. Check the file delimiter.');value+=c;}
    }
    if(quoted)throw Error('An opening quote has no closing quote. Please check the source file.');
    if(value||row.length)line();
    if(rows.length<2)throw Error('Include a header row and at least one data row.');
    const headers=rows.shift().map(clean);
    if(headers.some(h=>!h))throw Error('Every column needs a header; source values can stay messy.');
    if(new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error('Duplicate column headers: give each column a distinct label.');
    if(rows.length>10000)throw Error('This prototype supports up to 10,000 project rows.');
    rows.forEach((r,i)=>{if(r.length!==headers.length)throw Error(`Data row ${i+1} has ${r.length} fields; expected ${headers.length}. Check commas, tabs and quotes.`);});
    return {headers,rows:rows.map((r,i)=>({key:`import-${i+2}`,row:i+2,raw:Object.fromEntries(headers.map((h,j)=>[h,r[j]]))})),delimiter};
  }
  function classify(p){const tags=classifyAssay(p),n=accessionNote(p);if(n)tags.push(n);return tags;}
  // Tags from the assay field alone. This is the only input a normalisation proposal may use, so that every
  // project sharing a source string gets the same proposed term (issue #11).
  function assayFromField(a){
    const tags=[];a=missing(a)?'':a;
    const fluidigm=/fluidigm|\bc1\b/i.test(a);
    if(fluidigm)tags.push('Fluidigm single-cell recorded');
    if(!fluidigm&&/10x|chromium|single[ -]?cell|scrna|sc[ -]?rna|indrops|parse|flex|gem-x|ocm/i.test(a)&&!/atac|multiome/i.test(a))tags.push('scRNA-seq recorded');
    if(/sn[ -]?rna|nuclei/i.test(a))tags.push('snRNA-seq recorded');
    if(/atac|multiome/i.test(a))tags.push('ATAC / multiome recorded');
    if(/bulk|rsem|plasmidsaurus|mrna[ -]?seq/i.test(a))tags.push('Bulk RNA-seq recorded');
    if(/cut\s*&\s*run|cut&tag|chip/i.test(a))tags.push('CUT&RUN / ChIP recorded');
    if(/micro ?array/i.test(a))tags.push('Microarray recorded');
    return tags;
  }
  function classifyAssay(p){
    const text=(missing(p.experiment_type)?'':p.experiment_type+' ')+p.Dataset_Name+' '+p.purpose_of_experiment;
    const tags=assayFromField(p.experiment_type);
    // The title and the assay field can disagree; surface it rather than trusting either.
    const titleBulk=/\bbulk\b/i.test(p.Dataset_Name),titleSingle=/scRNA|single[ -]cell|10x|snRNA/i.test(p.Dataset_Name);
    if(tags.length&&((titleBulk&&!tags.some(t=>/Bulk/.test(t)))||(titleSingle&&!tags.some(t=>/scRNA|snRNA|Fluidigm|ATAC/.test(t)))))tags.push('Title and assay field disagree');
    if(tags.length)return tags;
    // Below: hints from the title or purpose text. They are per project and never become a controlled term;
    // the normalisation table proposes nothing for them and the plan asks the owner to confirm the assay.
    if(/scRNA[ -]?seq|single[ -]cell RNA[ -]?seq|scRNAseq/i.test(text))tags.push('scRNA-seq in text, confirm assay');
    else if(/single[ -]cell/i.test(text))tags.push('single-cell in text, platform unclear, confirm assay');
    if(/sn[ -]?RNA[ -]?seq/i.test(text))tags.push('snRNA-seq in text, confirm assay');
    if(/scATAC|snATAC|ATAC[ -]?seq|multiome/i.test(text))tags.push('ATAC / multiome in text, confirm assay');
    if(/bulk RNA[ -]?seq/i.test(text))tags.push('Bulk RNA-seq in text, confirm assay');
    if(/CUT\s*&\s*RUN/i.test(text))tags.push('CUT&RUN in text, confirm assay');
    if(/flow cytometr|FACS/i.test(text))tags.push('flow cytometry in text, confirm assay');
    return tags.length?tags:['Assay type to confirm'];
  }
  // NCBI Taxonomy CURIEs for the organisms the inventories name. A mixed record gets none; the plan asks for one per sample.
  const TAXON={Human:'NCBITaxon:9606',Mouse:'NCBITaxon:10090',Zebrafish:'NCBITaxon:7955',Rat:'NCBITaxon:10116',Ferret:'NCBITaxon:9669'};
  // A contact field often carries a note in brackets ("Maria Serrano (folder owner; confirm trainee)").
  // The note is kept on the record; it never becomes part of the person's identity (issue #13).
  function personName(x){const m=clean(x).match(/^(.*?)\s*[\(\[](.*)[\)\]]\s*$/);return m?{name:clean(m[1]),note:clean(m[2])}:{name:clean(x),note:''};}
  function species(p){
    const x=p.genome_reference;
    if(missing(x))return {organism:'Unknown',assembly:'Unknown'};
    const hu=/human|homo sapiens|hg38|grch38/i.test(x),mo=/mouse|mus musculus|grcm39|mm10|mm39/i.test(x);
    const zf=/zebrafish|danio|grcz|danrer/i.test(x),fe=/ferret|mustela/i.test(x),rat=/\brat\b|rattus|rnor/i.test(x);
    let organism=hu&&mo?'Human and mouse (mixed)':hu?'Human':mo?'Mouse':zf?'Zebrafish':fe?'Ferret':rat?'Rat':'Unresolved';
    let assembly=(x.match(/GRCh38|GRCm39|GRCm38|hg38|hg19|mm10|mm39|GRCz11|GRCz10|danRer11|danRer10|Rnor_6\.0|mRatBN7/i)||[])[0]||'Not supplied';
    return {organism,assembly,taxon:TAXON[organism]||''};
  }
  const QUESTIONS = [
    {id:'rna',label:'Are the primary data files located?',options:[['unknown','Not yet checked'],['yes','Located'],['no','Unavailable for this project']],why:'A project description, viewer link or accession does not by itself establish access to the files.'},
    {id:'flow',label:'Are flow data available for this project?',options:[['unknown','Not yet checked'],['yes','Located'],['no','Unavailable for this project']],why:'Reporter expression does not establish that flow cytometry was performed.'},
    {id:'samples',label:'Can libraries and acquisitions be traced to samples and runs?',options:[['unknown','Not yet checked'],['yes','Crosswalk located'],['recover','Recoverable from records'],['no','Identifiers cannot be recovered']],why:'A project ID does not identify a biological sample, library, or differentiation run.'},
    {id:'relation',label:'How are the two assays related?',options:[['unknown','Not yet checked'],['same','Same recorded physical sample'],['aliquots','Sibling aliquots from a shared sample'],['run','Shared differentiation run only'],['condition','Similar condition only'],['none','No established relationship']],why:'Even shared samples do not establish matched individual cells.'},
    {id:'matrix',label:'What does the expression matrix represent?',options:[['unknown','Not yet checked'],['counts','Count matrix documented'],['processed','Only processed values located']],why:'A filename or an AnnData .raw slot is insufficient evidence of counts.'},
    {id:'replicates',label:'Are biological replicates and batch assignments documented?',options:[['unknown','Not yet checked'],['yes','Run / donor / line and batch documented'],['confounded','Condition and batch are inseparable']],why:'Cells and flow events are observations within biological replicates, not independent replicates.'},
    {id:'provenance',label:'Are processing and QC records available?',options:[['unknown','Not yet checked'],['yes','Versions, parameters and QC recorded']],why:'Keep biological QC distinct from file, identifier, and ingestion checks.'},
    {id:'annotation',label:'Are cell labels and gene identifiers documented?',options:[['unknown','Not yet checked'],['yes','Identifiers and annotation provenance recorded']],why:'Store annotation method, version, reviewer and reference, with stable gene identifiers.'},
    {id:'access',label:'Is permission for the intended reuse established?',options:[['unknown','Not yet checked'],['yes','Reuse terms documented'],['restricted','Restricted; authorization still needed']],why:'Accessible files or viewers do not establish permission for every reuse.'}
  ];
  const GOALS=[['joint','Joint flow + scRNA-seq analysis'],['rna','scRNA-seq reuse / comparison'],['share','Describe and share this dataset (any assay)']];
  function applicableQuestions(goal){
    if(goal==='share')return QUESTIONS.filter(q=>!['flow','relation','matrix'].includes(q.id));
    return QUESTIONS.filter(q=>goal==='joint'||!['flow','relation'].includes(q.id));
  }
  const READINESS_RULE='One point for each context field recorded (name, contact, assay, organism, purpose), two for a viewer link, one for a 2023 or later date; eight in total. Projects with a public accession are excluded. The score measures what the inventory records, not the quality of the data.';
  // Start-here ranking: projects that are nearly ready to share but have no public accession.
  // Score = recorded context fields (name, contact, assay, organism, purpose; 1 each) + viewer (2) + registered 2023 or later (1).
  function readiness(p){
    const ctx=['Dataset_Name','contact_person','experiment_type','genome_reference','purpose_of_experiment'].filter(f=>!missing(p[f])).length;
    const viewer=!missing(p.shinyapp_link)||!missing(p.analysis_visualization_link);
    const recent=/^(202[3-9]|20[3-9]\d)/.test(p.project_date);
    const missingCtx=['Dataset_Name','contact_person','experiment_type','genome_reference'].filter(f=>missing(p[f]));
    const next=missingCtx.length?'Recover '+missingCtx.map(f=>({Dataset_Name:'name',contact_person:'contact',experiment_type:'assay type',genome_reference:'organism'})[f]).join(', '):'Locate files, confirm reuse terms, deposit';
    return {score:ctx+(viewer?2:0)+(recent?1:0),viewer,recent,next,shared:hasAccession(p)};
  }
  // Ties are broken by evidence answered (reviews), then by the most recent date, and the rule is printed
  // on screen. shortlist also reports how many projects share the top score, so a top ten of equals is
  // never presented as a ranking (issue #12).
  const SHORTLIST_TIEBREAK='Ties are ordered by evidence answered, then by the most recent project date.';
  function shortlist(records,map,n=10,reviews={}){
    const answered=r=>{const a=(reviews[r.key]||{}).answers||{};return Object.values(a).filter(x=>x&&x.value&&x.value!=='unknown'&&clean(x.evidence)).length;};
    const all=records.map(r=>{const p=canonical(r,map);return {record:r,p,...readiness(p),answered:answered(r)};}).filter(x=>!x.shared)
      .sort((a,b)=>b.score-a.score||b.answered-a.answered||String(b.p.project_date).localeCompare(String(a.p.project_date)));
    const top=all.length?all[0].score:0,tied=all.filter(x=>x.score===top).length;
    const list=all.slice(0,n);list.tied=tied;list.top=top;list.total=all.length;return list;
  }
  // Which of the readiness fields a record has filled in, for the inventory summary.
  function completeness(records,map){
    const n=records.length||1,out={};
    for(const f of READINESS_FIELDS)out[f]=records.filter(r=>!missing(clean(r.raw[map[f]])))?.length||0;
    const viewer=records.filter(r=>!missing(clean(r.raw[map.shinyapp_link]))||!missing(clean(r.raw[map.analysis_visualization_link]))).length;
    const acc=r=>!!accessionOf(r.raw[map.geo_accession]);
    const geo=records.filter(acc).length;
    const accessionText=records.filter(r=>!missing(clean(r.raw[map.geo_accession]))&&!acc(r)).length;
    out.geo_accession=geo;
    return {n:records.length,fields:out,viewer,geo,accessionText,coreOnly:records.length-viewer-geo+records.filter(r=>acc(r)&&(!missing(clean(r.raw[map.shinyapp_link]))||!missing(clean(r.raw[map.analysis_visualization_link])))).length};
  }
  function answer(answers,id){const a=answers[id];return a&&clean(a.evidence)?a.value:'unknown';}
  function validAnswers(answers={}){
    const out={};for(const q of QUESTIONS){const a=answers[q.id];if(a&&q.options.some(o=>o[0]===a.value))out[q.id]={value:a.value,evidence:clean(a.evidence).slice(0,5000)};}return out;
  }
  function plan(record,map,answers={},goal='joint',allRecords=[]){
    const p=canonical(record,map),a=id=>answer(answers,id),actions=[];
    function add(id,priority,title,why,deliverable,owner,depends=[],check=''){
      actions.push({id,priority,title,why,deliverable,owner,depends,check:check||deliverable});
    }
    const tags=classify(p);
    const scopeMismatch=goal!=='share'&&tags.some(t=>/Bulk|CUT&RUN|ATAC|Microarray|Fluidigm/.test(t))&&!tags.some(t=>/scRNA|snRNA/.test(t));
    if(scopeMismatch)add('scope','1 · First','Confirm whether this is a single-cell RNA use case','The inventory explicitly describes another assay, without explicit scRNA-seq or snRNA-seq wording.','Confirm whether an associated single-cell RNA dataset exists; otherwise select a suitable project or develop a separate assay-specific plan.','Project lead',[],'The selected modality and intended use are supported by the source records.');
    const duplicates=allRecords.filter(r=>canonical(r,map).project_id===p.project_id).length;
    if(missing(p.project_id)||duplicates>1)add('identity','1 · First','Resolve project identity',missing(p.project_id)?'No project identifier is mapped.':'The same project identifier occurs in multiple inventory rows. Do not merge on title alone.','A unique project key with source-row crosswalk; determine whether repeated records are duplicates or separate datasets.','Data steward',[],'Every source row has a stable identity; any merges are documented.');
    if(missing(p.contact_person)||missing(p.Dataset_Name)||missing(p.purpose_of_experiment))add('context','1 · First','Recover missing project context','One or more name, contact or purpose fields are absent from the mapped inventory.','Complete the missing name, accountable contact and study purpose, citing the originating record.','Project lead');
    add('design','1 · First','Confirm study design and intended comparison','An inventory description is a lead, not a verified sample-level study design.','Study design with conditions, time points, biological unit, comparator and intended analysis; retain original free text.','Project lead',[], 'A scientist confirms the comparison and which biological units can support it.');
    if(a('rna')!=='yes')add('rna','1 · First',a('rna')==='no'?'Revise scope or recover the primary data':goal==='share'?'Locate the primary data files and their metadata':'Locate sequencing files and their metadata',a('rna')==='no'?'The user reports sequencing data unavailable. The proposed analysis is blocked.':'No sequencing data files have been inspected in this prototype.','File manifest: immutable file ID, path/accession, type, size, checksum, version and access owner; for sequencing, locate matrices/objects and cell, gene, sample and library tables.','Data custodian',[], 'The custodian can retrieve the files, and their relationship to this project is documented.');
    if(goal==='joint'&&a('flow')!=='yes')add('flow','1 · First',a('flow')==='no'?'Choose an RNA-only analysis or another paired project':'Establish whether flow data exist',a('flow')==='no'?'Flow is reported unavailable for this project. No paired analysis is justified.':'The inventory supplies reporter descriptions, not flow acquisition evidence.','Confirm flow availability; if present, locate FCS files, gating/workspace exports, panels, controls and measurement tables.','Experimental scientist',[], 'Flow availability and file locations are recorded, or the question is narrowed explicitly.');
    if(a('samples')!=='yes')add('samples','1 · First',a('samples')==='no'?'Stop sample-level integration until identity is recoverable':'Build the sample and run crosswalk',a('samples')==='no'?'The user reports unrecoverable sample identity. Similar labels cannot repair this gap.':'No sample-level crosswalk has been reviewed. Check the original columns and existing records before requesting new metadata.','Project → cell line/donor → differentiation run → sample → aliquot → library/acquisition; record evidence for every link.','Experimental scientist',['design'], 'All included libraries/acquisitions map unambiguously to samples and biological units; unresolved rows remain excluded.');
    if(goal==='joint'&&!['same','aliquots'].includes(a('relation')))add('relation','2 · Organize','Define the permitted cross-assay comparison','Current relationship: '+(QUESTIONS.find(q=>q.id==='relation').options.find(o=>o[0]===a('relation'))||[])[1]+'. Shared conditions or runs do not establish matched physical samples.','Document whether assays share a physical sample, sibling aliquots, run, or condition only; choose analysis at that supported level.','Project lead',['samples'], 'Each cross-assay link cites a crosswalk record and allowed comparison level; no inferred cell-to-cell pairing.');
    const sp=species(p);
    add('reference','2 · Organize','Separate organism, assembly and annotation version',`Source genome_reference: “${p.genome_reference||'(blank)'}”. Proposed organism: ${sp.organism}; assembly: ${sp.assembly}.`,'Separate organism label/ontology ID, genome assembly, gene annotation release and any reporter/custom reference sequences. Confirm from the processing reference.','Bioinformatician',['rna'],'Reference and annotation are verified from processing records, preserving the original field.');
    if(goal!=='share'&&a('matrix')!=='counts')add('matrix','2 · Organize',a('matrix')==='processed'?'Determine which analyses the processed matrix supports':'Resolve matrix meaning and processing history','Counts, normalized expression, scaled values and embeddings are not interchangeable.','Record matrix/layer location, transformation and unit. Recover counts if required by the intended method; otherwise document a narrower use.','Bioinformatician',['rna'], 'Every matrix/layer has documented semantics; the selected method accepts that representation.');
    if(a('annotation')!=='yes')add('annotation','2 · Organize',goal==='share'?'Document sample labels and feature identifiers':'Document cell annotations and gene identifiers',goal==='share'?'Labels, feature identifiers and their derivation are not captured by the inventory.':'Cell labels and their derivation are not captured by the inventory.','Cell ID scoped to library, sample ID, label, annotation method/version/reference/reviewer; gene ID, namespace/version and display symbol.','Bioinformatician',['samples','reference'], 'Cell and gene keys are unique in their scope; labels and feature identifiers are traceable.');
    if(goal==='joint')add('flow-model','2 · Organize','Structure flow populations, measurements and comparisons','A percentage is ambiguous without its parent population, gate and denominator.','Acquisition and panel tables; parent/child population IDs; count, denominator, percentage or intensity plus units/transformation; contrast linked to biological replicates.','Flow analyst',['flow','samples'], 'Population ancestry, gates, controls, denominator and units are explicit; comparisons use biological replicates.');
    if(a('replicates')!=='yes')add('replicates','2 · Organize',a('replicates')==='confounded'?'Restrict claims under condition–batch confounding':'Resolve biological replication and batch structure','Do not count individual cells or flow events as independent biological replicates.','A design table with donor/line/run, condition, time point, library/acquisition batch, exclusions and analysis unit.','Project lead',['samples'], 'The design supports the claimed contrast; inseparable condition/batch effects are flagged and claims restricted.');
    if(a('provenance')!=='yes')add('provenance','2 · Organize','Capture processing and both types of QC','Processing history, biological QC and ingestion validation require separate records.','Software/version, parameters, reference, inputs/outputs, cell/feature and sample QC, flow controls/gates, exclusions and rationale.','Bioinformatician',['rna'], 'Processing can be traced to inputs and parameters; biological QC and structural checks are independently documented.');
    if(a('access')!=='yes')add('access','1 · First','Establish reuse permissions',a('access')==='restricted'?'Reuse authorization is still required.':'Viewer links do not establish licensing, consent or permitted reuse.','Permission/consent constraints, license, access tier, steward and intended-use decision.','Data steward',[], 'The responsible steward records an allowed use and any controls before reuse.');
    if(goal==='share'&&!hasAccession(p))add('deposit','2 · Organize','Deposit or link the dataset in a public repository',(accessionNote(p)?accessionNote(p)+'. ':'No public accession is recorded for this project. ')+'A viewer is not a repository: it serves one analysis and cannot be cited, mirrored or reprocessed.','Submit raw and processed files with sample metadata to GEO/SRA (or the repository for the assay), then record the accession in the inventory.','Data custodian',['rna','samples','access'],'The accession resolves publicly and the inventory row carries it.');
    add('validate','3 · Validate','Validate the assembled package against the intended use','Answers here are user-reported planning evidence. The prototype has not inspected assay files or certified readiness.','Check required fields, unique keys, referential integrity, matrix dimensions, biological design, cross-assay evidence, QC, access and provenance; produce a reviewed exception log.','Data steward',actions.map(x=>x.id),'A scientist and data steward review actual files and resolve or explicitly exclude every blocking exception.');
    actions.sort((a,b)=>a.priority.localeCompare(b.priority));
    // Only show live dependencies; a supplied prerequisite is retained in the question evidence.
    const ids=new Set(actions.map(x=>x.id));actions.forEach(x=>x.depends=x.depends.filter(id=>ids.has(id)));
    const blockers=[];
    if(a('rna')==='no')blockers.push('Sequencing files unavailable');
    if(goal==='joint'&&a('flow')==='no')blockers.push('Flow unavailable for the joint use case');
    if(a('samples')==='no')blockers.push('Sample identity unrecoverable');
    if(a('replicates')==='confounded')blockers.push('Condition and batch confounded');
    if(a('access')==='restricted')blockers.push('Reuse authorization pending');
    const questions=applicableQuestions(goal),reported=questions.filter(q=>a(q.id)!=='unknown').length;
    return {project:p,actions,blockers,reported,totalQuestions:questions.length,status:blockers.length?'Scope change or recovery required':'Evidence gathering in progress'};
  }
  const MAPPING = [
    ['project_id','Project.project_id','Retain as supplied; test uniqueness. Do not use as a sample ID.'],
    ['Dataset_Name','Dataset.title → Project','Preserve text; confirm whether each row is a project, dataset, run or request. Similar titles are not duplicate proof.'],
    ['lab','Lab.name → Project.lab','Keep the recorded lab; where the inventory marks the assignment as inferred, carry that flag on the link.'],
    ['project_date','SourceRecord.date_text → Project.date (after review)','Registry convention: the date the Core opened the project. Confirm before using it as an acquisition date.'],
    ['contact_person','Contact.display_name → Project.contact','Propose aliases for review; do not merge “Lauren” with a full name without confirmation.'],
    ['genome_reference','Organism + ReferenceGenome + GeneAnnotation','Separate species and assembly; obtain annotation release from processing records. Preserve mixed source text.'],
    ['reporters','Reporter.description → CellLine / Sample (after review)','Retain original text and proposed controlled labels. No inference that flow data exist.'],
    ['experiment_type','Assay.label → OBI/EFO assay term (after normalisation)','Free text with many spellings per platform; map to one controlled term per record and keep the original string.'],
    ['purpose_of_experiment','StudyDesign.description + proposed Condition/Contrast','Extract candidates for scientific review; never make a design or sample count from prose alone.'],
    ['analysis_visualization_link','DataResource.url; role = visualization','Split multiple URLs into separate resource records. Link accessibility and underlying files are unverified.'],
    ['shinyapp_link','DataResource.url; role = Shiny viewer','Keep original URLs and project link. A viewer is not a raw data archive or reuse permission.'],
    ['geo_accession','DataResource.accession; role = public repository','The only field that makes a dataset citable and reprocessable by others. Absent for most records; recovering it is a curation task.']
  ];

  // ---------- v0.4: provenance, normalisation, query readiness, graph export ----------
  // Optional provenance columns an inventory may carry. Matched by alias like the planning fields.
  const PROV_FIELDS=[['lab_assignment','How the lab was assigned'],['purpose_source','Where the purpose text came from'],['category','Record category']];
  const PROV_ALIASES={lab_assignment:['labassignment','labsource','assignment'],purpose_source:['purposesource','descriptionsource','textsource'],category:['category','recordtype','projecttype']};
  function provenanceMap(headers){return Object.fromEntries(PROV_FIELDS.map(([k])=>[k,headers.find(h=>norm(h)===k.replace(/_/g,'')||PROV_ALIASES[k].includes(norm(h)))||'']));}
  // Provenance grade for a value: how it got into the inventory. Lowest grade wins when several apply.
  function provenanceOf(record,pmap,field){
    const raw=record.raw||{};
    if(field==='lab'){const v=clean(raw[pmap.lab_assignment]).toLowerCase();return v==='recorded'?'recorded':v==='inferred'?'inferred':v==='none'?'absent':'recorded';}
    if(field==='purpose_of_experiment'){const v=clean(raw[pmap.purpose_source]).toLowerCase();if(/llm/.test(v))return 'llm_written';if(/suspect|fallback/.test(v))return 'suspect';return 'recorded';}
    return 'recorded';
  }
  // Normalisation: proposed controlled term per distinct source string, for assay and organism.
  const NORM_TARGETS={experiment_type:{label:'Assay type',ontology:'OBI / EFO assay term',namespace:'OBI: or EFO:',biolink:'biolink:Procedure',propose:p=>{const t=assayFromField(p.experiment_type);return t.length?t[0].replace(/ recorded$/,''):'';}},
                      genome_reference:{label:'Organism',ontology:'NCBITaxon',namespace:'NCBITaxon:',biolink:'biolink:OrganismTaxon',propose:p=>{const sp=species(p);return sp.taxon?`${sp.organism} (${sp.taxon})`:'';}}};
  function normTable(records,map,overrides={}){
    const out={};
    for(const f of Object.keys(NORM_TARGETS)){
      const seen=new Map();
      for(const r of records){const p=canonical(r,map);const v=clean(p[f]);if(missing(v))continue;if(!seen.has(v))seen.set(v,{original:v,count:0,proposed:NORM_TARGETS[f].propose(p)});seen.get(v).count++;}
      out[f]=[...seen.values()].sort((a,b)=>b.count-a.count).map(x=>({...x,term:(overrides[f]?.[x.original]?.term)??x.proposed,reviewer:overrides[f]?.[x.original]?.reviewer||'',status:overrides[f]?.[x.original]?'reviewed':x.proposed?'proposed':'unmapped'}));
    }
    return out;
  }
  function termFor(norm,field,value){const row=(norm[field]||[]).find(x=>x.original===clean(value));return row?row.term:'';}
  // Query readiness: what a question needs from the inventory and the evidence register. Each need is a
  // test over the canonical record, its tags, the assay term and the recorded answers. Edit QUERIES for
  // your own center; the mechanism is generic.
  const yes=(a,id,...vals)=>{const x=a&&a[id];return !!(x&&clean(x.evidence)&&(vals.length?vals.includes(x.value):x.value!=='unknown'&&x.value!=='no'));};
  const QUERIES=[
    {id:'markers',title:'Which clusters, across all experiments, have SFTPC and NKX2-1 among their top markers?',source:'CReM-KG explainer, use 1',needs:[
      ['single-cell assay recorded',(p,t)=>t.some(x=>/^(scRNA|snRNA|Fluidigm single-cell|ATAC \/ multiome).* recorded$/.test(x))],
      ['expression files located',(p,t,a)=>yes(a,'rna','yes')],
      ['cell labels and gene identifiers documented',(p,t,a)=>yes(a,'annotation','yes')]]},
    {id:'lines',title:'Which of our lines model cells where a given disease gene acts?',source:'CReM-KG explainer, metapath Disease to Gene to Cell type to iPSC line',needs:[
      ['line or reporter recorded',p=>!missing(p.reporters)],
      ['organism resolved',p=>!['Unknown','Unresolved'].includes(species(p).organism)],
      ['contrast or marker results with processing records',(p,t,a)=>yes(a,'provenance','yes')],
      ['libraries traced to samples and lines',(p,t,a)=>yes(a,'samples','yes','recover')]]},
    {id:'q3',title:'Which lines were ever put through a media swap that induced KRT17, which have matched ATAC, and do the retained-accessibility lines share a donor feature?',source:'Carlos, query 3',needs:[
      ['line or reporter recorded',p=>!missing(p.reporters)],
      ['study design with conditions and time points confirmed',(p,t,a)=>yes(a,'replicates','yes')],
      ['ATAC paired to the same sample or sibling aliquot',(p,t,a)=>yes(a,'relation','same','aliquots')],
      ['files located',(p,t,a)=>yes(a,'rna','yes')]]},
    {id:'q2',title:'Which projects have cells within a distance of the mouse pre-SKAAR region of a shared latent space, whatever the original cluster was called?',source:'Carlos, query 2 (needs a shared embedding)',needs:[
      ['count matrix documented',(p,t,a)=>yes(a,'matrix','counts')],
      ['cell labels mapped to an ontology',(p,t,a)=>yes(a,'annotation','yes')],
      ['organism and assembly resolved',p=>species(p).assembly!=='Not supplied'],
      ['reuse permitted',(p,t,a)=>yes(a,'access','yes')]]},
    {id:'q1',title:'Across every line, protocol, medium and time point, which conditions produce a trapped SKAAR-like state, and which untried condition would flatten the basin?',source:'Carlos, query 1 (needs a causal model of fate; the horizon, not a deliverable)',horizon:true,needs:[
      ['everything above, for every project',()=>false],
      ['protocol versions and media linked to runs',()=>false],
      ['a validated causal model of differentiation',()=>false]]}
  ];
  function queryReadiness(records,map,reviews={}){
    return QUERIES.map(q=>{
      const per=q.needs.map(()=>0);let ready=0;
      for(const r of records){const p=canonical(r,map),t=classify(p),a=(reviews[r.key]||{}).answers||{};let all=true;q.needs.forEach(([,test],i)=>{let ok=false;try{ok=!!test(p,t,a);}catch{ok=false;}if(ok)per[i]++;else all=false;});if(all)ready++;}
      const limiting=q.needs.map(([label],i)=>[label,per[i]]).sort((x,y)=>x[1]-y[1])[0];
      return {id:q.id,title:q.title,source:q.source,horizon:!!q.horizon,ready,n:records.length,needs:q.needs.map(([label],i)=>({label,count:per[i]})),limiting};
    });
  }
  // Provenance vocabulary: LemonAId's plain word, mapped to Biolink edge properties (knowledge_level,
  // agent_type, primary_knowledge_source) so a Biolink-aligned loader (OptimusKG / CReM-KG) can take it as is.
  const PROVENANCE={
    recorded:      {meaning:'Present in the source inventory as written',               knowledge_level:'knowledge_assertion',   agent_type:'manual_agent',                         source:'inventory'},
    inferred:      {meaning:'Derived by the inventory compiler (for example lab from folder paths)', knowledge_level:'observation', agent_type:'data_analysis_pipeline',          source:'inventory'},
    absent:        {meaning:'The inventory has no value; the edge is a placeholder',    knowledge_level:'not_provided',          agent_type:'not_provided',                         source:'inventory'},
    normalised:    {meaning:'Controlled term proposed by LemonAId; source string kept as evidence', knowledge_level:'knowledge_assertion', agent_type:'automated_agent',        source:'lemonaid'},
    reviewed:      {meaning:'Controlled term confirmed by a named reviewer',            knowledge_level:'knowledge_assertion',   agent_type:'manual_validation_of_automated_agent', source:'lemonaid'},
    user_reported: {meaning:'Answer recorded on screen 03 with evidence named',         knowledge_level:'observation',           agent_type:'manual_agent',                         source:'lemonaid'},
    file_header:   {meaning:'Read from an FCS header; marker and fluorochrome agree with one reagent', knowledge_level:'observation', agent_type:'data_analysis_pipeline',     source:'file'},
    proposed:      {meaning:'Header label plus detector convention picks the conjugate', knowledge_level:'prediction',           agent_type:'automated_agent',                      source:'file'},
    candidate:     {meaning:'Marker matched; several conjugates possible; a person chooses', knowledge_level:'prediction',       agent_type:'automated_agent',                      source:'file'}
  };
  // Graph export: one row per node and per edge, project level, with provenance on every edge.
  // Node labels follow the CReM-KG nouns where the inventory can support them; sample, contrast and
  // gene nodes appear only once sample-level data have been ingested, so they are not invented here.
  // Panel manifest rows (from tools/fcs_panel_manifest.py): file, detector, stain_label, match, reagent_ids
  function parseManifest(text){try{const p=parseDelimited(text);return p.rows.map(r=>r.raw).filter(r=>r.file&&r.reagent_ids);}catch{return [];}}
  function graphExport(records,map,pmap,reviews={},norm={},reagents=[],opts={}){
    const nodes=new Map(),edges=[];
    const node=(id,label,name,props={})=>{if(!nodes.has(id))nodes.set(id,{id,label,name,...props});return id;};
    const sourceName=(opts.sourceName||'inventory');
    const edge=(s,rel,t,prov,src,evidence='')=>{const p=PROVENANCE[prov]||PROVENANCE.recorded;edges.push({source:s,relation:rel,target:t,provenance:prov,knowledge_level:p.knowledge_level,agent_type:p.agent_type,primary_knowledge_source:p.source==='inventory'?'infores:'+slug(sourceName):p.source==='file'?'infores:file-header':'infores:lemonaid',source_record:src,evidence});};
    const slug=x=>clean(x).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    for(const r of records){
      const p=canonical(r,map),src=`row ${r.row}`,rev=reviews[r.key]||{},a=rev.answers||{};
      const pid=node('project:'+slug(p.project_id||'row-'+r.row),'Project',p.Dataset_Name||p.project_id,{biolink_category:'biolink:Study',project_id:p.project_id,date:p.project_date,purpose:p.purpose_of_experiment,purpose_provenance:provenanceOf(r,pmap,'purpose_of_experiment'),source_row:r.row});
      if(!missing(p.lab))for(const l of p.lab.split(/;\s*/)){const lid=node('lab:'+slug(l),'Lab',l,{biolink_category:'biolink:Agent'});edge(pid,'IN_LAB',lid,provenanceOf(r,pmap,'lab'),src);}
      if(!missing(p.contact_person)){const nm=personName(p.contact_person);const cid=node('person:'+slug(nm.name),'Person',nm.name,{biolink_category:'biolink:Agent',note:nm.note});edge(pid,'HAS_CONTACT',cid,'recorded',src,nm.note?'note in source: '+nm.note:'');}
      const normProv=(f,v)=>{const row=(norm[f]||[]).find(x=>x.original===clean(v));return row&&row.reviewer?'reviewed':'normalised';};
      if(!missing(p.genome_reference)){const term=termFor(norm,'genome_reference',p.genome_reference)||species(p).organism;const sp=species(p),curie=(term.match(/NCBITaxon:\d+/)||[])[0]||(term===sp.organism?sp.taxon:'');const oid=node(curie||'organism:'+slug(term),'Organism',term.replace(/\s*\(NCBITaxon:\d+\)$/,''),{biolink_category:'biolink:OrganismTaxon',ontology:curie?'NCBITaxon':'NCBITaxon (to resolve)'});edge(pid,'USES_ORGANISM',oid,term===p.genome_reference?'recorded':normProv('genome_reference',p.genome_reference),src,'source string: '+p.genome_reference);}
      if(!missing(p.experiment_type)){const term=termFor(norm,'experiment_type',p.experiment_type)||p.experiment_type;const aid=node('assay:'+slug(term),'Assay',term,{biolink_category:'biolink:Procedure',ontology:'OBI/EFO (to resolve)'});edge(pid,'HAS_ASSAY',aid,term===p.experiment_type?'recorded':normProv('experiment_type',p.experiment_type),src,'source string: '+p.experiment_type);}
      if(!missing(p.reporters)){const rid=node('reporter:'+slug(p.reporters).slice(0,60),'ReporterDescription',p.reporters,{biolink_category:'biolink:InformationContentEntity'});edge(pid,'USES_REPORTER',rid,'recorded',src,'free text; resolve to iPSC line and gene symbols at sample ingest');}
      for(const [f,role] of [['shinyapp_link','Shiny viewer'],['analysis_visualization_link','Interactive viewer']])if(!missing(p[f]))for(const u of p[f].split(/;\s*/)){const did=node('resource:'+slug(u).slice(0,80),'DataResource',u,{biolink_category:'biolink:InformationResource',role});edge(pid,'HAS_RESOURCE',did,'recorded',src);}
      const acc=accessionOf(p.geo_accession);
      if(acc){const gid=node('accession:'+slug(acc),'DataResource',acc,{biolink_category:'biolink:InformationResource',role:'Public repository accession'});edge(pid,'DEPOSITED_AS',gid,'recorded',src);}
      // panel manifest: data files and the reagents their headers name
      const man=rev.validation&&rev.validation.panel?parseManifest(rev.validation.panel):[];
      const seenFiles=new Set();
      for(const row of man){const fid='file:'+slug(p.project_id||'row-'+r.row)+':'+slug(row.file).slice(0,80);if(!seenFiles.has(fid)){seenFiles.add(fid);node(fid,'DataFile',row.file,{biolink_category:'biolink:InformationContentEntity',format:'FCS'});edge(pid,'HAS_FILE',fid,'recorded',src,'listed in panel manifest');}
        const prov=row.match==='exact'?'file_header':row.match==='detector'?'proposed':'candidate';
        for(const rid of String(row.reagent_ids).split(';').map(clean).filter(Boolean)){const rg=reagents.find(x=>x.id===rid);const nid=node('reagent:'+slug(rid),'Reagent',rg?`${rg.marker} ${rg.conjugation||''}`.trim():rid,rg?{biolink_category:'biolink:ChemicalEntity',reagent_id:rg.id,marker:rg.marker,clone:rg.clone,catalog:rg.catNo,conjugation:rg.conjugation,vendor:rg.vendor,module:rg.module}:{reagent_id:rid});edge(fid,'STAINED_WITH',nid,prov,src,`label "${row.stain_label}" on ${row.detector}; match: ${row.match}`);}}
      for(const q of QUESTIONS){if(a[q.id]&&clean(a[q.id].evidence)){const sid=node('state:'+q.id+':'+a[q.id].value,'EvidenceState',q.label+' = '+(q.options.find(o=>o[0]===a[q.id].value)||[])[1],{biolink_category:'biolink:InformationContentEntity'});edge(pid,'HAS_EVIDENCE',sid,'user_reported',src,a[q.id].evidence);}}
    }
    return {nodes:[...nodes.values()],edges};
  }


  // ---------- v0.5: sample-sheet reader ----------
  // Validates a sample sheet against a file listing. Every check returns pass, fail, recoverable,
  // unknown or not_applicable with a reason, a repair action, a suggested owner and a done check.
  // Nothing is repaired; the sheet and the listing are read, never written.
  const DATA_EXT=/\.(fastq\.gz|fq\.gz|fastq|fq|fcs|bam|cram|h5ad|h5|rds|mtx(\.gz)?|loom|tiff?|czi|nd2)$/i;
  const base=p=>String(p).replace(/\\/g,'/').split('/').pop();
  function detectColumns(headers,rows){
    const H=headers.map(h=>[h,norm(h)]);
    const id=(H.find(([,n])=>/^(sampleid|sample|uniqueid|id|libraryid|library|tube|specimen)$/.test(n))||H.find(([,n])=>/sampleid|uniqueid/.test(n))||H[0])[0];
    const files=headers.filter(h=>h!==id&&(/file|fastq|fq|path|fcs|bam|url/i.test(h)||rows.slice(0,20).some(r=>DATA_EXT.test(clean(r.raw[h])))));
    const ignore=new Set([id,...files,...headers.filter(h=>/^(notes?|comment|seqindex|index|lane|md5|sha|checksum|flowcell|barcode|exclude)/.test(norm(h)))]);
    const control=headers.find(h=>/^(iscontrol|control|isctrl|ctrl)$/.test(norm(h)))||'';
    ignore.add(control);
    const design=headers.filter(h=>!ignore.has(h));
    return {id,files,design,control};
  }
  const CONTROL_RX=/(^|[^a-z0-9])(igg|input|blank|unstained|negative|neg|dapi|isotype|fmo|single.?stain|beads?|reference|ctrl|control)(?=$|[^a-z0-9])/i;
  function validateSampleSheet(sheetText,listingText,opts={}){
    // Lines without the sheet's delimiter are kept as notes (a path, a comment), not parsed as samples.
    const lines=String(sheetText).replace(/^\uFEFF/,'').split(/\r?\n/);
    const head=lines.find(l=>l.trim())||'';const delim=(head.match(/\t/g)||[]).length>=(head.match(/,/g)||[]).length?'\t':',';
    const notes=[],kept=[];for(const l of lines){if(l.trim()&&!l.includes(delim)&&kept.length)notes.push(l.trim());else kept.push(l);}
    const sheet=parseDelimited(kept.join('\n'),delim);
    const listing=String(listingText||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.replace(/^\.\//,''));
    const listSet=new Set(listing),baseIndex=new Map();
    for(const l of listing){const b=base(l);if(!baseIndex.has(b))baseIndex.set(b,[]);baseIndex.get(b).push(l);}
    const exclRows=String(opts.excludedText||'').split(/\r?\n/).map(x=>x.split(/\t|,/).map(clean)).filter(r=>r[0]&&!/^(sample|id|unique|filename|file)/i.test(r[0]));
    const excluded=new Set(exclRows.map(r=>r[0]));const exclReason=Object.fromEntries(exclRows.map(r=>[r[0],r.slice(1).filter(x=>/[a-z]{4,}/i.test(x)).pop()||'']));
    const isExcluded=(id,refs,resolved)=>{if(excluded.has(id))return id;const exact=[...excluded].find(e=>resolved.some(f=>base(f)===base(e)));if(exact||resolved.length)return exact||'';return [...excluded].find(e=>refs.some(f=>{const eb=base(e),fb=base(f);return eb===fb||eb.endsWith('_'+fb)||eb.endsWith('-'+fb)||fb.endsWith('_'+eb);}))||'';};
    const cols=detectColumns(sheet.headers,sheet.rows);
    const rows=[],referenced=new Set();
    const seen=new Map();
    for(const r of sheet.rows){
      const id=clean(r.raw[cols.id]);const checks=[];
      const add=(check,status,reason,repair='',owner='',done='')=>checks.push({check,status,reason,repair,owner,done});
      // identity
      if(!id)add('identity','fail','No sample identifier in this row.','Assign a stable sample ID and record where it came from.','Experimental scientist','Every row has a non-empty, unique ID.');
      else if(seen.has(id))add('identity','fail',`Sample ID repeats row ${seen.get(id)}.`,'Decide whether the rows are one sample or two; rename or merge with a note.','Experimental scientist','IDs are unique.');
      else {seen.set(id,r.row);add('identity','pass','Unique sample ID.');}
      // files
      const refs=cols.files.map(h=>clean(r.raw[h])).filter(x=>!missing(x));const resolved=[];
      if(!cols.files.length)add('files','not_applicable','The sheet has no file column.','Add a column with the path or filename of each primary data file.','Data custodian','Each sample names at least one file.');
      else if(!refs.length)add('files','unknown','Row names no file.','Fill in the file for this sample, or mark the sample as having no data.','Data custodian','Each sample names at least one file.');
      else for(const f of refs){
        const exact=listSet.has(f)||listSet.has(f.replace(/^\.\//,''));
        if(exact){referenced.add(f);resolved.push(f);add('file:'+base(f),'pass','File present in the listing.');continue;}
        const b=base(f),stem=b.replace(/\.[^.]+$/,'');
        // match on a whole-name boundary: exact basename, or basename ending in <sep><sheet name>
        let uniq=[...new Set((baseIndex.get(b)||[]).concat([...listSet].filter(l=>{const lb=base(l);return lb===b||/[_\-. ]/.test(lb.charAt(lb.length-b.length-1))&&lb.endsWith(b);})))];
        // several candidates: prefer the one that carries one of this row's design values (a stage, a genotype)
        if(uniq.length>1){const vals=cols.design.map(h=>clean(r.raw[h])).filter(v=>!missing(v)&&v.length>1);const narrowed=uniq.filter(l=>vals.some(v=>base(l).toLowerCase().includes(v.toLowerCase())));if(narrowed.length)uniq=narrowed;}
        if(uniq.length===1){referenced.add(uniq[0]);resolved.push(uniq[0]);add('file:'+base(f),'recoverable',`Not found as written; one file matches by name: ${uniq[0]}`,'Confirm the match and write the exact path into the sheet.','Data custodian','The sheet path resolves exactly.');}
        else if(uniq.length>1){add('file:'+base(f),'recoverable',`Not found as written; ${uniq.length} candidates share the name: ${uniq.slice(0,3).join('; ')}${uniq.length>3?' …':''}`,'Choose the right file and write its exact path.','Data custodian','One file per reference, resolved exactly.');}
        else add('file:'+base(f),'fail',`File not in the listing: ${f}`,'Locate the file, restore it from the source, or mark the sample as missing data.','Data custodian','The file exists at the recorded path, with a checksum.');
      }
      // paired reads
      const r1=refs.find(x=>/_R1[_.]|_1\.f(ast)?q/i.test(x)),r2=refs.find(x=>/_R2[_.]|_2\.f(ast)?q/i.test(x));
      if(r1||r2)add('pairing',r1&&r2?'pass':'fail',r1&&r2?'Both read files named.':'Only one read of a pair is named.',r1&&r2?'':'Name both R1 and R2, or state that the library is single-end.','Data custodian','Paired libraries name both reads.');
      // design completeness
      const blanks=cols.design.filter(h=>missing(r.raw[h]));
      const isControl=(cols.control&&/^(yes|true|1|y)$/i.test(clean(r.raw[cols.control])))||CONTROL_RX.test(id)||refs.some(x=>CONTROL_RX.test(base(x)));
      if(!cols.design.length)add('design','not_applicable','No design columns detected.','Add condition, time point and replicate columns.','Project lead','Every sample has its design variables recorded.');
      else if(blanks.length&&!isControl)add('design','fail',`Design fields empty: ${blanks.join(', ')}.`,'Fill the design fields or record why they do not apply.','Project lead','Every non-control sample has all design fields.');
      else if(blanks.length&&isControl)add('design','not_applicable',`Control tube; design fields empty: ${blanks.join(', ')}.`,'','','');
      else add('design','pass','Design fields complete.');
      if(cols.control)add('control','pass',isControl?'Flagged as a control.':'Flagged as not a control.');
      else if(isControl)add('control','unknown','Named like a control, but the sheet has no control column.','Add an explicit control column.','Experimental scientist','Controls are flagged by a column, not inferred from names.');
      const exKey=isExcluded(id,refs,resolved);
      if(exKey)add('excluded','not_applicable',`Listed in the exclusion file${exclReason[exKey]?' ('+exclReason[exKey]+')':''}.`,'Keep the exclusion reason on the sample row, not only in a separate file.','Experimental scientist','Exclusions are recorded on the sample row.');
      rows.push({row:r.row,id,isControl,excluded:!!exKey,design:Object.fromEntries(cols.design.map(h=>[h,clean(r.raw[h])])),checks});
    }
    // replicates per condition, non-control rows
    const groups=new Map();
    for(const x of rows){if(x.isControl||x.excluded)continue;const key=cols.design.filter(h=>!/replicate|rep|embryo|animal|donor|well/i.test(h)).map(h=>x.design[h]).join(' | ');groups.set(key,(groups.get(key)||0)+1);}
    const replicates=[...groups.entries()].map(([condition,n])=>({condition,n,status:n>=3?'pass':n===2?'unknown':'fail',reason:n===1?'n = 1: no biological replicate. Any comparison involving this condition is descriptive.':n===2?'n = 2: a comparison is possible but weakly powered.':'n ≥ 3.'}));
    // derived files: data files named after a sample (trimmed reads, alignments, tracks) are credited to it
    const ids=[...seen.keys()].filter(id=>!/^\d{1,3}$/.test(id)).sort((a,b)=>b.length-a.length);
    const derived=new Map();
    for(const l of listing){if(!DATA_EXT.test(l)||referenced.has(l))continue;const b=base(l);const hit=ids.find(id=>b===id||b.startsWith(id+'.')||b.startsWith(id+'_')||b.startsWith(id+'-')||b.includes('_'+id+'_')||b.includes('_'+id+'.'));if(hit){if(!derived.has(hit))derived.set(hit,[]);derived.get(hit).push(l);referenced.add(l);}}
    for(const x of rows){const d=derived.get(x.id)||[];x.derived=d.length;if(d.length)x.checks.push({check:'derived','status':'pass',reason:`${d.length} derived file${d.length>1?'s':''} on disk carry this sample ID (${[...new Set(d.map(f=>f.split('/').slice(0,-1).join('/')))].slice(0,4).join(', ')}).`});}
    // orphans
    const PRODUCT_RX=/(^|\/)(output|outputs|results|figures|figs|reports?|analysis|processed|archive)(\/|$)/i;
    const products=listing.filter(l=>DATA_EXT.test(l)&&!referenced.has(l)&&PRODUCT_RX.test(l));
    const orphans=listing.filter(l=>DATA_EXT.test(l)&&!referenced.has(l)&&!CONTROL_RX.test(base(l))&&!PRODUCT_RX.test(l));
    const controlsOnDisk=listing.filter(l=>DATA_EXT.test(l)&&!referenced.has(l)&&CONTROL_RX.test(base(l))&&!PRODUCT_RX.test(l));
    const counts={};for(const x of rows)for(const c of x.checks)counts[c.status]=(counts[c.status]||0)+1;
    const summary={rows:rows.length,notes,columns:cols,counts,products:products.length,orphans:orphans.length,controlsOnDisk:controlsOnDisk.length,derived:[...derived.values()].reduce((a,b)=>a+b.length,0),replicates};
    const actions=[];
    if(counts.fail)actions.push({title:`Resolve ${counts.fail} failed check${counts.fail>1?'s':''}`,owner:'Data custodian',done:'No row fails identity, file or design checks.'});
    if(counts.recoverable)actions.push({title:`Confirm ${counts.recoverable} name-based file match${counts.recoverable>1?'es':''} and write exact paths`,owner:'Data custodian',done:'Every file reference resolves exactly, no name matching needed.'});
    if(orphans.length)actions.push({title:`Account for ${orphans.length} data file${orphans.length>1?'s':''} on disk that no sample names`,owner:'Experimental scientist',done:'Every data file is either referenced by a sample or listed with a reason.'});
    if(replicates.some(r=>r.status==='fail'))actions.push({title:'State that conditions have n = 1 in the project README and in any claim',owner:'Project lead',done:'The replicate structure is written down where results are read.'});
    if(!cols.control&&rows.some(x=>x.isControl)&&!actions.some(a=>/control column/.test(a.title)))actions.push({title:'Add an explicit control column instead of relying on names',owner:'Experimental scientist',done:'Controls are flagged by a column, not inferred.'});
    return {sheet:{headers:sheet.headers,rows:rows.length,notes},columns:cols,rows,replicates,orphans,products,controlsOnDisk,derived:Object.fromEntries(derived),summary,actions};
  }

  function csv(rows){return rows.map(r=>r.map(x=>{let s=String(x??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
  const api={FIELDS,READINESS_FIELDS,READINESS_RULE,SHORTLIST_TIEBREAK,personName,PROVENANCE,GOALS,PROV_FIELDS,NORM_TARGETS,QUERIES,provenanceMap,provenanceOf,normTable,termFor,queryReadiness,graphExport,parseManifest,validateSampleSheet,detectColumns,DEFAULT_MAP,missing,accessionOf,hasAccession,accessionNote,canonical,parseDelimited,suggestMap,classify,species,QUESTIONS,applicableQuestions,completeness,readiness,shortlist,answer,validAnswers,plan,MAPPING,csv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CREM=api;
})(typeof window!=='undefined'?window:globalThis);
