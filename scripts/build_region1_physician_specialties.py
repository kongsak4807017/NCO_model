#!/usr/bin/env python3
"""Read-only Region 1 physician specialty aggregation from existing HR Blueprint SQLite.
No names, IDs, licenses, or person-level rows leave this process.
The HR specialty/qualification labels are NOT CheckMD verification.
"""
from __future__ import annotations
import argparse
import collections
import datetime as dt
import json
import re
import sqlite3
from pathlib import Path

REGION1 = {
    "50": "เชียงใหม่", "51": "ลำพูน", "52": "ลำปาง", "54": "แพร่",
    "55": "น่าน", "56": "พะเยา", "57": "เชียงราย", "58": "แม่ฮ่องสอน",
}
RAW_FIELDS = (
    "employee_id", "name", "surname", "line_position_name", "pay_line_position_name",
    "position_name_th", "position_specialist_name", "pay_position_specialist_name",
    "highest_specialist_name", "position_education_specialist_name",
    "enrollment_specialist_name", "fte_specialist_name", "code5", "pos_code5",
    "province_code", "pos_province_code", "rev_name", "pos_rev_name",
    "unit_name", "fte_percentage",
)
POSITION_FIELDS = ("position_specialist_name", "pay_position_specialist_name")
CREDENTIAL_FIELDS = (
    "highest_specialist_name", "position_education_specialist_name",
    "enrollment_specialist_name", "fte_specialist_name",
)
EMPTY_LABELS = {"", "ไม่ระบุสาขา", "ไม่ระบุ", "ไม่มีข้อมูล", "null", "none", "-", "ทั่วไป"}


def clean(value) -> str:
    return str(value or "").strip()


def norm(value) -> str:
    value = re.sub(r"^(?:สาขา|อนุสาขา)\s*", "", clean(value), flags=re.I)
    value = re.sub(r"\([^)]*\)", "", value)
    return re.sub(r"[\s\u200b._-]+", "", value).casefold()


def identify_doctor(row) -> bool:
    labels = [clean(row.get(field)) for field in ("line_position_name", "pay_line_position_name", "position_name_th")]
    return any("นายแพทย์" in label and "ทันต" not in label and "สัตว" not in label for label in labels)


def sqlite_columns(conn, table):
    return {r["name"] for r in conn.execute("PRAGMA table_info(" + table + ")")}


def select_raw(conn):
    columns = sqlite_columns(conn, "hr_personnel")
    selected = [c for c in RAW_FIELDS if c in columns]
    if not {"province_code", "name", "surname"}.issubset(columns):
        raise ValueError("hr_personnel lacks mandatory province/name/surname fields")
    query = "SELECT " + ",".join('"' + col + '"' for col in selected) + " FROM hr_personnel"
    for r in conn.execute(query):
        yield dict(r)


def select_normalized(conn):
    aa, pp, uu = (sqlite_columns(conn, t) for t in ("assignment", "position", "organizational_unit"))
    required = {"personnel_id", "position_id", "unit_id"}
    if not {"personnel_id", "position_id"}.issubset(aa) or not {"position_id", "position_name_th"}.issubset(pp) or not {"unit_id", "province_code", "unit_name"}.issubset(uu):
        raise ValueError("normalized HR schema lacks required IDs, profession or organization fields")
    unit_ref = "a.unit_id" if "unit_id" in aa else "p.unit_id"
    if unit_ref == "p.unit_id" and "unit_id" not in pp:
        raise ValueError("cannot identify assignment unit_id")
    fields = [
        "a.personnel_id AS employee_id", "p.position_name_th AS line_position_name",
        "ou.province_code AS province_code", "ou.unit_name AS unit_name",
    ]
    for col in ("code5", "amphur_code"):
        if col in uu:
            fields.append("ou." + col + " AS " + col)
    for col in ("position_specialist_name", "pay_position_specialist_name"):
        if col in pp:
            fields.append("p." + col + " AS " + col)
    if "fte_percentage" in aa:
        fields.append("a.fte_percentage AS fte_percentage")
    sql = "SELECT " + ", ".join(fields) + (
        " FROM assignment a JOIN position p ON p.position_id=a.position_id "
        "JOIN organizational_unit ou ON ou.unit_id=" + unit_ref
    )
    wheres = []
    if "status" in aa:
        wheres.append("a.status='active'")
    if "end_date" in aa:
        wheres.append("(a.end_date IS NULL OR TRIM(a.end_date)='')")
    if "position_status" in pp:
        wheres.append("(p.position_status='filled' OR p.position_status IS NULL)")
    if wheres:
        sql += " WHERE " + " AND ".join(wheres)
    for row in conn.execute(sql):
        yield dict(row)


