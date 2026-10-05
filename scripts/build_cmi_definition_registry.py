#!/usr/bin/env python3
"""Build/refresh CMI indicator definition registry from archived source pages.

This script is deliberately metadata-first. It can produce a usable indicator
definition even when a hospital/year observation is missing.

Derivation priority:
1) Existing verified definition entries in data/cmi/catalog/definitions.json
2) Latest archived CMI source page table headings
3) Catalog title/source URL only (status=pending_source_page)

It does not infer clinical ICD/procedure criteria that are not visible in source
metadata. HOSxP mapping remains logical rather than hard-coded to one database
version/site schema.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

CATALOG = Path("data/cmi/catalog/indicators.json")
DEFINITIONS = Path("data/cmi/catalog/definitions.json")
RAW = Path("data/cmi/raw")
YEARS = [2569,2568,2567,2566,2565]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def source_url(code, family):
    base = "https://cmi.maewanghospital.go.th/web/index.php"
    if family == "service_plan":
        return f"{base}?co_thip_new={code}&r=service%2Findex"
    return f"{base}?id={code}&r=report%2Fdrgindexreport"


def title_from_page(soup, code):
    for tag in soup.find_all(["h1","h2","h3","h4","h5"]):
        text = clean(tag.get_text(" ", strip=True))
        if code.lower() in text.lower():
            return clean(re.sub(re.escape(code), "", text, flags=re.I).strip(" :-")) or code
    return code


def best_table_headers(soup):
    for table in soup.find_all("table"):
        rows=[]
        for tr in table.find_all("tr"):
            cells=[clean(x.get_text(" ",strip=True)) for x in tr.find_all(["th","td"])]
            if cells: rows.append(cells)
        for row in rows[:8]:
            joined=" | ".join(row)
            if ("สถานพยาบาล" in joined or "หน่วยบริการ" in joined) and len(row)>=4:
                return row
    return []


def classify_formula(headers, page_text):
    joined=" ".join(headers + [page_text]).lower()
    output=headers[-1] if headers else ""
    o=output.lower()
    if "ร้อยละ" in o or "%" in o:
        return "percentage", "numerator / denominator × 100", "%"
    if "เฉลี่ย" in o:
        if "adjrw" in joined or "adj.rw" in joined:
            return "average", "numerator / denominator", "AdjRW/case"
        if "วันนอน" in joined:
            return "average", "numerator / denominator", "days/case"
        if "ค่ารักษา" in joined or "ค่าใช้จ่าย" in joined:
            return "average", "numerator / denominator", "THB/case"
        return "average", "numerator / denominator", ""
    if "ต่อแสน" in joined or "100,000" in joined or "100000" in joined:
        return "rate", "numerator / denominator × 100000", "/100k"
    if "ต่อพัน" in joined or "1,000" in joined or "1000" in joined:
        return "rate", "numerator / denominator × 1000", "/1000"
    return "source_defined", "", ""


def logical_hosxp_source(text):
    t=text.lower()
    out=["patient identifier","encounter date/fiscal year"]
    if any(k in t for k in ["ผู้ป่วยใน","admit","จำหน่าย","วันนอน","los","ผ่าตัด","เสียชีวิต","ตาย","adjrw","drg"]):
        out += ["AN","admit date","discharge date"]
    else:
        out += ["VN/AN as defined by indicator"]
    if any(k in t for k in ["โรค","diagnosis","icd","stroke","ami","sepsis","fracture","ไส้ติ่ง","ไส้เลื่อน","hiv"]):
        out += ["ICD-10 diagnosis"]
    if any(k in t for k in ["ผ่าตัด","procedure","operation","หัตถการ","ods"]):
        out += ["procedure/operation code","procedure date/time"]
    if any(k in t for k in ["เสียชีวิต","ตาย","mortality"]):
        out += ["discharge/death status"]
    if any(k in t for k in ["อายุ","เด็ก","ผู้สูงอายุ"]):
        out += ["DOB/age at encounter"]
    if "วันนอน" in t or "los" in t:
        out += ["LOS/occupied days"]
    if "adjrw" in t or "adj.rw" in t or "cmi" in t:
        out += ["DRG/AdjRW"]
    if "ค่ารักษา" in t or "ค่าใช้จ่าย" in t:
        out += ["charge/cost/claim amount"]
    # preserve order, remove duplicates
    return list(dict.fromkeys(out))


def derive_from_page(path, item):
    code=item["code"]
    html=path.read_text(encoding="utf-8",errors="replace")
    soup=BeautifulSoup(html,"lxml")
    headers=best_table_headers(soup)
    page_text=clean(soup.get_text(" ",strip=True))
    name=title_from_page(soup,code) or item.get("name") or code
    measure_type, formula, unit=classify_formula(headers,page_text)

    # Remove obvious dimension columns; remaining numeric labels are source operands/output.
    dims={"ชื่อจังหวัด","จังหวัด","ระดับ","สถานพยาบาล","หน่วยบริการ"}
    metric_headers=[h for h in headers if clean(h) not in dims]
    numerator=metric_headers[0] if len(metric_headers)>=2 else ""
    denominator=metric_headers[1] if len(metric_headers)>=3 else ""
    output_label=metric_headers[-1] if metric_headers else ""

    # If only two metric columns and second is output (e.g. count + average), don't claim denominator.
    if len(metric_headers)==2 and any(k in output_label.lower() for k in ["ร้อยละ","เฉลี่ย","อัตรา"]):
        denominator=""

    raw_hash=hashlib.sha256(html.encode("utf-8",errors="replace")).hexdigest()
    combined=" | ".join([name,numerator,denominator,output_label])
    return {
        "indicator_code":code,
        "indicator_name":name,
        "family":item.get("family"),
        "definition_status":"source_page_metadata_derived",
        "definition_version":raw_hash[:16],
        "source_url":item.get("source_url") or source_url(code,item.get("family")),
        "source_file":str(path),
        "source_sha256":raw_hash,
        "measure_type":measure_type,
        "numerator_label":numerator,
        "denominator_label":denominator,
        "output_label":output_label,
        "formula":formula,
        "unit":unit,
        "hosxp_logical_source":logical_hosxp_source(combined),
        "hosxp_mapping_status":"logical_ready_physical_mapping_pending",
        "physical_mapping_note":"Map logical fields to the local HOSxP/HOSxP XE schema/report version; do not assume one physical table layout across all sites."
    }


def main():
    catalog=json.loads(CATALOG.read_text(encoding="utf-8"))
    existing=json.loads(DEFINITIONS.read_text(encoding="utf-8")) if DEFINITIONS.exists() else {"indicators":[]}
    existing_map={x["indicator_code"]:x for x in existing.get("indicators",[])}

    definitions=[]
    for item in catalog.get("indicators",[]):
        code=str(item.get("code") or "").upper()
        prior=existing_map.get(code,{})
        page_path=None
        definition_candidate = RAW/"definitions"/f"{code}.html"
        if definition_candidate.exists():
            page_path = definition_candidate
        else:
            for year in YEARS:
                candidate=RAW/str(year)/f"{code}.html"
                if candidate.exists():
                    page_path=candidate
                    break

        if page_path:
            derived=derive_from_page(page_path,{**item,"code":code})
            # Preserve manually/source-verified fields over heuristic page-derived ones.
            if str(prior.get("definition_status","")).startswith("verified_"):
                derived={**derived,**prior}
            else:
                for field in ("numerator_label","denominator_label","formula","unit","hosxp_logical_source"):
                    if prior.get(field):
                        derived[field]=prior[field]
            definitions.append(derived)
        else:
            definitions.append({
                **prior,
                "indicator_code":code,
                "indicator_name":prior.get("indicator_name") or item.get("name") or code,
                "family":prior.get("family") or item.get("family"),
                "definition_status":prior.get("definition_status") or "pending_source_page",
                "source_url":prior.get("source_url") or item.get("source_url") or source_url(code,item.get("family")),
                "measure_type":prior.get("measure_type") or "",
                "numerator_label":prior.get("numerator_label") or "",
                "denominator_label":prior.get("denominator_label") or "",
                "formula":prior.get("formula") or "",
                "unit":prior.get("unit") or "",
                "hosxp_logical_source":prior.get("hosxp_logical_source") or [],
                "hosxp_mapping_status":prior.get("hosxp_mapping_status") or "pending_source_page",
                "physical_mapping_note":prior.get("physical_mapping_note") or "Await CMI definition metadata; then map logical fields to local HOSxP schema."
            })

    doc={
        "schema_version":"nco-cmi-definition-registry-v1",
        "generated_at":now_iso(),
        "source_system":"CMI / Service Plan Region 1",
        "policy":existing.get("policy",{}),
        "hosxp_logical_dictionary":existing.get("hosxp_logical_dictionary",{}),
        "indicators":sorted(definitions,key=lambda x:x["indicator_code"])
    }
    DEFINITIONS.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    ready=sum(1 for x in definitions if x.get("definition_status")!="pending_source_page")
    print(f"CMI definitions ready: {ready}/{len(definitions)}")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
