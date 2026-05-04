from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from typing import Any

import requests

try:
    from analysis_governance_store import get_connection
except ImportError:
    from API.analysis_governance_store import get_connection


PUBLIC_WORKLOAD_SOURCE_DEFINITIONS = [
    {
        "dataset_code": "s_opd_all",
        "dataset_name_th": "อัตราการใช้บริการผู้ป่วยนอก ทุกสิทธิ",
        "metric_code": "opd_per_10k",
        "service_function": "OPD",
        "value_strategy": "annual_result",
        "is_proxy": 0,
        "fallback_years": [2568, 2567],
        "source_note": "Open Data annual outpatient service volume",
    },
    {
        "dataset_code": "s_ipd_all",
        "dataset_name_th": "อัตราการใช้บริการผู้ป่วยใน ทุกสิทธิ",
        "metric_code": "ipd_per_10k",
        "service_function": "IPD",
        "value_strategy": "monthly_result_sum",
        "is_proxy": 0,
        "fallback_years": [2568, 2567],
        "source_note": "Open Data monthly inpatient service days aggregated to annual total",
    },
    {
        "dataset_code": "s_urgency_admit",
        "dataset_name_th": "ผู้ป่วยวิกฤตฉุกเฉิน triage 1-2 ได้ Admit ภายใน 2 ชั่วโมง",
        "metric_code": "er_per_10k",
        "service_function": "ER",
        "value_strategy": "quarter_result_sum",
        "is_proxy": 1,
        "fallback_years": [2568, 2567],
        "source_note": "Emergency workload proxy from urgency admit cases, not all ER visits",
    },
    {
        "dataset_code": "s_pcc1",
        "dataset_name_th": "ข้อมูลพื้นฐานและสรุปผู้รับบริการจำแนกตามหน่วยบริการ",
        "metric_code": "opd_primarycare_per_10k",
        "service_function": "PrimaryCareOPD",
        "value_strategy": "field_opd_visit",
        "is_proxy": 0,
        "fallback_years": [2568, 2567],
        "source_note": "Primary care summary by facility from Open Data; used as supporting workload context",
    },
]


MANUAL_ACTIVITY_CODE_MAP = {
    "OPD_VISIT": ("opd_per_10k", "OPD", 0),
    "IPD_ADMIT": ("ipd_admit_cases_per_10k", "IPD", 0),
    "IPD_DISCHARGE": ("ipd_discharge_cases_per_10k", "IPD", 0),
    "BED_DAYS": ("ipd_per_10k", "IPD", 0),
    "ER_VISIT": ("er_per_10k", "ER", 0),
    "ER_ADMIT": ("er_admit_cases_per_10k", "ER", 0),
    "OR_MAJOR": ("or_per_10k", "OR", 0),
    "OR_MINOR": ("or_per_10k", "OR", 1),
    "ICU_BED_DAYS": ("icu_per_10k", "ICU", 0),
    "DELIVERY": ("delivery_per_10k", "Delivery", 0),
    "CSECTION": ("delivery_per_10k", "Delivery", 1),
    "PT_SESSION": ("rehab_per_10k", "Rehab", 0),
    "REHAB_VISIT": ("rehab_per_10k", "Rehab", 0),
}


def build_service_statistics_schema(cur: sqlite3.Cursor):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS service_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_id TEXT,
            unit_code_18 TEXT,
            unit_name TEXT,
            hospital_level TEXT,
            cadre TEXT,
            specialty TEXT,
            activity_code TEXT,
            activity_name TEXT,
            activity_count INTEGER,
            period_type TEXT,
            period_value TEXT,
            as_of_date TEXT,
            source_name TEXT,
            notes TEXT,
            imported_at TEXT
        )
        """
    )


def build_workload_source_schema(db_path: str | None = None):
    conn = get_connection(db_path)
    cur = conn.cursor()
    build_service_statistics_schema(cur)
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS analysis_workload_source_run (
            run_id TEXT PRIMARY KEY,
            source_name TEXT,
            source_type TEXT,
            requested_year_be INTEGER,
            status TEXT,
            rows_loaded INTEGER DEFAULT 0,
            notes TEXT,
            imported_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_workload_source_fact (
            fact_id TEXT PRIMARY KEY,
            run_id TEXT,
            source_name TEXT,
            source_type TEXT,
            dataset_code TEXT,
            dataset_name_th TEXT,
            metric_code TEXT,
            service_function TEXT,
            is_proxy INTEGER DEFAULT 0,
            b_year INTEGER,
            period_month INTEGER,
            period_quarter INTEGER,
            province_code TEXT,
            areacode TEXT,
            hospcode TEXT,
            unit_id TEXT,
            value_num REAL,
            value_unit TEXT,
            source_note TEXT,
            raw_json TEXT,
            imported_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_workload_source_metric_year
        ON analysis_workload_source_fact(metric_code, b_year, province_code);
        CREATE INDEX IF NOT EXISTS idx_workload_source_dataset_year
        ON analysis_workload_source_fact(dataset_code, b_year, source_type);
        CREATE INDEX IF NOT EXISTS idx_workload_source_unit
        ON analysis_workload_source_fact(unit_id, metric_code, b_year);
        """
    )
    conn.commit()
    conn.close()


