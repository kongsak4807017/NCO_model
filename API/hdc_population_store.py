import json
import os
import sqlite3


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")

HDC_POPULATION_REPORT_CODE = "f83d0cd8b830706dab4cd3cb09afa584"
HDC_POPULATION_SUBCATALOG_ID = "ac4eed1bddb23d6130746d62d2538fd0"
HDC_PREFERRED_YEARS = (2569, 2568, 2567, 2566)
HEALTH_REGION1_PROVINCES = ("50", "51", "52", "54", "55", "56", "57", "58")


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_hdc_population_schema(db_path: str | None = None, refresh_if_missing: bool = True):
    conn = get_connection(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS hdc_amphur_population_reference (
            report_code TEXT NOT NULL,
            subcatalog_id TEXT NOT NULL,
            province_code TEXT NOT NULL,
            province_name_th TEXT,
            amphur_code TEXT NOT NULL,
            amphur_name_th TEXT NOT NULL,
            reference_year_be INTEGER NOT NULL,
            male_total INTEGER,
            female_total INTEGER,
            total_population INTEGER,
            age_sex_json TEXT,
            raw_json TEXT,
            source_url TEXT,
            extracted_at TEXT,
            loaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (report_code, province_code, amphur_code)
        )
        """
    )
    conn.commit()
    conn.close()
    if refresh_if_missing and not has_hdc_population_snapshot(db_path=db_path):
        refresh_hdc_population_reference(db_path=db_path)


def has_hdc_population_snapshot(db_path: str | None = None) -> bool:
    conn = get_connection(db_path)
    row = conn.execute(
        "SELECT COUNT(*) AS count_rows FROM hdc_amphur_population_reference WHERE report_code = ?",
        (HDC_POPULATION_REPORT_CODE,),
    ).fetchone()
    conn.close()
    return bool(row and row["count_rows"])


def _parse_int(value) -> int | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text or text.upper() == "ALL":
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _extract_age_sex_map(raw_row: dict) -> dict:
    age_map: dict[str, dict[str, int]] = {}
    for key, value in raw_row.items():
        text_key = str(key).strip().lower()
        if len(text_key) < 2 or text_key[0] not in {"m", "f"}:
            continue
        age_num = text_key[1:]
        if not age_num.isdigit():
            continue
        age_index = int(age_num)
        if age_index >= 103:
            continue
        parsed = _parse_int(value)
        if parsed is None:
            continue
        bucket = age_map.setdefault(str(age_index), {"male": 0, "female": 0})
        if text_key.startswith("m"):
            bucket["male"] = parsed
        else:
            bucket["female"] = parsed
    return age_map


def _population_row_from_fact_row(row: sqlite3.Row) -> dict:
    raw_row = json.loads(row["raw_json"]) if row["raw_json"] else {}
    age_sex_map = _extract_age_sex_map(raw_row)
    male_total = _parse_int(raw_row.get("m103"))
    female_total = _parse_int(raw_row.get("f103"))
    total_population = _parse_int(raw_row.get("total"))
    if male_total is None:
        male_total = sum(bucket.get("male", 0) for bucket in age_sex_map.values())
    if female_total is None:
        female_total = sum(bucket.get("female", 0) for bucket in age_sex_map.values())
    if total_population is None:
        total_population = (male_total or 0) + (female_total or 0)
    return {
        "report_code": HDC_POPULATION_REPORT_CODE,
        "subcatalog_id": HDC_POPULATION_SUBCATALOG_ID,
        "province_code": row["province_code"],
        "province_name_th": row["province_name"],
        "amphur_code": row["amphur_code"],
        "amphur_name_th": row["amphur_name"],
        "reference_year_be": row["year_be"],
        "male_total": male_total,
        "female_total": female_total,
        "total_population": total_population,
        "age_sex_json": json.dumps(age_sex_map, ensure_ascii=False),
        "raw_json": row["raw_json"],
        "source_url": row["source_url"],
        "extracted_at": row["extracted_at"],
    }


def _load_fact_rows_for_population(conn: sqlite3.Connection, province_code: str, year_be: int) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT report_code, province_code, province_name, amphur_code, amphur_name,
               year_be, raw_json, source_url, extracted_at
        FROM fact_pp_outcome_district
        WHERE report_code = ?
          AND province_code = ?
          AND year_be = ?
          AND display_level = 'ampur'
        ORDER BY amphur_code, amphur_name
        """,
        (HDC_POPULATION_REPORT_CODE, str(province_code), int(year_be)),
    ).fetchall()


