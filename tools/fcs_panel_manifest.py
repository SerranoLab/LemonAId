#!/usr/bin/env python3
"""LemonAId: panel manifest from FCS headers, matched to the EpiFlow reagent inventory.

    python3 tools/fcs_panel_manifest.py <project_dir> --reagents clean_antibodies.json --out <dir>

Reads only the TEXT segment of each .fcs (no event data), so it is fast and never alters a file.
Per file: cytometer, acquisition date, tube/specimen, event count, every parameter with its detector
name ($PnN) and stain label ($PnS). Each stain label is matched to the inventory by marker name
and, when the label carries one, by fluorochrome; a match is 'exact' (marker and conjugate agree),
'marker' (marker agrees, conjugate unknown or absent), or 'none'. Nothing is inferred beyond that.
Writes panel_manifest.csv (one row per stained channel per file), files.csv (one row per file),
and panel_summary.md. A file that cannot be opened is listed with the error, not skipped silently.
"""
import sys, os, re, json, csv, argparse, collections, datetime, itertools

def read_header(path):
    with open(path,'rb') as fh: raw=fh.read(4096)
    tb,te=int(raw[10:18]),int(raw[18:26])
    with open(path,'rb') as fh: fh.seek(tb); text=fh.read(te-tb+1).decode('latin-1')
    d=text[0]; p=text[1:].split(d); kw={}
    for i in range(0,len(p)-1,2): kw[p[i].strip()]=p[i+1].strip()
    return kw

SCATTER=re.compile(r'^(FSC|SSC|Time|Event|Width|Height|TIME)',re.I)
FLUORS=['pe-cy7','pe-cy5.5','pe-cy5','pe-cf594','percp-cy5.5','percp','apc-cy7','apc-h7','apc-r700','apc','pe','fitc','af488','alexa fluor 488','af532','af594','af647','alexa fluor 647','af700','bv421','bv480','bv510','bv570','bv605','bv650','bv711','bv750','bv785','pacific blue','pacblue','dapi','hoechst','zombie nir','nir','vio b515','rb613','rb780','v450','v500','bb515','buv395','buv496','buv563','buv661','buv737','buv805']
def norm(s): return re.sub(r'[^a-z0-9]+',' ',str(s or '').lower()).strip()
def split_label(label):
    n=norm(label); fl=''
    for f in sorted(FLUORS,key=len,reverse=True):
        if n.endswith(' '+norm(f)) or n==norm(f): fl=f; n=n[:len(n)-len(norm(f))].strip(); break
    return n,fl
def load_reagents(path):
    items=json.load(open(path)); idx=collections.defaultdict(list)
    for it in items:
        m=norm(it.get('marker')); idx[m].append(it)
        for alt in re.split(r'[/|,]',str(it.get('marker',''))): 
            a=norm(alt)
            if a and a!=m: idx[a].append(it)
    return items,idx
