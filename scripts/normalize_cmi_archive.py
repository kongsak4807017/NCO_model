#!/usr/bin/env python3
"""Normalize archived CMI pages into the five-year NCO Health KPI snapshot."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

YEARS = [2565, 2566, 2567, 2568, 2569]
RAW = Path("data/cmi/raw")
CATALOG = Path("data/cmi/catalog/indicators.json")
NORMALIZED = Path("data/cmi/normalized")
MANIFESTS = Path("data/cmi/manifests")
MERGED = Path("output/cmi_5y/health_kpi_records.json")

REGION1_PROVINCES = {"เชียงใหม่","เชียงราย","ลำพูน","ลำปาง","แพร่","น่าน","พะเยา","แม่ฮ่องสอน"}
HOSP_RE = re.compile(r"^\s*(\d{5})\s*(.*)$")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value):
    t = clean(value).replace(",", "").replace("%", "")
    if t in {"", "-", "—", "N/A", "NA"}:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", t)
    return float(m.group(0)) if m else None


def sha256_file(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def table_rows(table):
    rows = []
    for tr in table.find_all("tr"):
        cells = [clean(c.get_text(" ", strip=True)) for c in tr.find_all(["th","td"])]
        if any(cells):
            rows.append(cells)
    return rows


def find_header(rows):
    for i, row in enumerate(rows[:10]):
        joined = " | ".join(row)
        if "สถานพยาบาล" in joined or "หน่วยบริการ" in joined:
            return i, row
    return None, None


def header_index(header, terms):
    for i, cell in enumerate(header or []):
        if any(term.lower() in cell.lower() for term in terms):
            return i
    return None


def unit_from_text(text):
    t = clean(text).lower()
    if "ต่อแสน" in t or "100,000" in t or "100000" in t:
        return "/100k"
    if "ต่อพัน" in t or "1,000" in t or "1000" in t:
        return "/1000"
    if "ร้อยละ" in t or "%" in t:
        return "%"
    if "adjrw" in t:
        return "AdjRW"
    return ""


def indicator_name(soup, code):
    for tag in soup.find_all(["h1","h2","h3","h4","h5"]):
        text = clean(tag.get_text(" ", strip=True))
        if code.lower() in text.lower():
            return clean(re.sub(re.escape(code), "", text, flags=re.I).strip(" :-")) or code
    title = clean(soup.title.get_text(" ", strip=True) if soup.title else "")
    return title or code


def definition_excerpt(soup):
    text = clean(soup.get_text(" ", strip=True))
    hits = []
    for token in ("นิยาม", "ตัวตั้ง", "ตัวหาร", "เกณฑ์", "หมายเหตุ"):
        pos = text.find(token)
        if pos >= 0:
            hits.append(text[max(0, pos-80):pos+700])
    return clean(" | ".join(dict.fromkeys(hits)))[:4000]


def parse_page(html_path: Path, year: int, code: str):
    html = html_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")
    meta_path = html_path.with_suffix(".meta.json")
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    source_url = meta.get("source_url") or meta.get("source_url_requested") or ""
    page_hash = meta.get("sha256") or sha256_file(html_path)
    name = indicator_name(soup, code)
    definition = definition_excerpt(soup)
    definition_hash = hashlib.sha256(definition.encode("utf-8")).hexdigest() if definition else None

    output = []
    for table in soup.find_all("table"):
        rows = table_rows(table)
        hidx, header = find_header(rows)
        if hidx is None:
            continue

        hosp_col = header_index(header, ["สถานพยาบาล","หน่วยบริการ"])
        province_col = header_index(header, ["จังหวัด"])
        level_col = header_index(header, ["ระดับ"])
        numerator_col = header_index(header, ["ตัวตั้ง","numerator"])
        denominator_col = header_index(header, ["ตัวหาร","denominator"])
        value_col = header_index(header, ["ร้อยละ","อัตรา","ผลลัพธ์","ค่าเฉลี่ย","ค่า"])
        page_unit = unit_from_text(" ".join(header) + " " + definition)

        for row in rows[hidx+1:]:
            candidate_indexes = [hosp_col] if hosp_col is not None and hosp_col < len(row) else range(len(row))
            hospital_index = None
            hospital_match = None
            for idx in candidate_indexes:
                m = HOSP_RE.match(clean(row[idx]))
                if m:
                    hospital_index, hospital_match = idx, m
                    break
            if hospital_index is None:
                continue

            hospital_code = hospital_match.group(1)
            hospital_name = clean(hospital_match.group(2))
            province = clean(row[province_col]) if province_col is not None and province_col < len(row) else ""
            if province not in REGION1_PROVINCES:
                province = next((clean(c) for c in row[:hospital_index] if clean(c) in REGION1_PROVINCES), province)
            level = clean(row[level_col]) if level_col is not None and level_col < len(row) else (
                clean(row[hospital_index-1]) if hospital_index > 0 else ""
            )

            numerator = number(row[numerator_col]) if numerator_col is not None and numerator_col < len(row) else None
            denominator = number(row[denominator_col]) if denominator_col is not None and denominator_col < len(row) else None
            value = number(row[value_col]) if value_col is not None and value_col < len(row) else None

            numeric_tail = [number(c) for c in row[hospital_index+1:]]
            numeric_tail = [x for x in numeric_tail if x is not None]
            if numerator is None and denominator is None and len(numeric_tail) >= 3:
                numerator, denominator = numeric_tail[0], numeric_tail[1]
            if value is None and numeric_tail:
                value = numeric_tail[-1]
            if value is None and numerator is None and denominator is None:
                continue

            output.append({
                "year": year,
                "indicator_code": code,
                "indicator_name": name,
                "province": province,
                "hospital_code": hospital_code,
                "hospital_name": hospital_name,
                "service_level": level,
                "numerator": numerator,
                "denominator": denominator,
                "value": value,
                "unit": page_unit,
                "definition_text": definition,
                "definition_hash": definition_hash,
                "source_url": source_url,
                "source_file": str(html_path),
                "source_sha256": page_hash,
                "collected_at": meta.get("collected_at"),
            })

        if output:
            break
    return output


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", default=str(RAW))
    ap.add_argument("--catalog", default=str(CATALOG))
    ap.add_argument("--years", default="2565,2566,2567,2568,2569")
    args = ap.parse_args()

    raw = Path(args.raw_dir)
    years = [int(x) for x in args.years.split(",") if x.strip()]
    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    indicators = catalog.get("indicators", [])

    NORMALIZED.mkdir(parents=True, exist_ok=True)
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    MERGED.parent.mkdir(parents=True, exist_ok=True)

    all_records = []
    completeness = []
    source_files = []

    for item in indicators:
        code = str(item.get("code") or "").upper()
        for year in years:
            html_path = raw / str(year) / f"{code}.html"
            status = "missing"
            parsed_rows = 0
            parse_error = None
            if html_path.exists():
                try:
                    records = parse_page(html_path, year, code)
                    parsed_rows = len(records)
                    all_records.extend(records)
                    status = "parsed" if records else "raw_unparsed"
                    source_files.append({
                        "year": year,
                        "indicator_code": code,
                        "path": str(html_path),
                        "sha256": sha256_file(html_path),
                        "rows": parsed_rows,
                    })
                except Exception as exc:
                    status = "parse_error"
                    parse_error = str(exc)
            completeness.append({
                "indicator_code": code,
                "indicator_name": item.get("name") or code,
                "year": year,
                "status": status,
                "rows": parsed_rows,
                "error": parse_error,
            })

    # Deduplicate exact source keys only. Never merge different indicator codes.
    dedup = {}
    for row in all_records:
        key = (row["year"], row["indicator_code"], row["hospital_code"])
        if key not in dedup:
            dedup[key] = row
        else:
            # Keep the row with more complete numerator/denominator provenance.
            old_score = sum(dedup[key].get(k) is not None for k in ("numerator","denominator","value"))
            new_score = sum(row.get(k) is not None for k in ("numerator","denominator","value"))
            if new_score > old_score:
                dedup[key] = row
    all_records = sorted(dedup.values(), key=lambda r: (r["year"], r["indicator_code"], r["province"], r["hospital_code"]))

    for year in years:
        year_rows = [r for r in all_records if r["year"] == year]
        (NORMALIZED / f"{year}.json").write_text(
            json.dumps({"schema_version":"nco-cmi-normalized-v1","year":year,"records":year_rows}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    expected = len(indicators) * len(years)
    available = sum(1 for x in completeness if x["status"] != "missing")
    parsed = sum(1 for x in completeness if x["status"] == "parsed")
    complete_doc = {
        "schema_version":"nco-cmi-completeness-v1",
        "generated_at":now_iso(),
        "years":years,
        "indicators":completeness,
        "summary":{
            "expected":expected,
            "available":available,
            "parsed":parsed,
            "percent":round((parsed/expected*100) if expected else 0, 2),
        },
        "status":"complete" if expected and parsed == expected else "incomplete",
    }
    (MANIFESTS / "completeness.json").write_text(json.dumps(complete_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (MANIFESTS / "source_manifest.json").write_text(json.dumps({
        "schema_version":"nco-cmi-source-manifest-v1",
        "generated_at":now_iso(),
        "source_system":"CMI / Service Plan Region 1",
        "files":source_files,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    merged = {
        "schema_version":"nco-cmi-kpi-5y-v1",
        "generated_at":now_iso(),
        "source_system":"CMI / Service Plan Region 1",
        "source_base_url":"https://cmi.maewanghospital.go.th/web/index.php",
        "years":years,
        "status":"complete" if expected and parsed == expected else "incomplete",
        "records":all_records,
        "completeness":complete_doc["summary"],
        "catalog_size":len(indicators),
    }
    MERGED.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # CSV is convenient for QA and ad-hoc analysis.
    csv_path = MERGED.with_suffix(".csv")
    fields = ["year","indicator_code","indicator_name","province","hospital_code","hospital_name","service_level",
              "numerator","denominator","value","unit","definition_hash","source_url","source_sha256","collected_at"]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in all_records:
            writer.writerow({k: row.get(k) for k in fields})

    print(f"Normalized {len(all_records)} hospital-indicator-year rows")
    print(f"Completeness: {parsed}/{expected} indicator-years ({complete_doc['summary']['percent']}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
