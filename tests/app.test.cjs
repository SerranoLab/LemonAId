const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const harness=require('./app-harness.cjs'),E=require('../src/engine.js');
const HAS_REGISTRY=fs.existsSync(path.join(__dirname,'../src/data.js'));const reg=HAS_REGISTRY?test:test.skip;
reg('registry TSV export round-trips all original values into the bundled inventory',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../data/registry.tsv'),'utf8');
 const parsed=E.parseDelimited(text),state=harness().state();assert.equal(parsed.rows.length,state.records.length);
 parsed.rows.forEach((r,i)=>assert.deepEqual(r.raw,state.records[i].raw));
});
reg('the earlier 30-row Kotton inventory still imports with its legacy date header mapped',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../data/kotton_30.tsv'),'utf8');
 const parsed=E.parseDelimited(text),map=E.suggestMap(parsed.headers);assert.equal(parsed.rows.length,30);assert.equal(map.project_date,'project_data');assert.equal(map.lab,'');
});
reg('fresh session selects the real Lauren project with no invented answers',()=>{
 const h=harness(),s=h.state();assert.equal(s.selected,'reg-211');assert.deepEqual(s.reviews['reg-211']?.answers||{},{});assert.equal(s.goal,'share');
});
reg('generated report contains the real provenance, complete map, evidence and action checks',async()=>{
 const h=harness();await h.click('export-report');const text=h.node('#export-text').value;
 for(const phrase of ['25_06_24_lauren','record row 211','Human (Hg38)','SFTPC-tdTomato','Done when:','Kotton Lab','public repository','No assay files have been inspected','Protocols and Western blots'])assert.ok(text.includes(phrase),phrase);
 assert.ok(!text.includes('DEMO-LUNG-001'));assert.ok(text.startsWith('<!doctype html>'));
});
reg('action CSV has one row per active action, plus ownership and evidence columns',async()=>{
 const h=harness();await h.click('export-actions');const p=E.parseDelimited(h.node('#export-text').value);
 assert.equal(p.rows.length,10);assert.ok(p.headers.includes('Done when'));assert.ok(p.rows.every(r=>r.raw.Source.includes('record row 211')));
});
reg('session export and reload preserve all original columns, notes and drafts',async()=>{
 const h=harness();await h.click('export-session');let s=JSON.parse(h.node('#export-text').value);
 s.reviews['reg-211']={answers:{},files:'',owners:{},notes:{design:'A test note'},drafts:{matrix:{value:'counts',evidence:'Draft only'}}};
 const restored=harness(JSON.stringify(s)).state();assert.equal(restored.reviews['reg-211'].notes.design,'A test note');assert.equal(restored.reviews['reg-211'].drafts.matrix.evidence,'Draft only');assert.deepEqual(restored.reviews['reg-211'].answers,{});assert.equal(restored.records.length,409);
 const legacy=JSON.parse(JSON.stringify(s));legacy.source.mode='carlos';assert.equal(harness(JSON.stringify(legacy)).state().source.mode,'registry');
});
test('the build stamps the CITATION.cff version and no hand-written version label remains (#15)',()=>{
 const cff=fs.readFileSync(path.join(__dirname,'../CITATION.cff'),'utf8').match(/^version:\s*"?([^"\s]+)"?\s*$/m)[1];
 const html=fs.readFileSync(path.join(__dirname,'../dist/LemonAId.html'),'utf8');
 assert.ok(html.includes(`window.LEMONAID_VERSION = "v${cff}"`),'version from CITATION.cff is embedded');
 assert.ok(html.includes('id="app-version"'),'sidebar shows the embedded version');
 assert.ok(!/planner v0\.\d|prototype · v0\.\d/.test(html),'no hand-written version label');
});
test('standalone build contains exactly one valid script and no external app dependencies',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/LemonAId.html'),'utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/href="styles.css"/.test(html));
});
reg('explicit bulk assay triggers a scope review rather than assuming single-cell RNA',()=>{
 const h=harness(),s=h.state(),r=s.records.find(r=>r.raw.project_id==='24_09_16_Jonathan');const p=E.plan(r,s.map,{},'rna',s.records);assert.ok(p.actions.some(a=>a.id==='scope'));
});