def _extract_province_code(areacode: Any) -> str | None:
    text = str(areacode or "").strip()
    if not text:
        return None
    if "," in text:
        parts = [part.strip() for part in text.split(",") if part.strip()]
        if parts and parts[0].isdigit():
            return parts[0].zfill(2)[:2]
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 2:
        return digits[:2]
    return None


def _annual_value_from_row(row: dict[str, Any], strategy: str) -> float | None:
    if strategy == "annual_result":
        return float(row.get("result") or 0.0)
    if strategy == "monthly_result_sum":
        total = 0.0
        found = False
        for key, value in row.items():
            if key.startswith("result") and key != "result":
                if value not in (None, ""):
                    total += float(value or 0.0)
                    found = True
        return total if found else None
    if strategy == "quarter_result_sum":
        total = 0.0
        found = False
        for key, value in row.items():
            if key.startswith("resultq"):
                if value not in (None, ""):
                    total += float(value or 0.0)
                    found = True
        return total if found else None
    if strategy == "field_opd_visit":
        value = row.get("opd_visit")
        return float(value or 0.0) if value not in (None, "") else None
    return None


def _fetch_report_rows(dataset_code: str, year_be: int, timeout: int) -> list[dict[str, Any]] | None:
    last_error: Exception | None = None
    for _ in range(3):
        try:
            response = requests.get(
                f"https://opendata.moph.go.th/api/report_data/{dataset_code}/{year_be}",
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list):
                return payload
            return []
        except Exception as exc:  # pragma: no cover - network error path
            last_error = exc
    if last_error is not None:
        raise last_error
    return None


