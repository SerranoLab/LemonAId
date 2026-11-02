// Minimal non-browser unit harness for serialization and download content.
// Real UI interactions are checked separately in the browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports=function harness(saved,key='lemonaid-registry-v1'){
 const nodes=new Map(),events={},storage=new Map(saved?[[key,saved]]:[]);
 const node=key=>{if(!nodes.has(key))nodes.set(key,{value:'',textContent:'',innerHTML:'',hidden:false,files:[],focus(){},scrollIntoView(){},showModal(){},close(){},click(){},remove(){}});return nodes.get(key);};
 const document={querySelector:node,querySelectorAll:()=>[],addEventListener:(n,fn)=>events[n]=fn,createElement:()=>({click(){},remove(){}}),body:{append(){}}};
 const sandbox={document,window:{scrollTo(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},structuredClone,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,console};
 vm.createContext(sandbox);for(const file of ['data.js','engine.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file==='data.js'?(fs.existsSync(path.join(__dirname,'../src/data.js'))?'data.js':'data.blank.js'):file),'utf8'),sandbox,{filename:file});
 const click=async(id,dataset={})=>events.click({target:{closest:()=>({id,dataset})}});
 return {node,storage,events,click,state:()=>JSON.parse(storage.get(key))};
};