reg('inventory-level exports cover every record and the blank build carries no inventory',async()=>{
 const h=harness();await h.click('export-all');const p=E.parseDelimited(h.node('#export-text').value);assert.equal(p.rows.length,409);assert.ok(p.headers.includes('Reach'));assert.ok(p.rows.some(r=>r.raw.Reach==='Public accession'));
 await h.click('export-overview');const o=h.node('#export-text').value;assert.ok(o.includes('Reach by laboratory')&&o.includes('Closest to shareable')&&o.includes('Kotton Lab'));
 const blank=fs.readFileSync(path.join(__dirname,'../dist/LemonAId.html'),'utf8');assert.ok(!blank.includes('25_06_24_lauren'));assert.ok(/"records":\s*\[\]/.test(blank));assert.ok(!/<script[^>]+src=/.test(blank));
});

// A blank-build session built from the example inventory, so exports can be tested without the private registry.
function exampleSession(){
 const text=fs.readFileSync(path.join(__dirname,'../examples/serrano_lab_projects_2026-10-21.csv'),'utf8');
 const parsed=E.parseDelimited(text);const records=parsed.rows.map((r,i)=>({key:'ex-'+i,row:i+2,raw:r.raw}));
 return JSON.stringify({version:1,source:{name:'Imported inventory',mode:'import',path:''},records,map:E.suggestMap(parsed.headers),pmap:E.provenanceMap(parsed.headers),norm:{},lastExport:'',selected:'ex-41',goal:'share',reviews:{},view:'inventory'});
}
const blankHarness=()=>harness(exampleSession(),'lemonaid-blank-v1');
test('every export carries the alpha note, and the plan omits the single-cell branch for a bulk RNA-seq project (#15)',async()=>{
 const h=blankHarness();assert.equal(h.state().records.length,49);
 await h.click('export-session');assert.match(JSON.parse(h.node('#export-text').value).alpha_note,/alpha: identifiers/);
 await h.click('export-overview');const ov=h.node('#export-text').value;assert.match(ov,/alpha: identifiers/);assert.match(ov,/share the top score/);
 await h.click('export-nodes');assert.match(h.node('#export-text').value,/\n# LemonAId .* alpha/);
 await h.click('export-report');const rep=h.node('#export-text').value;
 assert.match(rep,/KMT2D iPSC Cell-Cycle RNA-seq Analysis/);assert.ok(!/scRNA-seq \/ snRNA-seq branch/.test(rep),'no single-cell branch for a bulk project');assert.match(rep,/alpha: identifiers/);
});
test('#11: for every example row, the graph assay term is either the field-only proposal or the source string, never a text hint',()=>{
 const st=JSON.parse(exampleSession());const recs=st.records,m=st.map;const norm=E.normTable(recs,m);
 const g=E.graphExport(recs,m,st.pmap,{},norm);
 for(const r of recs){const p=E.canonical(r,m);if(E.missing(p.experiment_type))continue;
  const e=g.edges.find(x=>x.source==='project:'+p.project_id.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')&&x.relation==='HAS_ASSAY');assert.ok(e,'edge for '+p.project_id);
  const proposal=E.normTable([r],m).experiment_type[0].proposed;
  const expect=(proposal||p.experiment_type).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  assert.equal(e.target,'assay:'+expect,p.project_id);
  if(proposal)assert.ok(E.classify(p).some(t=>t===proposal+' recorded'),p.project_id+': proposal comes from the field');
 }
 const s8=recs.find(r=>r.raw.project_id==='iPSC_S8_RNAseq');const e=g.edges.find(x=>x.source==='project:ipsc-s8-rnaseq'&&x.relation==='HAS_ASSAY');
 assert.equal(e.target,'assay:sequencing-type-to-confirm');assert.deepEqual(E.classify(E.canonical(s8,m)),['flow cytometry in text, confirm assay']);
});

test('the public build is general: no center questions, names or case study; the engine ships the five general questions',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/LemonAId.html'),'utf8');
 assert.ok(!/SFTPC|NKX2-1|KRT17|SKAAR|Carlos|CReM-KG|Villacorta|Lauren|Kotton|Mostoslavsky/.test(html),'no center-specific text in the public build');
 assert.equal(E.QUERIES.length,5);assert.equal(E.QUERIES_SOURCE,'');assert.ok(E.QUERIES.every(q=>q.needs.every(([,t])=>typeof t==='function')));
 const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/crem.queries.json'),'utf8'));
 assert.equal(cfg.queries.length,5);for(const q of cfg.queries)for(const n of q.needs)assert.ok(E.NEEDS[typeof n==='string'?n:n.need],'need exists: '+JSON.stringify(n));
});
