const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const E=require('../src/engine.js');
const dataFile=fs.existsSync(path.join(__dirname,'../src/data.js'))?'../src/data.js':'../src/data.blank.js';
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,dataFile),'utf8'),sandbox);
const D=JSON.parse(JSON.stringify(sandbox.window.CREM_DATA));
// Registry-dependent tests run only when a CReM registry data.js is present (it is not in the public repo).
const HAS_REGISTRY=D.records.length>0;const reg=HAS_REGISTRY?test:test.skip;
const row=D.records.find(r=>r.raw.project_id==='25_06_24_lauren')||{key:'fx-1',row:2,raw:{Lab_PI:'Example Lab',project_id:'25_06_24_lauren',Dataset_Name:'scATAC and RNAseq of TGFB-treated iAT2s',project_date:'2025-06-24',contact_person:'Example contact',genome_reference:'Human (Hg38)',reporters:'SFTPC-tdTomato, KRT17-GFP',experiment_type:'10X scRNAseq (OCM)',purpose_of_experiment:'Parallel runs of scATAC-seq and scRNA-seq.',analysis_visualization_link:'NA',shinyapp_link:'NA',geo_accession:'NA',category:'Investigator',lab_assignment:'recorded',purpose_source:'master_index'}};
const m=E.DEFAULT_MAP;
const answer=value=>({value,evidence:'Test evidence: sample crosswalk reviewed by scientist.'});
const planned=(a={},goal='joint',r=row,records=D.records)=>E.plan(r,m,a,goal,records);
const has=(p,id)=>p.actions.some(a=>a.id===id);
reg('409 registry records are retained once, with row-level source provenance',()=>{
 assert.equal(D.records.length,409);assert.equal(new Set(D.records.map(r=>r.key)).size,409);assert.equal(new Set(D.records.map(r=>r.raw.project_id)).size,409);assert.equal(row.row,211);
 assert.equal(D.source.sheet,'All projects');assert.match(D.source.sha256,/^[a-f0-9]{64}$/);assert.equal(D.source.default_selected,row.key);
});
reg('registry fields map by default and the assay label drives classification',()=>{
 assert.equal(m.project_date,'project_date');assert.equal(m.lab,'Lab_PI');
 const c=E.canonical(row,m);assert.equal(c.lab,'Kotton Lab');assert.equal(c.experiment_type,'10X scRNAseq (OCM)');assert.deepEqual(E.classify(c),['scRNA-seq recorded']);
 const legacy=E.suggestMap(['project_id','project_data','Dataset_Name']);assert.equal(legacy.project_date,'project_data');
 assert.deepEqual(E.classify({experiment_type:'single-cell RNAseq Fluidigm',Dataset_Name:'',purpose_of_experiment:''}),['Fluidigm single-cell recorded']);
});
reg('completeness counts filled fields and public reach without double counting',()=>{
 const c=E.completeness(D.records,m);assert.equal(c.n,409);assert.ok(c.fields.purpose_of_experiment>400);assert.equal(c.fields.geo_accession,c.geo);assert.ok(c.geo>=15&&c.geo<=20,'only repository identifiers count: '+c.geo);assert.ok(c.accessionText>=15,'names in the accession field are counted separately: '+c.accessionText);
 assert.ok(c.viewer>c.geo);assert.ok(c.fields.Dataset_Name<c.fields.contact_person);
});
reg('describe-and-share use case is assay agnostic: no scope, flow, relation or matrix actions',()=>{
 const bulk=D.records.find(r=>r.raw.project_id==='24_09_16_Jonathan');const p=E.plan(bulk,m,{},'share',D.records);
 for(const id of ['scope','flow','relation','matrix','flow-model'])assert.ok(!has(p,id),id);assert.ok(has(p,'deposit'));assert.ok(has(p,'validate'));assert.equal(p.totalQuestions,6);
 const pub=D.records.find(r=>E.accessionOf(r.raw.geo_accession));assert.ok(!has(E.plan(pub,m,{},'share',D.records),'deposit'));
 const named=D.records.find(r=>!E.missing(r.raw.geo_accession)&&!E.accessionOf(r.raw.geo_accession));assert.ok(has(E.plan(named,m,{},'share',D.records),'deposit'),'a name in the accession field is not a deposit');
});
test('only repository identifiers count as accessions; other text is kept and flagged',()=>{
 assert.equal(E.accessionOf(' GSE142246 '),'GSE142246');assert.equal(E.accessionOf('E-MTAB-8495'),'E-MTAB-8495');assert.equal(E.accessionOf('see PRJNA123456 and GSE1'),'PRJNA123456');
 assert.equal(E.accessionOf('Porter Dooley'),'');assert.equal(E.accessionOf('NA'),'');
 const named={geo_accession:'Porter Dooley',experiment_type:'10X scRNAseq',Dataset_Name:'',purpose_of_experiment:''};
 assert.equal(E.hasAccession(named),false);assert.match(E.accessionNote(named),/other text/);assert.ok(E.classify(named).includes('Accession field holds other text, not an accession'));
 assert.match(E.accessionNote({geo_accession:'Irit Milman Krentsis. PMID: 39178253'}),/publication reference/);
 assert.equal(E.accessionNote({geo_accession:'GSE128922'}),'');assert.equal(E.accessionNote({geo_accession:'NA'}),'');
 assert.equal(E.readiness({...named,project_date:'2026-01-01'}).shared,false);
});
test('CSV/TSV parser preserves quoted delimiters, escaped quotes, CRLF and multiline fields',()=>{
 const p=E.parseDelimited('\uFEFFid\tdescription\r\na\t"two\tfields and ""quotes""\nsecond line"\r\n');
 assert.equal(p.rows[0].raw.description,'two\tfields and "quotes"\nsecond line');assert.equal(p.rows[0].row,2);
 const csv=E.parseDelimited('id,description\n01,"a, b"\n');assert.equal(csv.rows[0].raw.description,'a, b');assert.equal(csv.rows[0].raw.id,'01');
});
test('malformed inventory fails visibly rather than dropping columns or rows',()=>{
 for(const text of ['id,id\na,b','id,\na,b','id,name\na','id,name\na,b,c','id,name\na,"b'])assert.throws(()=>E.parseDelimited(text));
 assert.throws(()=>E.parseDelimited('id,name\na,"b"c'));
});
test('messy headers map by proposal and unmapped source columns are retained',()=>{
 const p=E.parseDelimited('Project,Owner,Description,Odd column\nX,A,Study,preserve me');
 const mapping=E.suggestMap(p.headers);assert.equal(mapping.project_id,'Project');assert.equal(mapping.contact_person,'Owner');assert.equal(mapping.Dataset_Name,'');assert.equal(p.rows[0].raw['Odd column'],'preserve me');
});
reg('assay wording and reporters never establish flow or sequencing availability',()=>{
 const p=planned();assert.ok(has(p,'flow'));assert.ok(has(p,'rna'));assert.equal(p.reported,0);assert.equal(p.blockers.length,0);
 assert.ok(E.classify(E.canonical(row,m)).includes('scRNA-seq recorded'));
 const bulk=D.records.find(r=>r.raw.project_id==='24_09_16_Jonathan');assert.deepEqual(E.classify(E.canonical(bulk,m)),['Bulk RNA-seq recorded']);
 const conflict=D.records.find(r=>r.raw.project_id==='24_04_19_Darrell');assert.ok(E.classify(E.canonical(conflict,m)).includes('Title and assay field disagree'));
});
test('reported availability needs evidence and cannot resolve unrelated prerequisites',()=>{
 assert.ok(has(planned({flow:{value:'yes',evidence:''}}),'flow'));
 const p=planned({rna:answer('yes'),flow:answer('yes')});assert.ok(!has(p,'flow'));assert.ok(!has(p,'rna'));assert.ok(has(p,'samples'));assert.ok(has(p,'matrix'));assert.ok(has(p,'validate'));
});
test('same run and condition-only relationships remain distinct from paired samples',()=>{
 for(const relation of ['run','condition','none'])assert.ok(has(planned({relation:answer(relation)}),'relation'));
 for(const relation of ['same','aliquots'])assert.ok(!has(planned({relation:answer(relation)}),'relation'));
});
test('RNA-only target removes flow requirements without deleting cross-assay evidence',()=>{
 const a={flow:answer('no')},p=planned(a,'rna');assert.ok(!has(p,'flow'));assert.ok(!has(p,'flow-model'));assert.ok(!has(p,'relation'));assert.equal(p.totalQuestions,7);assert.equal(p.blockers.length,0);assert.equal(a.flow.value,'no');
});
test('unrecoverable sample identity and confounding explicitly constrain the use case',()=>{
 const p=planned({samples:answer('no'),replicates:answer('confounded'),access:answer('restricted')});assert.equal(p.blockers.length,3);assert.equal(p.status,'Scope change or recovery required');assert.ok(has(p,'samples'));assert.ok(has(p,'replicates'));
});
test('processed matrix requires a use decision; a count report does not validate actual data',()=>{
 assert.ok(has(planned({matrix:answer('processed')}),'matrix'));
 const p=planned({matrix:answer('counts')});assert.ok(!has(p,'matrix'));assert.ok(has(p,'validate'));
});
test('all positive answers leave scientist review, flow semantics and file validation open',()=>{
 const p=planned(Object.fromEntries(E.QUESTIONS.map(q=>[q.id,answer(({relation:'aliquots',matrix:'counts'})[q.id]||'yes')])));
 assert.equal(p.reported,9);for(const id of ['design','reference','flow-model','validate'])assert.ok(has(p,id));assert.notEqual(p.status,'Ready');
});
reg('duplicate identifiers are not silently merged; equal titles with different IDs survive',()=>{
 const duplicate={...row,key:'duplicate'};assert.ok(has(planned({},'joint',row,[row,duplicate]),'identity'));
 const titles=D.records.filter(r=>r.raw.Dataset_Name==='A549 ABCA3 lentiviral rescue bulk RNA-seq');assert.ok(titles.length>=2);assert.equal(new Set(titles.map(r=>r.raw.project_id)).size,titles.length);
});
test('active dependencies precede dependent actions',()=>{
 for(const p of [planned(),planned({samples:answer('yes'),rna:answer('yes')})]){
 const positions=new Map(p.actions.map((a,i)=>[a.id,i]));for(const a of p.actions)for(const id of a.depends)assert.ok(positions.get(id)<positions.get(a.id),`${id} must precede ${a.id}`);
 }
});
test('CSV downloads escape quotes and neutralize spreadsheet formula prefixes',()=>{
 const result=E.csv([['=HYPERLINK("bad")','@SUM(1)','-cmd','normal, text']]);assert.ok(result.startsWith('"\'=HYPERLINK'));assert.ok(result.includes('"\'@SUM'));assert.ok(result.includes('"normal, text"'));
});
test('source NA stays absent without conflating explicit no-reporter text with missingness',()=>{
 assert.ok(E.missing('NA'));assert.ok(!E.missing('No reporters'));assert.ok(!E.missing('None, cells labeled with GFP lentivirus'));assert.deepEqual(E.species({genome_reference:'Human'}),{organism:'Human',assembly:'Not supplied'});assert.equal(E.species({genome_reference:'Human and Mouse'}).organism,'Human and mouse (mixed)');
});