def load_records(db_path: Path):
    if not db_path.is_file():
        raise FileNotFoundError("HR SQLite database not accessible: " + str(db_path))
    # sqlite3's query_only protects the existing production snapshot from writes.
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only=ON")
    try:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "hr_personnel" in tables:
            rows = list(select_raw(conn))
            if rows:
                return "hr_personnel", rows
        required = {"assignment", "position", "organizational_unit"}
        if required.issubset(tables):
            return "assignment/position/organizational_unit", list(select_normalized(conn))
        raise ValueError("No compatible HR personnel source table in local database")
    finally:
        conn.close()


def catalog_lookup(catalog):
    seen = {}
    conflicts = set()
    for s in catalog["specialties"]:
        for label in (s.get("name_th"), s.get("name_en")):
            key = norm(label)
            if key in seen and seen[key]["code"] != s["code"]:
                conflicts.add(key)
            else:
                seen[key] = s
    for k in conflicts:
        seen.pop(k, None)
    return seen


def identity(row):
    employee_id = clean(row.get("employee_id"))
    if employee_id:
        return "employee:" + employee_id
    first, last = norm(row.get("name")), norm(row.get("surname"))
    # Names are an internal deduplication fallback only, not public output.
    if first and last:
        return "name:" + first + "|" + last
    return None


def specialty_hint(row):
    for key in POSITION_FIELDS:
        value = clean(row.get(key))
        if norm(value) not in {norm(x) for x in EMPTY_LABELS}:
            return value, "position", key
    for key in CREDENTIAL_FIELDS:
        value = clean(row.get(key))
        if norm(value) not in {norm(x) for x in EMPTY_LABELS}:
            return value, "credential_proxy", key
    return "", "missing", ""


def hospital_ref(row):
    p = clean(row.get("province_code") or row.get("pos_province_code")).zfill(2)
    if p not in REGION1:
        return None
    code = clean(row.get("code5") or row.get("pos_code5"))
    if not re.fullmatch(r"\d{5}", code):
        code = ""
    name = clean(row.get("unit_name") or row.get("rev_name") or row.get("pos_rev_name")) or "ไม่ทราบชื่อหน่วยบริการ"
    return (p, code or "NAME:" + name, code, name)


