import os
import sqlite3
import unicodedata
from typing import Any

try:
    from hospital_scope_store import get_hospital_scope
except ImportError:
    from API.hospital_scope_store import get_hospital_scope


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")

WORKLOAD_PROXY_SQL = """
COALESCE(w.outpatient_visits, 0)
+ (COALESCE(w.inpatient_visits, 0) * 12)
+ (COALESCE(w.emergency_visits, 0) * 1.5)
+ (COALESCE(w.surgery_count, 0) * 20)
+ (COALESCE(w.delivery_count, 0) * 15)
+ (COALESCE(w.mental_health_visits, 0) * 1.2)
+ (COALESCE(w.chronic_disease_visits, 0) * 1.1)
+ COALESCE(w.total_workload_score, 0)
"""

PROVINCE_MIN_SHARE = 0.30
PROVINCE_WORKLOAD_UPLIFT = 1.20
NETWORK_WORKLOAD_UPLIFT = 1.10
NETWORK_MAX_SHARE = 0.60


def _normalize_lookup_key(value: str | None) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _find_scope_row(
    *,
    hospital_name: str | None = None,
    province_code: str | None = None,
    unit_name: str | None = None,
    db_path: str | None = None,
) -> dict[str, Any] | None:
    if hospital_name:
        scope = get_hospital_scope(hospital_name, db_path=db_path)
        if scope:
            return scope

    if not (province_code and unit_name):
        return None

    conn = get_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM hospital_scope_config WHERE province_code = ? ORDER BY hospital_name",
        (province_code,),
    ).fetchall()
    conn.close()
    lookup_unit_name = _normalize_lookup_key(unit_name)
    for row in rows:
        payload = dict(row)
        if _normalize_lookup_key(payload.get("lookup_unit_name")) == lookup_unit_name:
            return payload
        if _normalize_lookup_key(payload.get("hospital_name")) == lookup_unit_name:
            return payload
    return None


def _get_province_population(cur: sqlite3.Cursor, province_code: str) -> tuple[int, int | None]:
    row = cur.execute(
        """
        SELECT SUM(total_population) AS total_population, MAX(reference_year_be) AS reference_year_be
        FROM hdc_amphur_population_reference
        WHERE province_code = ?
        """,
        (province_code,),
    ).fetchone()
    if row and row["total_population"]:
        return int(row["total_population"]), int(row["reference_year_be"] or 0) or None
    return 0, None


def _get_unit_workload_proxy(cur: sqlite3.Cursor, unit_id: str | None) -> float:
    if not unit_id:
        return 0.0
    row = cur.execute(
        f"SELECT SUM({WORKLOAD_PROXY_SQL}) AS workload_proxy FROM workload w WHERE w.unit_id = ?",
        (unit_id,),
    ).fetchone()
    return float(row["workload_proxy"] or 0.0) if row else 0.0


def _get_unit_workload_components(cur: sqlite3.Cursor, unit_id: str | None) -> dict[str, float]:
    if not unit_id:
        return {
            "outpatient_visits": 0.0,
            "inpatient_visits": 0.0,
            "emergency_visits": 0.0,
            "surgery_count": 0.0,
            "delivery_count": 0.0,
            "mental_health_visits": 0.0,
            "chronic_disease_visits": 0.0,
            "icu_bed_days": None,
        }
    row = cur.execute(
        """
        SELECT
            SUM(COALESCE(outpatient_visits, 0)) AS outpatient_visits,
            SUM(COALESCE(inpatient_visits, 0)) AS inpatient_visits,
            SUM(COALESCE(emergency_visits, 0)) AS emergency_visits,
            SUM(COALESCE(surgery_count, 0)) AS surgery_count,
            SUM(COALESCE(delivery_count, 0)) AS delivery_count,
            SUM(COALESCE(mental_health_visits, 0)) AS mental_health_visits,
            SUM(COALESCE(chronic_disease_visits, 0)) AS chronic_disease_visits
        FROM workload
        WHERE unit_id = ?
        """,
        (unit_id,),
    ).fetchone()
    if not row:
        return {
            "outpatient_visits": 0.0,
            "inpatient_visits": 0.0,
            "emergency_visits": 0.0,
            "surgery_count": 0.0,
            "delivery_count": 0.0,
            "mental_health_visits": 0.0,
            "chronic_disease_visits": 0.0,
            "icu_bed_days": None,
        }
    return {
        "outpatient_visits": float(row["outpatient_visits"] or 0.0),
        "inpatient_visits": float(row["inpatient_visits"] or 0.0),
        "emergency_visits": float(row["emergency_visits"] or 0.0),
        "surgery_count": float(row["surgery_count"] or 0.0),
        "delivery_count": float(row["delivery_count"] or 0.0),
        "mental_health_visits": float(row["mental_health_visits"] or 0.0),
        "chronic_disease_visits": float(row["chronic_disease_visits"] or 0.0),
        "icu_bed_days": None,
    }


def _get_province_workload_proxy(cur: sqlite3.Cursor, province_code: str | None) -> float:
    if not province_code:
        return 0.0
    row = cur.execute(
        f"""
        SELECT SUM({WORKLOAD_PROXY_SQL}) AS workload_proxy
        FROM organizational_unit ou
        LEFT JOIN workload w ON w.unit_id = ou.unit_id
        WHERE ou.province_code = ?
        """,
        (province_code,),
    ).fetchone()
    return float(row["workload_proxy"] or 0.0) if row else 0.0


