#!/usr/bin/env node
// LemonAId sample-sheet reader, command line.
// Usage: node tools/validate_samplesheet.cjs <sample_sheet.csv|tsv> <project_dir> [--exclude file] [--md5 file] [--out dir]
// Walks <project_dir> for data files, validates the sheet against them with the same rules as the app,
// optionally verifies MD5 checksums, and writes report.md and checks.csv. Reads only; writes only to --out.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require(path.join(__dirname,'..','dist','engine.js'));
const args=process.argv.slice(2);if(args.length<2){console.error('usage: validate_samplesheet.cjs <sheet> <project_dir> [--exclude f] [--md5 f] [--out dir] [--verify-md5]');process.exit(2);}
const [sheetPath,dir]=args;const opt=k=>{const i=args.indexOf(k);return i>-1?args[i+1]:'';};
const SKIP=new Set(['renv','.git','node_modules','.Rproj.user','_extensions','.quarto']);
const listing=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name.startsWith('.')||SKIP.has(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else listing.push(path.relative(dir,p));}})(dir);
const sheet=fs.readFileSync(sheetPath,'utf8');const excludedText=opt('--exclude')?fs.readFileSync(opt('--exclude'),'utf8'):'';
const v=E.validateSampleSheet(sheet,listing.join('\n'),{excludedText});
// md5 coverage and optional verification
let md5={};if(opt('--md5')){for(const l of fs.readFileSync(opt('--md5'),'utf8').split(/\r?\n/)){const m=l.trim().match(/^([a-f0-9]{32})\s+\*?(.+)$/i);if(m)md5[path.basename(m[2])]=m[1];}
 for(const r of v.rows)for(const c of r.checks){if(!c.check.startsWith('file:'))continue;const b=c.check.slice(5);if(!md5[b]){r.checks.push({check:'md5:'+b,status:'unknown',reason:'No checksum recorded for this file.',repair:'Record an MD5 in metadata/raw_md5sums.txt.',owner:'Data custodian',done:'Every raw file has a recorded checksum.'});continue;}
  if(args.includes('--verify-md5')&&c.status==='pass'){const f=listing.find(x=>path.basename(x)===b);const h=crypto.createHash('md5');h.update(fs.readFileSync(path.join(dir,f)));const ok=h.digest('hex')===md5[b];r.checks.push({check:'md5:'+b,status:ok?'pass':'fail',reason:ok?'Checksum verified.':'Checksum does not match the recorded value.',repair:ok?'':'Re-transfer the file from the source and re-verify.',owner:'Data custodian',done:'Checksum matches.'});}
  else r.checks.push({check:'md5:'+b,status:'pass',reason:'Checksum recorded (not recomputed; pass --verify-md5 to hash the file).'});}}
const out=opt('--out')||path.join(process.cwd(),'validation_'+path.basename(dir));fs.mkdirSync(out,{recursive:true});
const counts={};for(const r of v.rows)for(const c of r.checks)counts[c.status]=(counts[c.status]||0)+1;
const md=[];md.push(`# Sample-sheet validation: ${path.basename(dir)}`,'',`Sheet: \`${path.basename(sheetPath)}\` (${v.rows.length} rows). Listing: ${listing.length} files under \`${dir}\`. Generated ${new Date().toISOString().slice(0,10)} by LemonAId validate_samplesheet. Nothing was modified.`,'',
 `**Columns detected.** ID: \`${v.columns.id}\`; files: ${v.columns.files.map(x=>'`'+x+'`').join(', ')||'none'}; design: ${v.columns.design.map(x=>'`'+x+'`').join(', ')||'none'}; control flag: ${v.columns.control?'`'+v.columns.control+'`':'none (inferred from names)'}.`,'',
 `${v.sheet.notes.length?'**Notes found in the sheet (kept, not parsed as samples).** '+v.sheet.notes.map(n=>'`'+n+'`').join('; ')+'\n\n':''}**Checks.** ${Object.entries(counts).map(([k,n])=>`${n} ${k}`).join(', ')}. Derived files credited to samples by name: ${v.summary.derived}. Analysis products on disk (output, results, figures folders; not checked): ${v.products.length}. Orphan data files on disk: ${v.orphans.length}. Control-like files on disk not in the sheet: ${v.controlsOnDisk.length}.`,'','## Replicates per condition','','| Condition | n | Status | Note |','|---|---|---|---|',...v.replicates.map(r=>`| ${r.condition} | ${r.n} | ${r.status} | ${r.reason} |`),'','## Per-sample findings (fail, recoverable, unknown only)','');
for(const r of v.rows){const bad=r.checks.filter(c=>c.status!=='pass'&&c.status!=='not_applicable');if(!bad.length)continue;md.push(`**${r.id}** (row ${r.row})`);for(const c of bad)md.push(`- ${c.status}: ${c.reason}${c.repair?' Repair: '+c.repair:''}${c.owner?' ('+c.owner+')':''}`);md.push('');}
if(v.orphans.length){md.push('## Data files on disk that no sample names','',...v.orphans.slice(0,60).map(o=>'- '+o),v.orphans.length>60?`- … ${v.orphans.length-60} more`:'','');}
if(v.controlsOnDisk.length){md.push('## Control-like files on disk not in the sheet','',...v.controlsOnDisk.map(o=>'- '+o),'');}
md.push('## Actions','',...v.actions.map((a,i)=>`${i+1}. ${a.title} (${a.owner}). Done when: ${a.done}`),'');
fs.writeFileSync(path.join(out,'report.md'),md.join('\n'));
fs.writeFileSync(path.join(out,'checks.csv'),E.csv([['Row','Sample ID','Check','Status','Reason','Repair','Owner','Done when'],...v.rows.flatMap(r=>r.checks.map(c=>[r.row,r.id,c.check,c.status,c.reason,c.repair,c.owner,c.done]))]));
console.log(md.slice(0,12).join('\n'));console.log(`\nWrote ${out}/report.md and checks.csv`);
