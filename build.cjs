// Build a single self-contained HTML file from src/.
//   node build.cjs                      -> dist/LemonAId.html (no inventory; import your own)
//   node build.cjs --data path/to/data.js --name LemonAId_MyCenter --brand "Name|TAGLINE" --queries config/mycenter.queries.json
// --queries replaces the five general readiness questions with a center's own (see config/README.md).
// --data points at a data.js exporting window.CREM_DATA (see src/data.blank.js and docs/inventory-format.md).
// data/reagents.json (an EpiFlow Panel Builder export) is embedded when present; pass --reagents to use another.
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf(k);return i>-1?args[i+1]:'';};
const src=path.join(__dirname,'src'),out=path.join(__dirname,'dist');fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync(path.join(src,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+fs.readFileSync(path.join(src,'styles.css'),'utf8')+'</style>');
html=html.replace(/\s*<script defer src="(?:data|engine|app)\.js"><\/script>/g,'');
const dataPath=opt('--data')||path.join(src,'data.blank.js');let data=fs.readFileSync(dataPath,'utf8');
const brand=(opt('--brand')||'LemonAId|YOUR DATA. A CLEARER PATH.').split('|');
const examplePath=path.join(__dirname,'examples','serrano_lab_projects_2026-10-21.csv');const example=fs.existsSync(examplePath)?fs.readFileSync(examplePath,'utf8'):'';
const queriesPath=opt('--queries');const queries=queriesPath?JSON.parse(fs.readFileSync(queriesPath,'utf8')):null;
const reagentsPath=opt('--reagents')||path.join(__dirname,'data','reagents.json');
const reagents=fs.existsSync(reagentsPath)?JSON.parse(fs.readFileSync(reagentsPath,'utf8')).map(r=>({id:r.id,marker:r.marker,antibody:r.antibody,clone:r.clone,catNo:r.catNo,conjugation:r.conjugation,vendor:r.vendor,module:r.module,role:r.role,lastOrdered:r.lastOrdered})):[];
// The version shown in the app and every export comes from CITATION.cff, which the release commit sets.
// It is read from a file, not from git, so the committed dist/ matches the commit that built it.
const cff=fs.readFileSync(path.join(__dirname,'CITATION.cff'),'utf8').match(/^version:\s*"?([^"\s]+)"?\s*$/m);
if(!cff)throw Error('CITATION.cff has no version line');
const version='v'+cff[1];
const blank=!JSON.parse(data.replace(/^[^{]*/,'').replace(/;\s*$/,'')).records.length;
data=data.replace(/;\s*$/,'').replace(/\}\s*$/,`,"brand":${JSON.stringify({name:brand[0],sub:brand[1]||''})}};\n`);
data+='window.CREM_REAGENTS = '+JSON.stringify(reagents)+';\nwindow.CREM_BUILD = '+JSON.stringify(blank?'blank':'registry')+';\nwindow.LEMONAID_VERSION = '+JSON.stringify(version)+';\n'+(queries?'window.LEMONAID_QUERIES = '+JSON.stringify(queries)+';\n':'')+'window.LEMONAID_EXAMPLE = '+JSON.stringify(example)+';\n';
const code=[data,...['engine.js','app.js'].map(n=>fs.readFileSync(path.join(src,n),'utf8'))].join('\n').replace(/<\/script/gi,'<\\/script');
html=html.replace('</body>',()=>`<script>${code}</script></body>`);
const name=(opt('--name')||'LemonAId')+'.html';fs.writeFileSync(path.join(out,name),html);
// The same page as index.html, so dist/ can be served as-is (GitHub Pages) while LemonAId.html stays the download name.
if(blank&&!opt('--name'))fs.writeFileSync(path.join(out,'index.html'),html);
console.log(`${version}: saved dist/${name}${blank&&!opt('--name')?' and dist/index.html':''}${blank?' (no inventory embedded; import one in the app)':''}, reagents: ${reagents.length}`);