def resolve_clinical_denominator(
    *,
    hospital_name: str | None = None,
    province_code: str | None = None,
    unit_name: str | None = None,
    clinical_scope_type: str | None = None,
    clinical_scope_name: str | None = None,
    fallback_population_total: float | None = None,
    db_path: str | None = None,
) -> dict[str, Any]:
    scope = _find_scope_row(
        hospital_name=hospital_name,
        province_code=province_code,
        unit_name=unit_name,
        db_path=db_path,
    )
    if scope is None:
        return {
            "scope_type": clinical_scope_type or "unknown",
            "scope_name": clinical_scope_name,
            "denominator_method": "frontend_population_fallback",
            "denominator_population_total": float(fallback_population_total or 0.0),
            "scope_population_total": float(fallback_population_total or 0.0),
            "scope_population_source": "frontend_payload",
            "scope_population_reference_year": None,
            "workload_population_proxy": None,
            "workload_share": None,
            "unit_workload_proxy": None,
            "province_workload_proxy": None,
            "calibration": {},
        }

    conn = get_connection(db_path)
    cur = conn.cursor()
    province_code_value = scope.get("province_code")
    amphur_population = float(scope.get("pp_population_total") or 0.0)
    province_population, reference_year = _get_province_population(cur, province_code_value)
    unit_workload_proxy = _get_unit_workload_proxy(cur, scope.get("unit_id"))
    workload_components = _get_unit_workload_components(cur, scope.get("unit_id"))
    province_workload_proxy = _get_province_workload_proxy(cur, province_code_value)
    conn.close()

    workload_share = (
        unit_workload_proxy / province_workload_proxy
        if province_workload_proxy > 0
        else None
    )
    workload_population_proxy = (
        float(province_population) * workload_share
        if province_population > 0 and workload_share is not None
        else None
    )

    effective_scope_type = clinical_scope_type or scope.get("clinical_scope_type") or "amphur"
    effective_scope_name = clinical_scope_name or scope.get("clinical_scope_name") or scope.get("home_amphur_name")
    denominator_population_total = float(fallback_population_total or 0.0)
    denominator_method = "frontend_population_fallback"
    calibration: dict[str, Any] = {}

    if effective_scope_type == "amphur":
        denominator_population_total = amphur_population or float(fallback_population_total or 0.0)
        denominator_method = "amphur_population"
        calibration = {"home_amphur_population": round(amphur_population, 2)}
    elif effective_scope_type == "province":
        province_floor = float(province_population) * PROVINCE_MIN_SHARE if province_population > 0 else 0.0
        workload_adjusted = (workload_population_proxy or 0.0) * PROVINCE_WORKLOAD_UPLIFT
        denominator_population_total = max(amphur_population, province_floor, workload_adjusted)
        if province_population > 0:
            denominator_population_total = min(float(province_population), denominator_population_total)
        denominator_method = "province_workload_blend"
        calibration = {
            "province_min_share_pct": round(PROVINCE_MIN_SHARE * 100.0, 2),
            "province_floor_population": round(province_floor, 2),
            "workload_uplift_factor": PROVINCE_WORKLOAD_UPLIFT,
        }
    elif effective_scope_type == "network_zone":
        network_cap = float(province_population) * NETWORK_MAX_SHARE if province_population > 0 else 0.0
        workload_adjusted = (workload_population_proxy or 0.0) * NETWORK_WORKLOAD_UPLIFT
        denominator_population_total = max(amphur_population, workload_adjusted)
        if network_cap > 0:
            denominator_population_total = min(network_cap, denominator_population_total)
            denominator_population_total = max(amphur_population, denominator_population_total)
        denominator_method = "network_zone_workload_adjusted"
        calibration = {
            "network_workload_uplift_factor": NETWORK_WORKLOAD_UPLIFT,
            "network_max_share_pct": round(NETWORK_MAX_SHARE * 100.0, 2),
            "network_cap_population": round(network_cap, 2),
        }
    elif effective_scope_type == "workload":
        denominator_population_total = max(amphur_population, float(workload_population_proxy or 0.0))
        denominator_method = "workload_population_proxy"
        calibration = {"workload_only": True}

    if denominator_population_total <= 0:
        denominator_population_total = float(fallback_population_total or 0.0)
        denominator_method = "frontend_population_fallback"

    return {
        "scope_type": effective_scope_type,
        "scope_name": effective_scope_name,
        "scope_population_total": float(province_population if effective_scope_type == "province" else amphur_population or 0.0),
        "scope_population_source": (
            "verified_amphur_population_hdc"
            if str(scope.get("pp_population_source") or "").startswith("verified_amphur_population_hdc")
            else scope.get("pp_population_source")
        ),
        "scope_population_reference_year": reference_year or scope.get("pp_population_reference_year"),
        "denominator_method": denominator_method,
        "denominator_population_total": round(float(denominator_population_total or 0.0), 2),
        "workload_population_proxy": round(float(workload_population_proxy or 0.0), 2) if workload_population_proxy is not None else None,
        "workload_share": round(float(workload_share or 0.0), 4) if workload_share is not None else None,
        "unit_workload_proxy": round(float(unit_workload_proxy or 0.0), 2),
        "province_workload_proxy": round(float(province_workload_proxy or 0.0), 2),
        "workload_components": workload_components,
        "scope": scope,
        "calibration": calibration,
    }