def aggregate_records(records, catalog, year_be: int, source_table: str):
    lookup = catalog_lookup(catalog)
    groups = {}
    qc = collections.Counter()
    for row in records:
        if not identify_doctor(row):
            continue
        qc["doctor_source_rows"] += 1
        site, who = hospital_ref(row), identity(row)
        if site is None:
            qc["invalid_region_rows"] += 1
            continue
        if who is None:
            qc["missing_identity_rows"] += 1
            continue
        if who.startswith("name:"):
            qc["name_fallback_rows"] += 1
        raw, evidence_type, evidence_field = specialty_hint(row)
        ref = lookup.get(norm(raw)) if raw else None
        key = (site[0], site[1], who)
        obj = groups.setdefault(key, {
            "site": site, "who": who, "hints": set(), "evidence": set(),
            "fte": [], "missing_fte": False,
        })
        # Exact mapping only. Unknown source names remain unresolved.
        obj["hints"].add((ref["code"] if ref else None, raw, evidence_type, evidence_field))
        if "fte_percentage" in row and row["fte_percentage"] is not None and clean(row["fte_percentage"]) != "":
            try:
                v = float(row["fte_percentage"])
                if not (0 < v <= 100):
                    raise ValueError()
                obj["fte"].append(v / 100)
            except (TypeError, ValueError):
                obj["missing_fte"] = True
        else:
            obj["missing_fte"] = True

    hospitals = {}
    province_people = collections.defaultdict(set)
    province_by_specialty = collections.defaultdict(lambda: collections.defaultdict(set))
    region_people = set()
    for obj in groups.values():
        prov, sitekey, code, unit = obj["site"]
        who = obj["who"]
        hospital = hospitals.setdefault((prov, sitekey), {
            "province_code": prov, "province_name": REGION1[prov],
            "hospital_code": code or None, "unit_name": unit, "total_doctors": 0,
            "mapped_doctors": 0, "position_mapped": 0, "credential_proxy_mapped": 0,
            "unmapped_doctors": 0, "missing_specialty_doctors": 0,
            "conflict_doctors": 0, "specialties": {},
        })
        hospital["total_doctors"] += 1
        province_people[prov].add(who)
        region_people.add(who)
        hints = obj["hints"]
        codes = {h[0] for h in hints if h[0] is not None}
        unresolved = any(h[0] is None and h[1] for h in hints)
        # Position records take precedence over training-credential proxies;
        # different position labels for the same physician require review.
        primary = {h[0] for h in hints if h[2] == "position" and h[0] is not None}
        candidate = primary or codes
        if len(candidate) > 1:
            hospital["conflict_doctors"] += 1
            qc["conflict_doctors"] += 1
            continue
        if not candidate:
            col = "unmapped_doctors" if unresolved else "missing_specialty_doctors"
            hospital[col] += 1
            qc[col] += 1
            continue
        if unresolved and not primary:
            hospital["unmapped_doctors"] += 1
            qc["unmapped_doctors"] += 1
            continue
        code_match = next(iter(candidate))
        info = next(s for s in catalog["specialties"] if s["code"] == code_match)
        pos = code_match in primary
        classification = "position" if pos else "credential_proxy"
        hotel_spec = hospital["specialties"].setdefault(code_match, {
            "specialty_code": code_match, "specialty_name": info["name_th"],
            "headcount": 0, "position_mapped": 0, "credential_proxy_mapped": 0,
            "checkmd_verified": False,
        })
        hotel_spec["headcount"] += 1
        hotel_spec["position_mapped" if pos else "credential_proxy_mapped"] += 1
        hospital["mapped_doctors"] += 1
        hospital["position_mapped" if pos else "credential_proxy_mapped"] += 1
        province_by_specialty[prov][code_match].add(who)

    out_hospitals = []
    for v in hospitals.values():
        v["specialties"] = sorted(v["specialties"].values(), key=lambda x: (-x["headcount"], x["specialty_name"]))
        out_hospitals.append(v)
    out_hospitals.sort(key=lambda x: (x["province_code"], x["unit_name"], x["hospital_code"] or ""))
    provinces = []
    for prov in REGION1:
        sites = [s for s in out_hospitals if s["province_code"] == prov]
        # Hospital-person assignment count may exceed unique provincial headcount.
        site_assignments = sum(s["total_doctors"] for s in sites)
        provinces.append({
            "province_code": prov, "province_name": REGION1[prov],
            "unique_doctors": len(province_people[prov]), "hospital_assignments": site_assignments,
            "hospitals": len(sites), "mapped_assignments": sum(s["mapped_doctors"] for s in sites),
            "unmapped_assignments": sum(s["unmapped_doctors"] + s["missing_specialty_doctors"] + s["conflict_doctors"] for s in sites),
            "specialties": sorted([
                {"specialty_code": code, "specialty_name": next(s["name_th"] for s in catalog["specialties"] if s["code"] == code),
                 "unique_headcount": len(people), "checkmd_verified": False}
                for code, people in province_by_specialty[prov].items()
            ], key=lambda x: (-x["unique_headcount"], x["specialty_name"])),
        })
    result = {
        "schema_version": "nco-physician-region1-aggregate-v1",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "year_be": year_be, "source": "local hr_blueprint.db / " + source_table,
        "provenance": "HR positions/qualification fields only; NOT verified against CheckMD",
        "privacy": "aggregate_only_private_review",
        "checkmd_verified_count": 0,
        "region": {"unique_doctors": len(region_people), "hospital_assignments": sum(x["total_doctors"] for x in out_hospitals),
                   "mapped_assignments": sum(x["mapped_doctors"] for x in out_hospitals),
                   "hospitals": len(out_hospitals)},
        "provinces": provinces, "hospitals": out_hospitals, "quality": dict(qc),
    }
    return result


def build(db_path: Path, catalog_path: Path, year_be: int):
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    table, records = load_records(db_path)
    return aggregate_records(records, catalog, year_be, table)


def main():
    parser = argparse.ArgumentParser(description="Generate local aggregate physician specialty overview (not CheckMD verified)")
    parser.add_argument("--db", type=Path, required=True, help="Existing HR Blueprint SQLite .db path; read-only")
    parser.add_argument("--catalog", type=Path, default=Path(__file__).resolve().parents[1] / "data/physician_specialties_tmc.json")
    parser.add_argument("--year", type=int, default=2569)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "output/region1_physician_specialty_PRIVATE.json")
    args = parser.parse_args()
    if args.out.resolve() == args.db.resolve():
        parser.error("output must not be the source HR database")
    data = build(args.db, args.catalog, args.year)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Read-only HR aggregate:", data["region"], "| unmatched/missing:", data["quality"], "| saved:", args.out)
    print("CAUTION: Private HR-derived small cells. Do not commit to public GitHub or publish without approval.")


if __name__ == "__main__":
    main()
