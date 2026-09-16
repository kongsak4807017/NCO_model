"""Generate a static district baseline for the HR Blueprint GitHub Pages simulator.

The output is intentionally factual-only:
- District/population reference comes from the DOPA population source already used by
  API/amphur_population_store.py.
- District HR counts are aggregated from a local hr_blueprint.db only when that
  database is present.
- Missing HR data stays null and is marked hr_available=false. Nothing is inferred
  from provincial totals.

Run locally after refreshing hr_blueprint.db to publish richer district HR data:
    python scripts/generate_region1_district_hr_baseline.py
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGION1_PROVINCES = {"50", "51", "52", "54", "55", "56", "57", "58"}
PROFESSIONS = {
    "doctor": "นายแพทย์",
    "nurse": "พยาบาลวิชาชีพ",
    "pharmacist": "เภสัชกร",
}


def _empty_hr_values() -> dict:
    values = {
        "hr_available": False,
        "vacant_all": None,
        "retire_5y_all": None,
    }
    for key in PROFESSIONS:
        values[key] = None
        values[f"vacant_{key}"] = None
        values[f"retire_5y_{key}"] = None
    return values


def _aggregate_hr(db_path: Path | None, snapshot_date: dt.date) -> dict[tuple[str, str], dict]:
    if not db_path or not Path(db_path).exists():
        return {}

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    required_tables = {"organizational_unit", "position", "assignment", "personnel"}
    existing = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    if not required_tables.issubset(existing):
        conn.close()
        return {}

    rows_by_key: dict[tuple[str, str], dict] = {}
    for row in conn.execute(
        """
        SELECT DISTINCT province_code, amphur_code, COALESCE(amphur_name, '') AS amphur_name
        FROM organizational_unit
        WHERE province_code IS NOT NULL AND TRIM(province_code) <> ''
          AND amphur_code IS NOT NULL AND TRIM(amphur_code) <> ''
        """
    ).fetchall():
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key[0] not in REGION1_PROVINCES:
            continue
        rows_by_key[key] = {
            **_empty_hr_values(),
            "hr_available": True,
            "amphur_name_hr": row["amphur_name"] or "",
        }
        rows_by_key[key]["vacant_all"] = 0
        rows_by_key[key]["retire_5y_all"] = 0
        for code in PROFESSIONS:
            rows_by_key[key][code] = 0
            rows_by_key[key][f"vacant_{code}"] = 0
            rows_by_key[key][f"retire_5y_{code}"] = 0

    placeholders = ",".join("?" for _ in PROFESSIONS)
    profession_names = list(PROFESSIONS.values())

    filled_rows = conn.execute(
        f"""
        SELECT ou.province_code, ou.amphur_code, p.position_name_th, COUNT(*) AS n
        FROM assignment a
        JOIN position p ON p.position_id = a.position_id
        JOIN organizational_unit ou ON ou.unit_id = a.unit_id
        WHERE a.status = 'active'
          AND p.position_status = 'filled'
          AND p.position_name_th IN ({placeholders})
        GROUP BY ou.province_code, ou.amphur_code, p.position_name_th
        """,
        profession_names,
    ).fetchall()
    for row in filled_rows:
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key not in rows_by_key:
            continue
        for code, label in PROFESSIONS.items():
            if row["position_name_th"] == label:
                rows_by_key[key][code] = int(row["n"])

    vacancy_rows = conn.execute(
        """
        SELECT ou.province_code, ou.amphur_code, COUNT(*) AS n
        FROM position p
        JOIN organizational_unit ou ON ou.unit_id = p.unit_id
        WHERE p.position_status = 'vacant'
        GROUP BY ou.province_code, ou.amphur_code
        """
    ).fetchall()
    for row in vacancy_rows:
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key in rows_by_key:
            rows_by_key[key]["vacant_all"] = int(row["n"])

    vacancy_prof_rows = conn.execute(
        f"""
        SELECT ou.province_code, ou.amphur_code, p.position_name_th, COUNT(*) AS n
        FROM position p
        JOIN organizational_unit ou ON ou.unit_id = p.unit_id
        WHERE p.position_status = 'vacant'
          AND p.position_name_th IN ({placeholders})
        GROUP BY ou.province_code, ou.amphur_code, p.position_name_th
        """,
        profession_names,
    ).fetchall()
    for row in vacancy_prof_rows:
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key not in rows_by_key:
            continue
        for code, label in PROFESSIONS.items():
            if row["position_name_th"] == label:
                rows_by_key[key][f"vacant_{code}"] = int(row["n"])

    cutoff = snapshot_date.replace(year=snapshot_date.year + 5)
    retire_rows = conn.execute(
        """
        SELECT ou.province_code, ou.amphur_code, COUNT(*) AS n
        FROM personnel per
        JOIN assignment a ON a.personnel_id = per.personnel_id
        JOIN organizational_unit ou ON ou.unit_id = a.unit_id
        WHERE per.retirement_date IS NOT NULL
          AND date(per.retirement_date) <= date(?)
          AND per.is_active = 1
          AND a.status = 'active'
        GROUP BY ou.province_code, ou.amphur_code
        """,
        (cutoff.isoformat(),),
    ).fetchall()
    for row in retire_rows:
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key in rows_by_key:
            rows_by_key[key]["retire_5y_all"] = int(row["n"])

    retire_prof_rows = conn.execute(
        f"""
        SELECT ou.province_code, ou.amphur_code, p.position_name_th, COUNT(*) AS n
        FROM personnel per
        JOIN assignment a ON a.personnel_id = per.personnel_id
        JOIN position p ON p.position_id = a.position_id
        JOIN organizational_unit ou ON ou.unit_id = a.unit_id
        WHERE per.retirement_date IS NOT NULL
          AND date(per.retirement_date) <= date(?)
          AND per.is_active = 1
          AND a.status = 'active'
          AND p.position_status = 'filled'
          AND p.position_name_th IN ({placeholders})
        GROUP BY ou.province_code, ou.amphur_code, p.position_name_th
        """,
        (cutoff.isoformat(), *profession_names),
    ).fetchall()
    for row in retire_prof_rows:
        key = (str(row["province_code"]), str(row["amphur_code"]))
        if key not in rows_by_key:
            continue
        for code, label in PROFESSIONS.items():
            if row["position_name_th"] == label:
                rows_by_key[key][f"retire_5y_{code}"] = int(row["n"])

    conn.close()
    return rows_by_key


def build_district_rows(
    population_rows: list[dict],
    db_path: Path | str | None,
    snapshot_date: dt.date | None = None,
) -> list[dict]:
    snapshot_date = snapshot_date or dt.date.today()
    db = Path(db_path) if db_path else None
    hr_by_key = _aggregate_hr(db, snapshot_date)

    grouped: dict[tuple[str, str], dict] = {}
    for source in population_rows:
        province_code = str(source.get("province_code") or "")
        amphur_code = str(source.get("amphur_code") or "")
        if province_code not in REGION1_PROVINCES or not amphur_code:
            continue
        key = (province_code, amphur_code)
        row = grouped.setdefault(
            key,
            {
                "province_code": province_code,
                "province": source.get("province_name_th") or "",
                "amphur_code": amphur_code,
                "amphur_name": source.get("amphur_name_th") or "",
                "population_by_year": {},
                "population_detail_by_year": {},
                **_empty_hr_values(),
            },
        )
        year = source.get("reference_year_be")
        if year is not None:
            year_key = str(int(year))
            population = source.get("total_population")
            row["population_by_year"][year_key] = int(population or 0)
            row["population_detail_by_year"][year_key] = {
                "male_total": source.get("male_total"),
                "female_total": source.get("female_total"),
                "house_total": source.get("house_total"),
            }

    for key, hr in hr_by_key.items():
        if key not in grouped:
            grouped[key] = {
                "province_code": key[0],
                "province": "",
                "amphur_code": key[1],
                "amphur_name": hr.get("amphur_name_hr") or "",
                "population_by_year": {},
                "population_detail_by_year": {},
                **_empty_hr_values(),
            }
        grouped[key].update({k: v for k, v in hr.items() if k != "amphur_name_hr"})
        if not grouped[key].get("amphur_name"):
            grouped[key]["amphur_name"] = hr.get("amphur_name_hr") or ""

    return sorted(
        grouped.values(),
        key=lambda item: (item["province_code"], item["amphur_code"], item["amphur_name"]),
    )


def load_population_rows_from_dopa() -> tuple[list[dict], dict]:
    # Import lazily so unit tests for aggregation do not require pandas/requests.
    from API.amphur_population_store import (
        DOPA_RESOURCE_PAGE,
        DOPA_RESOURCE_URL,
        _download_cached_zip,
        _parse_html_xls_from_zip,
    )

    records = _parse_html_xls_from_zip(_download_cached_zip())
    region_rows = [row for row in records if str(row.get("province_code")) in REGION1_PROVINCES]
    if not region_rows:
        return [], {"source_url": DOPA_RESOURCE_URL, "source_page_url": DOPA_RESOURCE_PAGE}

    # Use the latest factual month in the source file. Do not interpolate missing years.
    latest_yymm = max(int(row.get("reference_yymm") or 0) for row in region_rows)
    latest_rows = [row for row in region_rows if int(row.get("reference_yymm") or 0) == latest_yymm]
    return latest_rows, {
        "source_url": DOPA_RESOURCE_URL,
        "source_page_url": DOPA_RESOURCE_PAGE,
        "reference_yymm": latest_yymm,
        "reference_year_be": int(latest_yymm // 100) + 2500,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=str(ROOT / "hr_blueprint.db"))
    parser.add_argument(
        "--output",
        default=str(ROOT / "output" / "hr_blueprint_district_baseline_region1.json"),
    )
    args = parser.parse_args()

    population_rows, population_source = load_population_rows_from_dopa()
    db_path = Path(args.db)
    hr_db_path = db_path if db_path.exists() else None
    snapshot_date = dt.date.today()
    rows = build_district_rows(population_rows, hr_db_path, snapshot_date=snapshot_date)

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "snapshot_date": snapshot_date.isoformat(),
        "mode": "historical_actual",
        "rows": rows,
        "sources": {
            "population": {
                **population_source,
                "note": "Actual DOPA district population snapshot; only the documented year is populated.",
            },
            "workforce": {
                "available": bool(hr_db_path),
                "source": "hr_blueprint.db" if hr_db_path else None,
                "note": (
                    "District HR snapshot aggregated from local hr_blueprint.db."
                    if hr_db_path
                    else "hr_blueprint.db is not committed to GitHub; HR fields remain null until exported from a verified local database."
                ),
            },
        },
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output} ({len(rows)} districts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