def refresh_public_workload_sources(
    *,
    requested_year_be: int = 2569,
    db_path: str | None = None,
    timeout: int = 30,
) -> dict[str, Any]:
    build_workload_source_schema(db_path)
    conn = get_connection(db_path)
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    rows_loaded = 0
    dataset_summary: list[dict[str, Any]] = []
    cur.execute(
        """
        INSERT INTO analysis_workload_source_run (
            run_id, source_name, source_type, requested_year_be, status, rows_loaded, notes, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            "public_workload_sources",
            "opendata_moph",
            requested_year_be,
            "running",
            0,
            None,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )
    conn.commit()

    for definition in PUBLIC_WORKLOAD_SOURCE_DEFINITIONS:
        dataset_code = definition["dataset_code"]
        dataset_name_th = definition["dataset_name_th"]
        year_candidates = [requested_year_be] + [
            year for year in definition.get("fallback_years", []) if year != requested_year_be
        ]
        selected_year = None
        payload_rows: list[dict[str, Any]] = []
        fetch_error = None
        for year_be in year_candidates:
            try:
                payload = _fetch_report_rows(dataset_code, year_be, timeout)
                if isinstance(payload, list) and payload:
                    payload_rows = payload
                    selected_year = year_be
                    break
            except Exception as exc:  # pragma: no cover - network error path
                fetch_error = str(exc)
        should_replace_existing = bool(payload_rows)
        existing_rows = cur.execute(
            """
            SELECT COUNT(*) AS row_count
            FROM analysis_workload_source_fact
            WHERE source_type = 'opendata_moph' AND dataset_code = ?
            """,
            (dataset_code,),
        ).fetchone()
        existing_count = int(existing_rows["row_count"] or 0) if existing_rows else 0
        if should_replace_existing:
            cur.execute(
                """
                DELETE FROM analysis_workload_source_fact
                WHERE source_type = 'opendata_moph' AND dataset_code = ?
                """,
                (dataset_code,),
            )
        if payload_rows:
            insert_rows = []
            for row in payload_rows:
                value_num = _annual_value_from_row(row, definition["value_strategy"])
                province_code = _extract_province_code(row.get("areacode"))
                if value_num is None or value_num <= 0 or not province_code:
                    continue
                insert_rows.append(
                    (
                        str(uuid.uuid4()),
                        run_id,
                        "public_workload_sources",
                        "opendata_moph",
                        dataset_code,
                        dataset_name_th,
                        definition["metric_code"],
                        definition["service_function"],
                        int(definition["is_proxy"]),
                        int(selected_year or requested_year_be),
                        None,
                        None,
                        province_code,
                        str(row.get("areacode") or ""),
                        str(row.get("hospcode") or ""),
                        None,
                        float(value_num),
                        "annual_count",
                        definition["source_note"],
                        json.dumps(row, ensure_ascii=False),
                    )
                )
            cur.executemany(
                """
                INSERT INTO analysis_workload_source_fact (
                    fact_id, run_id, source_name, source_type, dataset_code, dataset_name_th,
                    metric_code, service_function, is_proxy, b_year, period_month, period_quarter,
                    province_code, areacode, hospcode, unit_id, value_num, value_unit, source_note, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                insert_rows,
            )
            rows_loaded += len(insert_rows)
            dataset_summary.append(
                {
                    "dataset_code": dataset_code,
                    "selected_year_be": selected_year,
                    "rows_loaded": len(insert_rows),
                    "is_proxy": bool(definition["is_proxy"]),
                }
            )
        else:
            dataset_summary.append(
                {
                    "dataset_code": dataset_code,
                    "selected_year_be": selected_year,
                    "rows_loaded": 0,
                    "is_proxy": bool(definition["is_proxy"]),
                    "error": fetch_error,
                    "preserved_existing_rows": existing_count if existing_count and not should_replace_existing else 0,
                }
            )

    conn.execute(
        """
        UPDATE analysis_workload_source_run
        SET status = ?, rows_loaded = ?, notes = ?
        WHERE run_id = ?
        """,
        (
            "completed",
            rows_loaded,
            json.dumps(dataset_summary, ensure_ascii=False),
            run_id,
        ),
    )
    conn.commit()
    conn.close()
    return {
        "run_id": run_id,
        "requested_year_be": requested_year_be,
        "rows_loaded": rows_loaded,
        "datasets": dataset_summary,
    }


def refresh_manual_service_statistics_sources(db_path: str | None = None) -> dict[str, Any]:
    build_workload_source_schema(db_path)
    conn = get_connection(db_path)
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO analysis_workload_source_run (
            run_id, source_name, source_type, requested_year_be, status, rows_loaded, notes, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            run_id,
            "manual_service_statistics",
            "manual_service_statistics",
            None,
            "running",
            0,
            None,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )
    cur.execute(
        """
        DELETE FROM analysis_workload_source_fact
        WHERE source_type = 'manual_service_statistics'
        """
    )
    try:
        rows = cur.execute(
            """
            SELECT ss.unit_id,
                   ss.hospital_level,
                   ss.cadre,
                   ss.specialty,
                   ss.activity_code,
                   ss.activity_name,
                   ss.activity_count,
                   ss.period_type,
                   ss.period_value,
                   ss.as_of_date,
                   ss.source_name,
                   ss.notes,
                   ou.province_code
            FROM service_statistics ss
            LEFT JOIN organizational_unit ou ON ou.unit_id = ss.unit_id
            """
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []

    insert_rows = []
    for row in rows:
        metric_map = MANUAL_ACTIVITY_CODE_MAP.get(str(row["activity_code"] or "").strip())
        if not metric_map:
            continue
        activity_count = float(row["activity_count"] or 0.0)
        if activity_count <= 0:
            continue
        metric_code, service_function, is_proxy = metric_map
        period_value = str(row["period_value"] or "").strip()
        year_be = None
        if period_value[:4].isdigit():
            year_ce = int(period_value[:4])
            year_be = year_ce + 543 if year_ce < 2400 else year_ce
        if year_be is None:
            as_of = str(row["as_of_date"] or "").strip()
            if len(as_of) >= 4 and as_of[:4].isdigit():
                year_ce = int(as_of[:4])
                year_be = year_ce + 543 if year_ce < 2400 else year_ce
        if year_be is None:
            continue
        insert_rows.append(
            (
                str(uuid.uuid4()),
                run_id,
                "manual_service_statistics",
                "manual_service_statistics",
                str(row["activity_code"] or ""),
                str(row["activity_name"] or ""),
                metric_code,
                service_function,
                int(is_proxy),
                int(year_be),
                None,
                None,
                str(row["province_code"] or ""),
                None,
                None,
                str(row["unit_id"] or ""),
                activity_count,
                "annual_count",
                f"Manual service statistics import ({row['source_name'] or 'unknown'})",
                json.dumps(
                    {
                        "hospital_level": row["hospital_level"],
                        "cadre": row["cadre"],
                        "specialty": row["specialty"],
                        "period_type": row["period_type"],
                        "period_value": row["period_value"],
                        "notes": row["notes"],
                    },
                    ensure_ascii=False,
                ),
            )
        )
    if insert_rows:
        cur.executemany(
            """
            INSERT INTO analysis_workload_source_fact (
                fact_id, run_id, source_name, source_type, dataset_code, dataset_name_th,
                metric_code, service_function, is_proxy, b_year, period_month, period_quarter,
                province_code, areacode, hospcode, unit_id, value_num, value_unit, source_note, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            insert_rows,
        )
    conn.execute(
        """
        UPDATE analysis_workload_source_run
        SET status = ?, rows_loaded = ?, notes = ?
        WHERE run_id = ?
        """,
        (
            "completed",
            len(insert_rows),
            json.dumps({"rows_loaded": len(insert_rows)}, ensure_ascii=False),
            run_id,
        ),
    )
    conn.commit()
    conn.close()
    return {"run_id": run_id, "rows_loaded": len(insert_rows)}


def list_workload_source_runs(db_path: str | None = None) -> list[dict[str, Any]]:
    build_workload_source_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT *
        FROM analysis_workload_source_run
        ORDER BY imported_at DESC
        """
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
