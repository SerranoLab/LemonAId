// Browser journeys in real Chromium through Playwright.
// Run: npm install --no-save playwright && npx playwright install chromium && node --test tests/browser.test.cjs
// Skipped, not failed, when Playwright is not installed, so the unit tests stay runnable without a browser.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
let chromium=null;try{({chromium}=require('playwright'));}catch{}
const DIST=path.join(__dirname,'..','dist','LemonAId.html');
const FOLDER=path.join(__dirname,'fixtures','example_projects');
const skip=!chromium?'playwright is not installed':!fs.existsSync(DIST)?'dist/LemonAId.html is not built':false;

test('the import flow works in Chromium: folder, match, check, back, import, downloads, example, project focus and export scope, no console errors',{skip},async()=>{
 const browser=await chromium.launch();const pg=await browser.newPage();
 const errors=[],downloads=[];pg.on('download',d=>downloads.push(d.suggestedFilename()));pg.on('pageerror',e=>errors.push('pageerror: '+e.message));pg.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 try{
  await pg.goto('file://'+DIST);
  assert.match(await pg.textContent('#app-version'),/^v\d+\.\d+\.\d+/,'sidebar shows the version from CITATION.cff');
  assert.equal(await pg.locator('#intake-dialog .door').count(),3,'the import dialog offers the three doors');
  // door 1: a projects folder
  await pg.click('#import-open');
  await pg.setInputFiles('#folder-input',FOLDER);
  await pg.waitForSelector('#intake-check');
  assert.match(await pg.textContent('#mapping-preview h3'),/2 projects/,'two project folders become two rows');
  assert.match(await pg.textContent('#folder-progress'),/README|project/i);
  assert.equal(await pg.$eval('.steps li.current',l=>l.dataset.step),'2');
  // step 3 and both Back buttons
  await pg.click('#intake-check');
  assert.match(await pg.textContent('#mapping-preview h3'),/Check before importing/);
  assert.equal(await pg.$$eval('#mapping-preview tbody tr',r=>r.length),2);
  await pg.click('#intake-back-2');assert.ok(await pg.$('#intake-check'),'Back returns to matching');
  await pg.click('#intake-back');assert.ok(await pg.isVisible('#folder-input'),'Back returns to the doors');
  // import for real
  await pg.setInputFiles('#folder-input',FOLDER);await pg.waitForSelector('#intake-check');await pg.click('#intake-check');await pg.click('#commit-intake');
  await pg.waitForFunction(()=>document.querySelectorAll('#project-rows tr').length===2);
  const names=await pg.$$eval('#project-rows tr',r=>r.map(x=>x.textContent));
  assert.ok(names.some(n=>/Zebrafish Flow Cytometry Analysis/.test(n)),'README title becomes the dataset name');
  assert.ok(names.some(n=>/KMT2D iPSC Cell-Cycle RNA-seq Analysis/.test(n)),'qmd title becomes the dataset name');
  // door 3: template and guide download, and only when asked (regression for the every-click export)
  await pg.click('#import-open');
  const [tpl]=await Promise.all([pg.waitForEvent('download'),pg.click('#download-template')]);
  assert.equal(tpl.suggestedFilename(),'project_inventory_template.csv');
  const [guide]=await Promise.all([pg.waitForEvent('download'),pg.click('#download-guide')]);
  assert.equal(guide.suggestedFilename(),'project_inventory_template_guide.md');
  await pg.waitForTimeout(200);
  assert.deepEqual(downloads,['project_inventory_template.csv','project_inventory_template_guide.md'],'only the two asked-for downloads happened; no other click downloaded anything');
  // the example inventory
  await pg.click('#load-example');
  await pg.waitForFunction(()=>document.querySelectorAll('#project-rows tr').length>2);
  assert.ok((await pg.$$eval('#project-rows tr',r=>r.length))>2,'the example inventory loads');
  // #24 #25: switching the project in focus changes the focus line, the export title and the file name together
  await pg.keyboard.press('Escape');
  await pg.click('.sidebar [data-view="connections"]');
  const keys=await pg.$$eval('#project-select option',o=>o.map(x=>x.value));
  for(const k of keys.slice(0,2)){
   await pg.selectOption('#project-select',k);await pg.waitForTimeout(150);
   const shown=await pg.$eval('#project-select',s=>s.selectedOptions[0].textContent);
   assert.ok((await pg.textContent('.focus-line')).includes(shown),'focus line on 03 names the selected project');
   await pg.click('#export-open');assert.ok((await pg.textContent('#export-title')).startsWith('Export: '+shown),'export title names the selected project');
   await pg.click('#export-report');await pg.waitForTimeout(150);
   assert.ok((await pg.textContent('#export-filename')).includes(shown.replace(/ \(untitled\)$/,'').replace(/[^a-z0-9_-]/ig,'_')),'file named from the shown name');
   assert.ok((await pg.$eval('#export-text',t=>t.value)).includes('Scope: project '+shown.replace(/ \(untitled\)$/,'')),'line 1 says the scope');
   await pg.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[],'no page or console errors during the journey');
 }finally{await browser.close();}
});
