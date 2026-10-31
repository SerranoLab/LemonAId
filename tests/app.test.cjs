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