ALIASES={'hucd':'huc d','huc/d':'huc d','edu':'edu','sox2':'sox2'}
DET_FLUOR={'fitc':['fitc','af488','alexa fluor 488','bb515'],'pe':['pe'],'apc':['apc','af647','alexa fluor 647'],'pe cy7':['pe-cy7'],'pe cy5':['pe-cy5'],'pe cy5 5':['pe-cy5.5'],'percp cy5 5':['percp-cy5.5','percp'],'apc cy7':['apc-cy7','apc-h7'],'pacific blue':['pacific blue','bv421'],'bv421':['bv421','pacific blue'],'bv510':['bv510'],'bv605':['bv605'],'bv650':['bv650'],'bv711':['bv711'],'bv786':['bv785','bv786'],'af700':['af700','alexa fluor 700'],'apc r700':['apc-r700'],'dapi':['dapi'],'v450':['v450','pacific blue','bv421'],'v500':['v500','bv510']}
def match(label,idx,detector=''):
    m,fl=split_label(label); m=ALIASES.get(m,m)
    words=set(m.split())
    cands=idx.get(m) or [it for k,its in idx.items() for it in its if k and (k==m or (len(m)>2 and (set(k.split())>=words or k.startswith(m+' ') or m.startswith(k+' '))))]
    cands=list({it['id']:it for it in cands}.values())
    if not cands: return 'none','',''
    fluors=[fl] if fl else DET_FLUOR.get(norm(re.sub(r'-[AHW]$','',detector)),[])
    if fluors:
        ex=[it for it in cands if any(norm(f) in norm(it.get('conjugation')) for f in fluors)]
        if ex: return ('exact' if fl else 'detector'),';'.join(it['id'] for it in ex),';'.join(sorted({it.get('conjugation','') for it in ex}))
    return 'marker',';'.join(it['id'] for it in cands),';'.join(sorted({it.get('conjugation','') for it in cands}))
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--reagents',required=True); ap.add_argument('--out',default=None); a=ap.parse_args()
    out=a.out or os.path.join(os.getcwd(),'panel_'+os.path.basename(a.project.rstrip('/'))); os.makedirs(out,exist_ok=True)
    items,idx=load_reagents(a.reagents)
    files=[];rows=[];errors=[]
    for root,ds,fs in os.walk(a.project):
        ds[:]=[d for d in ds if d not in ('renv','.git','node_modules','.Rproj.user','_extensions') and not d.startswith('.')]
        for f in sorted(fs):
            if not f.lower().endswith('.fcs'): continue
            p=os.path.join(root,f); rel=os.path.relpath(p,a.project)
            try: kw=read_header(p)
            except Exception as e: errors.append((rel,type(e).__name__+': '+str(e)[:80])); continue
            n=int(kw.get('$PAR','0')); stained=[]
            for i in range(1,n+1):
                det=kw.get(f'$P{i}N',''); lab=kw.get(f'$P{i}S','')
                if SCATTER.match(det) or not lab: continue
                st,ids,conj=match(lab,idx,det); stained.append(lab)
                rows.append({'file':rel,'detector':det,'stain_label':lab,'match':st,'reagent_ids':ids,'inventory_conjugate':conj})
            files.append({'file':rel,'cytometer':kw.get('$CYT',''),'date':kw.get('$DATE',''),'tube':kw.get('TUBE NAME',kw.get('$SRC','')),'specimen':kw.get('$SRC',''),'events':kw.get('$TOT',''),'parameters':n,'stained_channels':len(stained),'panel':' | '.join(stained),'operator':kw.get('$OP',''),'software':kw.get('CREATOR',kw.get('$SYS',''))})
    with open(os.path.join(out,'files.csv'),'w',newline='') as fh: w=csv.DictWriter(fh,fieldnames=list(files[0].keys()) if files else ['file']); w.writeheader(); w.writerows(files)
    with open(os.path.join(out,'panel_manifest.csv'),'w',newline='') as fh: w=csv.DictWriter(fh,fieldnames=['file','detector','stain_label','match','reagent_ids','inventory_conjugate']); w.writeheader(); w.writerows(rows)
    panels=collections.Counter(f['panel'] for f in files); labels=collections.Counter((r['stain_label'],r['match'],r['reagent_ids']) for r in rows)
    md=[f"# Panel manifest: {os.path.basename(a.project.rstrip('/'))}","",f"{len(files)} FCS files read (headers only), {len(errors)} unreadable. Reagent inventory: {len(items)} entries from `{os.path.basename(a.reagents)}`. Generated {datetime.date.today()} by LemonAId fcs_panel_manifest. Nothing was modified.","","## Instruments and dates","",
        "| Cytometer | Files | Dates |","|---|---|---|"]
    for cyt,grp in itertools.groupby(sorted(files,key=lambda x:x['cytometer']),key=lambda x:x['cytometer']):
        g=list(grp); md.append(f"| {cyt or 'unknown'} | {len(g)} | {', '.join(sorted({x['date'] for x in g}))} |")
    md+=["","## Distinct panels (stain labels as written in the file headers)","","| Panel | Files |","|---|---|"]+[f"| {p or '(no stain labels)'} | {n} |" for p,n in panels.most_common()]
    md+=["","## Stain labels matched to the inventory","","| Label in file | Channels | Match | Reagent IDs | Inventory conjugate |","|---|---|---|---|---|"]
    for (lab,st,ids),n in labels.most_common(): md.append(f"| {lab} | {n} | {st} | {ids or ''} | {next((r['inventory_conjugate'] for r in rows if r['stain_label']==lab),'')} |")
    if errors: md+=["","## Files that could not be opened","",*[f"- {f}: {e}" for f,e in errors]]
    md+=["","## What this does and does not establish","","- A stain label in a header is what the operator typed at acquisition; it names a marker and sometimes a fluorochrome. A match to the inventory proposes which reagent was used; the lot, dilution and the actual tube contents need the experiment record.","- 'exact' = label names marker and fluorochrome and both agree with one inventory entry; 'detector' = label names only the marker and the detector's conventional fluorochrome picks the conjugate (a proposal, since spectral instruments unmix rather than filter); 'marker' = every inventory entry for that marker, for a person to choose.","- Unmatched labels are either reagents not in the inventory, dyes recorded under another name, or typos; each is a one-line question for the operator."]
    open(os.path.join(out,'panel_summary.md'),'w').write('\n'.join(md)); print('\n'.join(md[:40])); print(f"\nWrote {out}/files.csv, panel_manifest.csv, panel_summary.md")
if __name__=='__main__': main()