reg('start-here shortlist excludes shared projects, ranks by recorded context and names the next step',()=>{
 const list=E.shortlist(D.records,m,10);assert.equal(list.length,10);assert.ok(list.every(x=>!x.shared));assert.ok(list.every((x,i,arr)=>i===0||arr[i-1].score>=x.score));assert.ok(list[0].score<=8);
 assert.equal(E.readiness({Dataset_Name:'',contact_person:'A',experiment_type:'',genome_reference:'Mouse',purpose_of_experiment:'x',project_date:'2024-01-01',shinyapp_link:'NA',analysis_visualization_link:'NA',geo_accession:'NA'}).next,'Recover name, assay type');
 assert.ok(E.readiness({Dataset_Name:'',contact_person:'',experiment_type:'',genome_reference:'',purpose_of_experiment:'',project_date:'',shinyapp_link:'',analysis_visualization_link:'',geo_accession:'GSE1'}).shared);
});

reg('provenance is read from the registry columns and carried onto graph edges',()=>{
 const pm=E.provenanceMap(Object.keys(D.records[0].raw));assert.equal(pm.lab_assignment,'lab_assignment');assert.equal(pm.purpose_source,'purpose_source');
 const g=E.graphExport(D.records,m,pm,{},E.normTable(D.records,m));const prov={};for(const e of g.edges)prov[e.provenance]=(prov[e.provenance]||0)+1;
 assert.equal(g.edges.filter(e=>e.relation==='IN_LAB'&&e.provenance==='inferred').length,73);assert.equal(g.edges.filter(e=>e.relation==='IN_LAB'&&e.provenance==='absent').length,9);
 assert.ok(prov.normalised>0);assert.ok(g.nodes.every(n=>n.id&&n.label&&n.name!==undefined));assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);
 assert.ok(!g.nodes.some(n=>['Sample','Contrast','Gene'].includes(n.label)),'no invented sample-level nodes');
});
test('user-reported evidence becomes a provenance-tagged edge, never an inventory fact',()=>{
 const reviews={[row.key]:{answers:{rna:{value:'yes',evidence:'sheet on share'}},notes:{},owners:{},files:''}};
 const g=E.graphExport([row],m,E.provenanceMap(Object.keys(row.raw)),reviews,{});const ev=g.edges.filter(e=>e.relation==='HAS_EVIDENCE');assert.equal(ev.length,1);assert.equal(ev[0].provenance,'user_reported');assert.equal(ev[0].evidence,'sheet on share');
});
reg('normalisation keeps the original string and lets a reviewer override the proposed term',()=>{
 const t=E.normTable(D.records,m);assert.ok(t.experiment_type.length>100);assert.equal(t.experiment_type[0].original,'single-cell RNAseq 10X');assert.equal(t.experiment_type[0].term,'scRNA-seq');assert.equal(t.experiment_type[0].status,'proposed');
 const o=E.normTable(D.records,m,{experiment_type:{'single-cell RNAseq 10X':{term:'single-cell RNA sequencing assay',reviewer:'MAS'}}});assert.equal(o.experiment_type[0].term,'single-cell RNA sequencing assay');assert.equal(o.experiment_type[0].status,'reviewed');assert.equal(o.experiment_type[0].original,'single-cell RNAseq 10X');
});
reg('query readiness is zero without evidence and rises only when every requirement is met',()=>{
 const q0=E.queryReadiness(D.records,m,{});assert.ok(q0.every(q=>q.ready===0));assert.ok(q0.find(q=>q.id==='markers').needs[0].count>200);assert.ok(q0.find(q=>q.id==='q1').horizon);
 const ev=v=>({value:v,evidence:'confirmed'});const reviews={[row.key]:{answers:{rna:ev('yes'),annotation:ev('yes')}}};
 const q1=E.queryReadiness(D.records,m,reviews);assert.equal(q1.find(q=>q.id==='markers').ready,1);assert.equal(q1.find(q=>q.id==='q3').ready,0);
});