def refresh_hdc_population_reference(
    db_path: str | None = None,
    province_codes: list[str] | tuple[str, ...] | None = None,
    preferred_years: tuple[int, ...] = HDC_PREFERRED_YEARS,
    headless: bool = True,
) -> dict:
    build_hdc_population_schema(db_path=db_path, refresh_if_missing=False)
    try:
        from extract_pp_hdc import extract_district_rows
    except ImportError:
        from API.extract_pp_hdc import extract_district_rows

    conn = get_connection(db_path)
    province_codes = tuple(str(code) for code in (province_codes or HEALTH_REGION1_PROVINCES))
    province_name_lookup = {
        str(row["province_code"]): row["province_name_th"]
        for row in conn.execute("SELECT province_code, province_name_th FROM provinces").fetchall()
    }
    results = []
    total_rows = 0
    for province_code in province_codes:
        selected_year = None
        last_error = None
        fact_rows: list[sqlite3.Row] = []
        for year_be in preferred_years:
            try:
                result = extract_district_rows(
                    report_code=HDC_POPULATION_REPORT_CODE,
                    subcatalog_id=HDC_POPULATION_SUBCATALOG_ID,
                    province_code=str(province_code),
                    year_be=int(year_be),
                    headless=headless,
                )
                if int(result.get("fetched_rows") or 0) <= 0:
                    continue
                fact_rows = _load_fact_rows_for_population(conn, province_code=str(province_code), year_be=int(result["effective_year_be"]))
                if not fact_rows:
                    continue
                selected_year = int(result["effective_year_be"])
                source_url = result.get("source_url")
                break
            except Exception as exc:
                last_error = str(exc)
                continue
        if not selected_year or not fact_rows:
            results.append(
                {
                    "province_code": str(province_code),
                    "status": "failed",
                    "error": last_error or "No non-empty HDC population rows found",
                }
            )
            continue

        population_rows = [_population_row_from_fact_row(row) for row in fact_rows]
        for row in population_rows:
            row["province_name_th"] = row.get("province_name_th") or province_name_lookup.get(str(row["province_code"]))
        conn.execute(
            "DELETE FROM hdc_amphur_population_reference WHERE report_code = ? AND province_code = ?",
            (HDC_POPULATION_REPORT_CODE, str(province_code)),
        )
        conn.executemany(
            """
            INSERT INTO hdc_amphur_population_reference (
                report_code, subcatalog_id, province_code, province_name_th, amphur_code, amphur_name_th,
                reference_year_be, male_total, female_total, total_population, age_sex_json, raw_json,
                source_url, extracted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["report_code"],
                    row["subcatalog_id"],
                    row["province_code"],
                    row["province_name_th"],
                    row["amphur_code"],
                    row["amphur_name_th"],
                    row["reference_year_be"],
                    row["male_total"],
                    row["female_total"],
                    row["total_population"],
                    row["age_sex_json"],
                    row["raw_json"],
                    row["source_url"],
                    row["extracted_at"],
                )
                for row in population_rows
            ],
        )
        conn.commit()
        total_rows += len(population_rows)
        results.append(
            {
                "province_code": str(province_code),
                "status": "success",
                "reference_year_be": selected_year,
                "row_count": len(population_rows),
                "source_url": source_url,
            }
        )
    conn.close()
    success_count = sum(1 for item in results if item["status"] == "success")
    return {
        "report_code": HDC_POPULATION_REPORT_CODE,
        "preferred_years": list(preferred_years),
        "province_count": len(province_codes),
        "success_count": success_count,
        "failed_count": len(results) - success_count,
        "row_count": total_rows,
        "results": results,
    }


def get_hdc_amphur_population(province_code: str, amphur_code: str, db_path: str | None = None) -> dict | None:
    build_hdc_population_schema(db_path=db_path)
    conn = get_connection(db_path)
    row = conn.execute(
        """
        SELECT *
        FROM hdc_amphur_population_reference
        WHERE province_code = ?
          AND amphur_code = ?
        LIMIT 1
        """,
        (str(province_code), str(amphur_code)),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def list_hdc_population_rows(province_code: str | None = None, db_path: str | None = None) -> list[dict]:
    build_hdc_population_schema(db_path=db_path)
    conn = get_connection(db_path)
    if province_code:
        rows = conn.execute(
            """
            SELECT *
            FROM hdc_amphur_population_reference
            WHERE province_code = ?
            ORDER BY amphur_code
            """,
            (str(province_code),),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM hdc_amphur_population_reference ORDER BY province_code, amphur_code"
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
