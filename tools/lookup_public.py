#!/usr/bin/env python3
"""
lookup_public.py: find public records that an inventory never wrote down.

Two passes, both producing candidates, never facts:

  1. Offline. Every field of every row is scanned for repository identifiers
     (GSE, GSM, E-MTAB, PRJNA, SRP, PXD, phs, EGA) and publication identifiers
     (PMID, DOI). An identifier found outside the accession field is a
     candidate: it may be the project's own deposition, or a public dataset
     the project re-analysed. Only a person can tell.
  2. Online (--ncbi). For each laboratory, GEO DataSets (db=gds) is searched by
     submitter surname; each GSE series is matched to inventory rows by year
     window and word overlap between the series title/summary and the row's
     dataset name/purpose. PubMed IDs attached to the series are reported.
     Needs eutils.ncbi.nlm.nih.gov. Set NCBI_API_KEY for 10 requests/s.

Output
  <out>/lookup_candidates.csv   one row per candidate, with provenance = candidate
  <out>/lookup_summary.md       the counts worth quoting, with the caveats
  <out>/ncbi_cache.json         raw E-utilities responses (online pass only)

Usage
  python3 tools/lookup_public.py registry.tsv --out lookup/
  python3 tools/lookup_public.py registry.tsv --out lookup/ --ncbi
  python3 tools/lookup_public.py registry.xlsx --sheet "All projects" --out lookup/ --ncbi

Nothing is written back to the inventory. Nothing here validates a dataset.
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ACCESSION = re.compile(r"\b(GSE\d+|GSM\d+|E-MTAB-\d+|E-GEOD-\d+|PRJNA\d+|PRJEB\d+|PRJDB\d+|SRP\d+|ERP\d+|SRX\d+|PXD\d+|phs\d{6}(?:\.v\d+(?:\.p\d+)?)?|EGAS\d+|EGAD\d+)\b")
PMID = re.compile(r"\bPMID:?\s*(\d{7,8})\b")
DOI = re.compile(r"\b(10\.\d{4,9}/[^\s\"<>)]+)")
MISSING = {"", "na", "n/a", "nan", "none", "null", "unknown"}
STOP = set("""a an the of in on for and or to with by from at as is are was were be this that these those
single cell cells seq sequencing rna scrna scrnaseq snrna snrnaseq bulk 10x 10xgenomics genomics data dataset
analysis samples sample per experiment experiments project human mouse lung ipsc ipscs derived day days""".split())

FIELD_ALIASES = {
    "project_id": ["project_id", "projectid", "id", "project"],
    "name": ["dataset_name", "datasetname", "name", "title", "dataset"],
    "date": ["project_date", "projectdate", "date", "project_data"],
    "lab": ["lab_pi", "lab", "laboratory", "pi"],
    "contact": ["contact_person", "contact", "requester"],
    "assay": ["experiment_type", "experimenttype", "assay", "assay_type"],
    "purpose": ["purpose_of_experiment", "purpose", "description", "summary"],
    "accession": ["geo_accession", "accession", "geo", "public_accession", "repository"],
    "category": ["category"],
}

def norm(s): return re.sub(r"[^a-z0-9]", "", str(s).lower())
def missing(v): return str(v).strip().lower() in MISSING
def tokens(text):
    return {t for t in re.findall(r"[a-z0-9]+", str(text).lower()) if len(t) > 2 and t not in STOP and not t.isdigit()}

def read_table(path, sheet=None):
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            sys.exit("Reading .xlsx needs openpyxl (pip install openpyxl), or export the sheet as TSV.")
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb[sheet] if sheet else wb.worksheets[0]
        rows = ws.iter_rows(values_only=True)
        headers = [str(h or "").strip() for h in next(rows)]
        return headers, [dict(zip(headers, ["" if v is None else str(v) for v in r])) for r in rows if any(v not in (None, "") for v in r)]
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096); f.seek(0)
        delim = "\t" if sample.count("\t") > sample.count(",") else ","
        reader = csv.DictReader(f, delimiter=delim)
        return reader.fieldnames, list(reader)

def map_fields(headers):
    m = {}
    for key, aliases in FIELD_ALIASES.items():
        wanted = {norm(a) for a in aliases}
        m[key] = next((h for h in headers if norm(h) in wanted), None)
    return m

def year_of(v):
    mm = re.match(r"\s*(\d{4})", str(v)); return int(mm.group(1)) if mm else None

# ---------- pass 1: offline ----------
def offline_candidates(rows, fm):
    out = []
    for r in rows:
        acc_field = r.get(fm["accession"] or "", "") if fm["accession"] else ""
        recorded = set(ACCESSION.findall(acc_field))
        for col, val in r.items():
            if col == fm["accession"] or missing(val):
                continue
            for acc in ACCESSION.findall(val):
                if acc in recorded: continue
                out.append(cand(r, fm, "accession_in_other_field", acc, col, f"{acc} appears in {col}, not in the accession field"))
            for pm in PMID.findall(val):
                out.append(cand(r, fm, "pmid_in_field", "PMID:" + pm, col, f"PMID {pm} appears in {col}"))
            for doi in DOI.findall(val):
                out.append(cand(r, fm, "doi_in_field", doi.rstrip(".,;)"), col, f"DOI appears in {col}"))
        if fm["accession"] and not missing(acc_field) and not recorded:
            kind = "publication_in_accession_field" if (PMID.search(acc_field) or DOI.search(acc_field)) else "text_in_accession_field"
            out.append(cand(r, fm, kind, "", fm["accession"], f"accession field holds: {acc_field.strip()[:80]}"))
    return out

def cand(r, fm, kind, ident, field, reason, score="", title="", pub="", date=""):
    g = lambda k: (r.get(fm[k]) if fm[k] else "") or ""
    return {"project_id": g("project_id"), "lab": g("lab"), "dataset_name": g("name"), "project_date": g("date"),
            "category": g("category"), "accession_recorded": ";".join(ACCESSION.findall(g("accession"))),
            "candidate_type": kind, "identifier": ident, "found_in": field, "title": title, "public_date": date,
            "pubmed": pub, "score": score, "reason": reason, "provenance": "candidate", "decision": "", "decided_by": ""}

# ---------- pass 2: NCBI ----------
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
def eutil(tool, params, cache, pause):
    params = dict(params, retmode="json", tool="LemonAId-lookup", email=os.environ.get("NCBI_EMAIL", ""))
    if os.environ.get("NCBI_API_KEY"): params["api_key"] = os.environ["NCBI_API_KEY"]
    url = EUTILS + tool + ".fcgi?" + urllib.parse.urlencode(params)
    if url in cache: return cache[url]
    time.sleep(pause)
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    cache[url] = data
    return data

def lab_surnames(rows, fm):
    names = Counter()
    for r in rows:
        lab = (r.get(fm["lab"]) if fm["lab"] else "") or ""
        for part in re.split(r"[;/,]", lab):
            part = re.sub(r"\(.*?\)", "", part)
            w = re.sub(r"\b(lab|laboratory|external|collab\.?)\b", "", part, flags=re.I).strip()
            if w and not missing(w) and w.lower() != "unassigned": names[w.split()[-1]] += 1
    return [n for n, _ in names.most_common()]

def ncbi_candidates(rows, fm, cache, pause, since=2015):
    out = []
    by_lab = defaultdict(list)
    for r in rows:
        lab = (r.get(fm["lab"]) if fm["lab"] else "") or ""
        for sn in lab_surnames([r], fm): by_lab[sn].append(r)
    for sn, lab_rows in by_lab.items():
        term = f"{sn}[Author] AND gse[Entry Type] AND {since}:3000[Publication Date]"
        es = eutil("esearch", {"db": "gds", "term": term, "retmax": 500}, cache, pause)
        ids = es.get("esearchresult", {}).get("idlist", [])
        for i in range(0, len(ids), 100):
            su = eutil("esummary", {"db": "gds", "id": ",".join(ids[i:i+100])}, cache, pause)
            for uid, s in su.get("result", {}).items():
                if uid == "uids" or not isinstance(s, dict): continue
                acc = s.get("accession", ""); title = s.get("title", ""); summ = s.get("summary", "")
                pdat = s.get("pdat", ""); year = year_of(pdat)
                pub = ";".join(str(p) for p in s.get("pubmedids", []) or [])
                stoks = tokens(title) | tokens(summ)
                for r in lab_rows:
                    recorded = set(ACCESSION.findall((r.get(fm["accession"]) if fm["accession"] else "") or ""))
                    if acc in recorded: continue
                    ry = year_of(r.get(fm["date"]) if fm["date"] else "")
                    if ry and year and not (ry - 1 <= year <= ry + 4): continue
                    rtoks = tokens(r.get(fm["name"]) if fm["name"] else "") | tokens(r.get(fm["purpose"]) if fm["purpose"] else "")
                    if not rtoks or not stoks: continue
                    overlap = rtoks & stoks
                    score = round(len(overlap) / max(3, min(len(rtoks), len(stoks))), 2)
                    if len(overlap) >= 3 and score >= 0.3:
                        out.append(cand(r, fm, "geo_by_submitter", acc, "GEO (db=gds)",
                                        f"submitter {sn}; shared words: {', '.join(sorted(overlap)[:8])}",
                                        score, title[:160], pub, pdat))
    return out

# ---------- summary ----------
def summarise(rows, fm, cands, online):
    inv = [r for r in rows if not fm["category"] or str(r.get(fm["category"], "")).strip().lower() == "investigator"] if fm["category"] else rows
    ids = lambda rs: {r.get(fm["project_id"]) for r in rs}
    inv_ids = ids(inv)
    recorded = [r for r in inv if ACCESSION.search((r.get(fm["accession"]) if fm["accession"] else "") or "")]
    by_type = defaultdict(set)
    for c in cands:
        if c["project_id"] in inv_ids: by_type[c["candidate_type"]].add(c["project_id"])
    any_cand = set().union(*by_type.values()) if by_type else set()
    lines = ["# Public-record lookup, summary", "",
             f"Inventory rows: {len(rows)}; investigator projects: {len(inv)} (counts below are investigator projects).", "",
             f"- Accession recorded in the accession field: {len(recorded)}",
             f"- Accession mentioned in another field, none recorded: {len(by_type['accession_in_other_field'])}",
             f"- Publication identifier (PMID or DOI) in some field: {len(by_type['pmid_in_field'] | by_type['doi_in_field'] | by_type['publication_in_accession_field'])}",
             f"- Accession field holds other text (a name, a note): {len(by_type['text_in_accession_field'])}"]
    if online:
        lines.append(f"- GEO series by the same submitter, matched by year and words: {len(by_type['geo_by_submitter'])}")
    lines += [f"- Investigator projects with at least one candidate of any kind: {len(any_cand)}", "",
              "## Caveats", "",
              "- A candidate is a lead, not a deposition. An accession in a title or purpose is often a public dataset the project re-analysed, not the project's own data.",
              "- The submitter search finds series by surname; a common surname brings in other labs' series. The score is word overlap, nothing more.",
              "- Confirming a candidate is a person's job; record the decision in the decision and decided_by columns, and the provenance becomes `reviewed`.",
              "- Nothing here was written back to the inventory."]
    if not online:
        lines.append("- Online pass not run (add --ncbi). The counts above come from the inventory's own text.")
    return "\n".join(lines) + "\n"

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inventory"); ap.add_argument("--sheet", default=None); ap.add_argument("--out", default="lookup")
    ap.add_argument("--ncbi", action="store_true", help="also query GEO by submitter (needs network)")
    ap.add_argument("--since", type=int, default=2015, help="earliest GEO publication year for the submitter search")
    ap.add_argument("--pause", type=float, default=0.4, help="seconds between NCBI requests (0.1 with an API key)")
    a = ap.parse_args()
    headers, rows = read_table(a.inventory, a.sheet)
    fm = map_fields(headers)
    if not fm["project_id"]: sys.exit(f"No project identifier column found in: {headers}")
    print("Field map:", {k: v for k, v in fm.items() if v})
    cands = offline_candidates(rows, fm)
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    if a.ncbi:
        cache_path = out / "ncbi_cache.json"
        cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
        try:
            cands += ncbi_candidates(rows, fm, cache, a.pause, a.since)
        finally:
            cache_path.write_text(json.dumps(cache))
    cols = list(cands[0].keys()) if cands else ["project_id"]
    with open(out / "lookup_candidates.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(cands)
    summary = summarise(rows, fm, cands, a.ncbi)
    (out / "lookup_summary.md").write_text(summary)
    print(summary)
    print(f"Wrote {out/'lookup_candidates.csv'} ({len(cands)} candidates) and {out/'lookup_summary.md'}")

if __name__ == "__main__":
    main()