const FIX=path.join(__dirname,'fixtures');
test('zebrafish EdU sheet (real): names resolve by stage prefix, controls inferred, exclusion applied, products ignored',()=>{
 const d=path.join(FIX,'ZF_FLOW_EdU_UTAH');const v=E.validateSampleSheet(fs.readFileSync(path.join(d,'sample_sheet.tsv'),'utf8'),fs.readFileSync(path.join(d,'listing.txt'),'utf8'),{excludedText:fs.readFileSync(path.join(d,'excluded_samples.tsv'),'utf8')});
 assert.equal(v.rows.length,51);assert.equal(v.sheet.notes.length,1);assert.equal(v.columns.id,'unique_id');assert.deepEqual(v.columns.files,['filename']);
 const fileChecks=v.rows.flatMap(r=>r.checks.filter(c=>c.check.startsWith('file:')));assert.equal(fileChecks.length,51);assert.ok(fileChecks.every(c=>c.status==='recoverable'&&/one file matches/.test(c.reason)),'every FCS resolves to exactly one file');
 assert.equal(v.rows.filter(r=>r.isControl).length,6);assert.equal(v.rows.filter(r=>r.excluded).length,2);
 assert.equal(v.replicates.find(r=>r.condition==='30hpf | kmt2dzy59 | EdU').n,4);assert.ok(v.replicates.every(r=>r.status==='pass'));
 assert.equal(v.orphans.length,0);assert.equal(v.products.length,1);assert.equal(v.summary.counts.fail||0,0);
});
test('KMT2D-dTAG CUT&RUN sheet (real): exact paths, pairs, explicit controls, derived files credited, n = 1 everywhere',()=>{
 const d=path.join(FIX,'iNPC_KMT2DdTAG_CUT_RUN');const v=E.validateSampleSheet(fs.readFileSync(path.join(d,'sample_sheet.tsv'),'utf8'),fs.readFileSync(path.join(d,'listing.txt'),'utf8'));
 assert.equal(v.rows.length,9);assert.equal(v.columns.control,'is_control');assert.ok(v.rows.every(r=>r.checks.find(c=>c.check==='pairing').status==='pass'));
 assert.ok(v.rows.flatMap(r=>r.checks.filter(c=>c.check.startsWith('file:'))).every(c=>c.status==='pass'));assert.equal(v.rows.filter(r=>r.isControl).length,3);
 assert.equal(v.summary.derived,81);assert.equal(v.orphans.length,0);assert.equal(v.replicates.length,6);assert.ok(v.replicates.every(r=>r.n===1&&r.status==='fail'));
 assert.ok(v.actions.some(a=>/n = 1/.test(a.title)));
});
test('reader never repairs: a missing file fails, a trailing note line is kept, a duplicate ID fails',()=>{
 const v=E.validateSampleSheet('sample_id,cond,file\nA,x,a.fcs\nA,x,b.fcs\n\n/some/old/path','a.fcs');
 assert.equal(v.sheet.notes[0],'/some/old/path');assert.equal(v.rows[1].checks.find(c=>c.check==='identity').status,'fail');assert.equal(v.rows[1].checks.find(c=>c.check==='file:b.fcs').status,'fail');
});
test('panel manifest from real FCS headers links files to inventory reagents in the graph export',()=>{
 const man=fs.readFileSync(path.join(FIX,'ZF_FLOW_EdU_UTAH/panel_manifest.csv'),'utf8');const reagents=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/reagents.json'),'utf8'));
 const rows=E.parseManifest(man);assert.equal(rows.length,87);assert.ok(rows.some(r=>r.stain_label==='EdU'&&r.match==='detector'&&r.reagent_ids==='AB228'));
 const reviews={[row.key]:{answers:{},validation:{panel:man}}};const g=E.graphExport([row],m,E.provenanceMap(Object.keys(row.raw)),reviews,{},reagents);
 assert.equal(g.nodes.filter(n=>n.label==='DataFile').length,29);const rg=g.nodes.filter(n=>n.label==='Reagent');assert.equal(rg.length,8);assert.ok(rg.find(n=>n.reagent_id==='AB228'&&/647/.test(n.conjugation)));
 const sw=g.edges.filter(e=>e.relation==='STAINED_WITH');assert.equal(sw.length,29*8);assert.equal(g.edges.filter(e=>e.relation==='HAS_FILE').length,29);assert.deepEqual([...new Set(sw.map(e=>e.provenance))].sort(),['candidate','proposed']);
});
