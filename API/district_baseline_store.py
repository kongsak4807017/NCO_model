import csv
import json
import os
import re
import sqlite3
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from statistics import median

import requests

try:
    from amphur_population_store import list_amphur_population_rows
    from hdc_population_store import list_hdc_population_rows
    from hr_workforce_dictionary import HR_WORKFORCE_DICTIONARY
    from pp_store import get_pp_amphur_outcome_summary, get_pp_unit_capacity_summary
except ImportError:
    from API.amphur_population_store import list_amphur_population_rows
    from API.hdc_population_store import list_hdc_population_rows
    from API.hr_workforce_dictionary import HR_WORKFORCE_DICTIONARY
    from API.pp_store import get_pp_amphur_outcome_summary, get_pp_unit_capacity_summary


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
HR_DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")
STORE_PATH = os.path.join(BASE_DIR, "data", "district_baseline.db")
CLINICAL_DATASET_PATH = os.path.join(ROOT_DIR, "data_inputV1.csv")
WORKLOAD_METRIC_COLUMNS = [
    "outpatient_visits",
    "inpatient_visits",
    "emergency_visits",
    "surgery_count",
    "delivery_count",
    "dental_visits",
    "mental_health_visits",
    "chronic_disease_visits",
    "cross_border_patients",
    "tourist_patients",
    "total_workload_score",
    "personnel_count_at_period",
    "workload_per_person",
]
CLINICAL_OUTCOME_DEFINITIONS = [
    {"indicator_code": "A01", "label": "Crude Death Rate", "unit": "%"},
    {"indicator_code": "A04", "label": "AMI Mortality", "unit": "%"},
    {"indicator_code": "A09", "label": "Sepsis Mortality", "unit": "%"},
    {"indicator_code": "B01", "label": "Maternal Mortality", "unit": "/100k"},
    {"indicator_code": "C02", "label": "CMI", "unit": "AdjRW"},
    {"indicator_code": "D01", "label": "Bed Occupancy Rate", "unit": "%"},
    {"indicator_code": "F10", "label": "Referral Leakage to Tertiary", "unit": "%"},
]
CLINICAL_SERVICE_PLAN_DEFINITIONS = [
    {"indicator_code": "DH0101", "label": "STEMI Mortality"},
    {"indicator_code": "DH0102", "label": "AMI Mortality"},
    {"indicator_code": "DN0101", "label": "Stroke Mortality"},
    {"indicator_code": "DN0142D", "label": "Ischemic Stroke Death with rtPA"},
    {"indicator_code": "CI0101", "label": "Sepsis Mortality"},
    {"indicator_code": "PE0102", "label": "Pneumonia เด็ก Mortality"},
    {"indicator_code": "CM0203", "label": "Neonatal Mortality"},
    {"indicator_code": "CM0101", "label": "Maternal Mortality"},
    {"indicator_code": "DC0401", "label": "มะเร็ง Mortality"},
    {"indicator_code": "DG0201", "label": "ไส้ติ่งทะลุ"},
    {"indicator_code": "PS0001", "label": "อัตราฆ่าตัวตาย"},
    {"indicator_code": "RH0101", "label": "Stroke ได้กายภาพ"},
]
DQ_INDICATOR_DEFINITIONS = [
    {"indicator_code": "G01", "label": "%AdjRW = 0", "unit": "%"},
    {"indicator_code": "G02", "label": "%Pdx Ill-defined", "unit": "%"},
    {"indicator_code": "G03", "label": "%Pdx Ill-defined (Death)", "unit": "%"},
    {"indicator_code": "G04", "label": "%ICD Low Quality", "unit": "%"},
]
PROVINCE_DISEASE_PREVALENCE_REFERENCE = {
    "50": {"prevalence_cvd": 3250.0, "prevalence_cancer": 1420.0, "prevalence_dm": 8500.0, "prevalence_ckd": 4100.0},
    "51": {"prevalence_cvd": 3500.0, "prevalence_cancer": 1500.0, "prevalence_dm": 8900.0, "prevalence_ckd": 4300.0},
    "52": {"prevalence_cvd": 3800.0, "prevalence_cancer": 1550.0, "prevalence_dm": 9200.0, "prevalence_ckd": 4600.0},
    "54": {"prevalence_cvd": 3600.0, "prevalence_cancer": 1380.0, "prevalence_dm": 8700.0, "prevalence_ckd": 4200.0},
    "55": {"prevalence_cvd": 2900.0, "prevalence_cancer": 1250.0, "prevalence_dm": 7800.0, "prevalence_ckd": 3700.0},
    "56": {"prevalence_cvd": 3400.0, "prevalence_cancer": 1300.0, "prevalence_dm": 8400.0, "prevalence_ckd": 4000.0},
    "57": {"prevalence_cvd": 3100.0, "prevalence_cancer": 1350.0, "prevalence_dm": 8200.0, "prevalence_ckd": 3900.0},
    "58": {"prevalence_cvd": 2100.0, "prevalence_cancer": 950.0, "prevalence_dm": 6500.0, "prevalence_ckd": 2800.0},
}
MENTAL_REFERENCE_RATE_PER100K = 5000.0
PUBLIC_NEED_PREFERRED_YEARS = (2569, 2568, 2567)
PUBLIC_NEED_DATASET_DEFINITIONS = {
    "prevalence_dm": {
        "dataset_code": "s_dm_pop_age",
        "dataset_name_th": "อัตราการป่วยด้วยโรคเบาหวาน",
        "value_kind": "result_group_sum",
    },
    "prevalence_cvd_coronary": {
        "dataset_code": "s_coronary_pop_age",
        "dataset_name_th": "อัตราป่วยด้วยโรคหัวใจและหลอดเลือด",
        "value_kind": "result_group_sum",
    },
    "prevalence_cvd_stroke": {
        "dataset_code": "s_stroke_pop_age",
        "dataset_name_th": "อัตราการป่วยด้วยโรคหลอดเลือดสมอง",
        "value_kind": "result_group_sum",
    },
    "prevalence_cancer_breast": {
        "dataset_code": "s_ca_breast_pop_age",
        "dataset_name_th": "อัตราป่วยโรคมะเร็งเต้านมต่อประชากร",
        "value_kind": "result_group_sum",
    },
    "prevalence_cancer_cervix": {
        "dataset_code": "s_ca_cervix_pop_age",
        "dataset_name_th": "อัตราป่วยโรคมะเร็งปากมดลูกต่อประชากร",
        "value_kind": "result_group_sum",
    },
    "prevalence_cancer_lung": {
        "dataset_code": "s_ca_lung_pop_age",
        "dataset_name_th": "อัตราป่วยโรคมะเร็งปอดต่อประชากร",
        "value_kind": "result_group_sum",
    },
    "prevalence_ckd": {
        "dataset_code": "s_kpi_ckd_incidence",
        "dataset_name_th": "CKD 1.2 ร้อยละของผู้ป่วย DM, HT เป็นโรคไตเรื้อรังรายใหม่",
        "value_kind": "result_value",
    },
}
PUBLIC_MENTAL_DATASET_DEFINITIONS = {
    "mental_2q_positive": {
        "dataset_code": "s_2q_chronic",
        "dataset_name_th": "การคัดกรองโรคซึมเศร้า (2Q) ในผู้ป่วยโรคเรื้อรัง",
        "value_kind": "suffix_sum",
        "suffixes": ("1B131", "1B0281"),
        "target_field": "target",
    },
    "mental_8q_risk": {
        "dataset_code": "s_8q_chronic",
        "dataset_name_th": "การประเมินการฆ่าตัวตาย (8Q) ในผู้ป่วยโรคเรื้อรัง",
        "value_kind": "suffix_sum",
        "suffixes": ("1B0271", "1B0272", "1B0273"),
        "target_field": "target_all",
    },
}
HOSPITAL_LEVEL_ALIASES = {
    "A (รพศ.)": "รพศ.",
    "A (รพท.)": "รพท.",
    "S (รพท.)": "รพท.",
    "M1 (รพท.)": "รพท.",
    "Mocking": "รพช.",
    "รพศ.": "รพศ.",
    "รพท.": "รพท.",
    "รพช.": "รพช.",
}
HOSPITAL_LEVEL_PROFILES = [
    {
        "hospital_level": "รพศ.",
        "peer_unit_type_label": "รพศ.",
        "clinical_scope_type": "province",
        "clinical_scope_note": "clinical baseline uses configured referral-hospital peers",
        "peer_hospital_names": ["นครพิงค์", "เชียงรายประชานุเคราะห์"],
    },
    {
        "hospital_level": "รพท.",
        "peer_unit_type_label": "รพท.",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "clinical baseline uses configured general-hospital peers",
        "peer_hospital_names": ["ลำปาง", "น่าน", "แพร่", "พะเยา", "ลำพูน", "เชียงคำ"],
    },
    {
        "hospital_level": "รพช.",
        "peer_unit_type_label": "รพช.",
        "clinical_scope_type": "amphur",
        "clinical_scope_note": "clinical baseline uses district-hospital peers from hr_blueprint.db",
        "peer_hospital_names": [],
    },
]
HOSPITAL_LEVEL_BY_HOSPITAL_NAME = {
    hospital_name: profile["hospital_level"]
    for profile in HOSPITAL_LEVEL_PROFILES
    for hospital_name in profile.get("peer_hospital_names", [])
}


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value):
    if not value:
        return None
    return json.loads(value)


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(float(median(values)), 2)


def _rate_per(count_value: float | int | None, denominator: float | int | None, multiplier: float = 100000.0) -> float:
    denominator_num = float(denominator or 0)
    if denominator_num <= 0:
        return 0.0
    return round((float(count_value or 0) * multiplier) / denominator_num, 2)


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _sum_matching_values(row: dict, *, prefix: str | None = None, suffixes: tuple[str, ...] | None = None) -> float:
    total = 0.0
    for key, value in row.items():
        key_text = str(key)
        if prefix and not key_text.startswith(prefix):
            continue
        if suffixes and not any(key_text.endswith(suffix) for suffix in suffixes):
            continue
        number = _to_float(value)
        if number is None:
            continue
        total += number
    return total


def _extract_district_key_from_areacode(areacode) -> tuple[str, str] | None:
    digits = "".join(ch for ch in str(areacode or "").strip() if ch.isdigit())
    if len(digits) < 4:
        return None
    return digits[:2], digits[:4]


def _fetch_public_need_dataset_rows(
    dataset_code: str,
    *,
    preferred_years: tuple[int, ...] = PUBLIC_NEED_PREFERRED_YEARS,
    timeout: int = 60,
) -> tuple[int, list[dict]]:
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    last_error: Exception | None = None
    for year_be in preferred_years:
        for attempt in range(3):
            try:
                response = session.get(
                    f"https://opendata.moph.go.th/api/report_data/{dataset_code}/{year_be}",
                    timeout=timeout,
                )
                response.raise_for_status()
                payload = response.json()
                if isinstance(payload, list) and payload:
                    return int(year_be), payload
                if isinstance(payload, list):
                    break
                raise RuntimeError(f"{dataset_code} returned unexpected payload type: {type(payload).__name__}")
            except Exception as exc:  # pragma: no cover - network instability path
                last_error = exc
                time.sleep(1.0 + attempt)
    raise RuntimeError(f"Unable to fetch dataset {dataset_code}: {last_error}")


def _aggregate_need_dataset_rows(rows: list[dict], definition: dict) -> dict[tuple[str, str], dict]:
    aggregates: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"value_num": 0.0, "target_num": 0.0, "row_count": 0}
    )
    value_kind = definition.get("value_kind")
    suffixes = tuple(definition.get("suffixes") or ())
    target_field = definition.get("target_field")
    for row in rows:
        district_key = _extract_district_key_from_areacode(row.get("areacode"))
        if not district_key:
            continue
        if value_kind == "result_group_sum":
            value_num = _sum_matching_values(row, prefix="result_group")
        elif value_kind == "result_value":
            value_num = _to_float(row.get("result")) or 0.0
        elif value_kind == "suffix_sum":
            value_num = _sum_matching_values(row, suffixes=suffixes)
        else:
            value_num = 0.0
        target_num = (_to_float(row.get(target_field)) or 0.0) if target_field else 0.0
        payload = aggregates[district_key]
        payload["value_num"] += value_num
        payload["target_num"] += target_num
        payload["row_count"] += 1
    return dict(aggregates)


def _normalize_province_name(value: str | None) -> str:
    return re.sub(r"^จังหวัด", "", (value or "").strip())


def _normalize_lookup_key(value: str | None) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


def _normalize_hospital_level(value: str | None) -> str:
    normalized = _normalize_lookup_key(value)
    explicit_aliases = {
        "A (รพศ.)": "รพศ.",
        "A (รพท.)": "รพท.",
        "S (รพท.)": "รพท.",
        "M1 (รพท.)": "รพท.",
        "Mocking": "รพช.",
        "รพศ.": "รพศ.",
        "รพท.": "รพท.",
        "รพช.": "รพช.",
    }
    return explicit_aliases.get(normalized) or HOSPITAL_LEVEL_ALIASES.get(normalized, normalized)


def _to_float(value) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not number == number:
        return None
    return number


def _clinical_indicator_priority(column_name: str) -> tuple[int, int]:
    label = column_name or ""
    rate_keys = ("ร้อยละ", "อัตรา", "เปอร์เซ็นต์", "Rate", "rate", "%")
    skip_keys = ("ระดับ", "สถานพยาบาล", "จังหวัด", "จำนวน", "หน่วย", "col_")
    if any(key in label for key in rate_keys):
        return (0, len(label))
    if any(key in label for key in skip_keys):
        return (9, len(label))
    return (1, len(label))


def _normalize_amphur_row(row: dict, source_tag: str) -> dict:
    return {
        "province_code": str(row.get("province_code") or ""),
        "province_name_th": _normalize_province_name(row.get("province_name_th")),
        "amphur_code": str(row.get("amphur_code") or ""),
        "amphur_name_th": row.get("amphur_name_th") or row.get("amphur_name") or "",
        "population_total": int(float(row.get("total_population") or 0) or 0),
        "male_total": int(float(row.get("male_total") or 0) or 0),
        "female_total": int(float(row.get("female_total") or 0) or 0),
        "age_sex_json": row.get("age_sex_json"),
        "population_source": source_tag,
        "population_reference_year": int(row.get("reference_year_be") or 0) or None,
    }


def get_store_connection(store_path: str | None = None) -> sqlite3.Connection:
    path = store_path or STORE_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_hr_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or HR_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_district_baseline_schema(store_path: str | None = None):
    conn = get_store_connection(store_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS district_baseline_profile (
            province_code TEXT NOT NULL,
            province_name_th TEXT,
            amphur_code TEXT NOT NULL,
            amphur_name_th TEXT,
            hospital_level TEXT NOT NULL,
            peer_unit_type_label TEXT NOT NULL,
            clinical_scope_type TEXT,
            clinical_scope_note TEXT,
            pp_population_total INTEGER,
            pp_population_source TEXT,
            pp_population_reference_year INTEGER,
            pp_outcome_year_be INTEGER,
            pp_outcome_indicator_count INTEGER,
            pp_outcome_off_target_count INTEGER,
            readiness_status TEXT,
            peer_scope TEXT,
            peer_unit_count INTEGER,
            peer_units_json TEXT,
            pp_outcomes_json TEXT,
            pp_capacity_json TEXT,
            need_profile_json TEXT,
            dq_profile_json TEXT,
            clinical_workforce_json TEXT,
            clinical_workload_json TEXT,
            clinical_outcomes_json TEXT,
            clinical_service_plan_json TEXT,
            readiness_json TEXT,
            provenance_json TEXT,
            refreshed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (province_code, amphur_code, hospital_level)
        );
        CREATE INDEX IF NOT EXISTS idx_district_baseline_profile_lookup
        ON district_baseline_profile (province_code, hospital_level, readiness_status);

        CREATE TABLE IF NOT EXISTS district_disease_mart (
            province_code TEXT NOT NULL,
            amphur_code TEXT NOT NULL,
            amphur_name_th TEXT,
            population_total INTEGER,
            reference_year_be INTEGER,
            prevalence_cvd REAL,
            prevalence_cancer REAL,
            prevalence_dm REAL,
            prevalence_ckd REAL,
            source_note TEXT,
            provenance_json TEXT,
            refreshed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (province_code, amphur_code)
        );
        CREATE INDEX IF NOT EXISTS idx_district_disease_mart_lookup
        ON district_disease_mart (province_code, reference_year_be);

        CREATE TABLE IF NOT EXISTS district_mental_mart (
            province_code TEXT NOT NULL,
            amphur_code TEXT NOT NULL,
            amphur_name_th TEXT,
            population_total INTEGER,
            reference_year_be INTEGER,
            mental_risk_rate REAL,
            depression_positive_count REAL,
            depression_screen_target REAL,
            suicide_risk_rate REAL,
            suicide_risk_count REAL,
            suicide_screen_target REAL,
            source_note TEXT,
            provenance_json TEXT,
            refreshed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (province_code, amphur_code)
        );
        CREATE INDEX IF NOT EXISTS idx_district_mental_mart_lookup
        ON district_mental_mart (province_code, reference_year_be);
        """
    )
    existing_columns = {row["name"] for row in cur.execute("PRAGMA table_info(district_baseline_profile)").fetchall()}
    for column_name in ("clinical_outcomes_json", "clinical_service_plan_json", "need_profile_json", "dq_profile_json"):
        if column_name not in existing_columns:
            cur.execute(f"ALTER TABLE district_baseline_profile ADD COLUMN {column_name} TEXT")
    conn.commit()
    conn.close()


def _load_amphur_reference_rows(province_code: str | None = None) -> list[dict]:
    rows_by_key: dict[tuple[str, str], dict] = {}
    for row in list_amphur_population_rows(province_code=province_code):
        normalized = _normalize_amphur_row(row, "verified_amphur_population_dopa")
        rows_by_key[(normalized["province_code"], normalized["amphur_code"])] = normalized
    for row in list_hdc_population_rows(province_code=province_code):
        normalized = _normalize_amphur_row(row, "verified_amphur_population_hdc")
        rows_by_key[(normalized["province_code"], normalized["amphur_code"])] = normalized
    return sorted(rows_by_key.values(), key=lambda item: (item["province_code"], item["amphur_code"]))


def refresh_district_need_source_marts(
    *,
    province_code: str | None = None,
    store_path: str | None = None,
    db_path: str | None = None,
) -> dict:
    build_district_baseline_schema(store_path)
    hr_conn = get_hr_connection(db_path)
    allowed_provinces = _fetch_allowed_province_codes(hr_conn)
    hr_conn.close()
    conn = get_store_connection(store_path)
    amphur_rows = _load_amphur_reference_rows(province_code=province_code)
    amphur_rows = [row for row in amphur_rows if row["province_code"] in allowed_provinces]
    amphur_lookup = {
        (row["province_code"], row["amphur_code"]): row
        for row in amphur_rows
    }

    disease_components: dict[str, dict] = {}
    for metric_code, definition in PUBLIC_NEED_DATASET_DEFINITIONS.items():
        selected_year, rows = _fetch_public_need_dataset_rows(definition["dataset_code"])
        disease_components[metric_code] = {
            "definition": definition,
            "reference_year_be": selected_year,
            "aggregates": _aggregate_need_dataset_rows(rows, definition),
        }

    mental_components: dict[str, dict] = {}
    for metric_code, definition in PUBLIC_MENTAL_DATASET_DEFINITIONS.items():
        selected_year, rows = _fetch_public_need_dataset_rows(definition["dataset_code"])
        mental_components[metric_code] = {
            "definition": definition,
            "reference_year_be": selected_year,
            "aggregates": _aggregate_need_dataset_rows(rows, definition),
        }

    cur = conn.cursor()
    if province_code:
        cur.execute("DELETE FROM district_disease_mart WHERE province_code = ?", (province_code,))
        cur.execute("DELETE FROM district_mental_mart WHERE province_code = ?", (province_code,))
    else:
        cur.execute("DELETE FROM district_disease_mart")
        cur.execute("DELETE FROM district_mental_mart")

    disease_rows = []
    mental_rows = []
    for district_key, amphur_row in amphur_lookup.items():
        population_total = int(amphur_row.get("population_total") or 0)
        coronary_count = float((disease_components["prevalence_cvd_coronary"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        stroke_count = float((disease_components["prevalence_cvd_stroke"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        breast_count = float((disease_components["prevalence_cancer_breast"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        cervix_count = float((disease_components["prevalence_cancer_cervix"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        lung_count = float((disease_components["prevalence_cancer_lung"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        dm_count = float((disease_components["prevalence_dm"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)
        ckd_count = float((disease_components["prevalence_ckd"]["aggregates"].get(district_key) or {}).get("value_num") or 0.0)

        disease_reference_year = max(
            int(component["reference_year_be"] or 0)
            for component in disease_components.values()
        )
        disease_provenance = {
            "population_source": amphur_row.get("population_source"),
            "population_reference_year": amphur_row.get("population_reference_year"),
            "components": {
                "prevalence_dm": {
                    "dataset_code": disease_components["prevalence_dm"]["definition"]["dataset_code"],
                    "dataset_name_th": disease_components["prevalence_dm"]["definition"]["dataset_name_th"],
                    "reference_year_be": disease_components["prevalence_dm"]["reference_year_be"],
                    "case_count": round(dm_count, 2),
                },
                "prevalence_cvd": {
                    "dataset_codes": [
                        disease_components["prevalence_cvd_coronary"]["definition"]["dataset_code"],
                        disease_components["prevalence_cvd_stroke"]["definition"]["dataset_code"],
                    ],
                    "reference_year_be": max(
                        int(disease_components["prevalence_cvd_coronary"]["reference_year_be"] or 0),
                        int(disease_components["prevalence_cvd_stroke"]["reference_year_be"] or 0),
                    ),
                    "coronary_case_count": round(coronary_count, 2),
                    "stroke_case_count": round(stroke_count, 2),
                },
                "prevalence_cancer": {
                    "dataset_codes": [
                        disease_components["prevalence_cancer_breast"]["definition"]["dataset_code"],
                        disease_components["prevalence_cancer_cervix"]["definition"]["dataset_code"],
                        disease_components["prevalence_cancer_lung"]["definition"]["dataset_code"],
                    ],
                    "reference_year_be": max(
                        int(disease_components["prevalence_cancer_breast"]["reference_year_be"] or 0),
                        int(disease_components["prevalence_cancer_cervix"]["reference_year_be"] or 0),
                        int(disease_components["prevalence_cancer_lung"]["reference_year_be"] or 0),
                    ),
                    "breast_case_count": round(breast_count, 2),
                    "cervix_case_count": round(cervix_count, 2),
                    "lung_case_count": round(lung_count, 2),
                },
                "prevalence_ckd": {
                    "dataset_code": disease_components["prevalence_ckd"]["definition"]["dataset_code"],
                    "dataset_name_th": disease_components["prevalence_ckd"]["definition"]["dataset_name_th"],
                    "reference_year_be": disease_components["prevalence_ckd"]["reference_year_be"],
                    "case_count": round(ckd_count, 2),
                },
            },
        }
        disease_rows.append(
            (
                amphur_row["province_code"],
                amphur_row["amphur_code"],
                amphur_row["amphur_name_th"],
                population_total,
                disease_reference_year or None,
                _rate_per(coronary_count + stroke_count, population_total),
                _rate_per(breast_count + cervix_count + lung_count, population_total),
                _rate_per(dm_count, population_total),
                _rate_per(ckd_count, population_total),
                "population uses HDC/DOPA amphur reference; disease rates use direct public report_data datasets aggregated from district areacode",
                _json_dumps(disease_provenance),
                now_iso(),
            )
        )

        depression_payload = mental_components["mental_2q_positive"]["aggregates"].get(district_key) or {}
        suicide_payload = mental_components["mental_8q_risk"]["aggregates"].get(district_key) or {}
        depression_count = float(depression_payload.get("value_num") or 0.0)
        suicide_count = float(suicide_payload.get("value_num") or 0.0)
        depression_target = float(depression_payload.get("target_num") or 0.0)
        suicide_target = float(suicide_payload.get("target_num") or 0.0)
        mental_reference_year = max(
            int(component["reference_year_be"] or 0)
            for component in mental_components.values()
        )
        mental_provenance = {
            "population_source": amphur_row.get("population_source"),
            "population_reference_year": amphur_row.get("population_reference_year"),
            "components": {
                "mental_risk_rate": {
                    "dataset_code": mental_components["mental_2q_positive"]["definition"]["dataset_code"],
                    "dataset_name_th": mental_components["mental_2q_positive"]["definition"]["dataset_name_th"],
                    "reference_year_be": mental_components["mental_2q_positive"]["reference_year_be"],
                    "positive_count": round(depression_count, 2),
                    "screen_target": round(depression_target, 2),
                },
                "suicide_risk_rate": {
                    "dataset_code": mental_components["mental_8q_risk"]["definition"]["dataset_code"],
                    "dataset_name_th": mental_components["mental_8q_risk"]["definition"]["dataset_name_th"],
                    "reference_year_be": mental_components["mental_8q_risk"]["reference_year_be"],
                    "risk_count": round(suicide_count, 2),
                    "screen_target": round(suicide_target, 2),
                },
            },
        }
        mental_rows.append(
            (
                amphur_row["province_code"],
                amphur_row["amphur_code"],
                amphur_row["amphur_name_th"],
                population_total,
                mental_reference_year or None,
                _rate_per(depression_count, population_total),
                round(depression_count, 2),
                round(depression_target, 2),
                _rate_per(suicide_count, population_total),
                round(suicide_count, 2),
                round(suicide_target, 2),
                "mental risk uses direct chronic 2Q/8Q public report_data screening indicators aggregated from district areacode",
                _json_dumps(mental_provenance),
                now_iso(),
            )
        )

    cur.executemany(
        """
        INSERT INTO district_disease_mart (
            province_code, amphur_code, amphur_name_th, population_total, reference_year_be,
            prevalence_cvd, prevalence_cancer, prevalence_dm, prevalence_ckd,
            source_note, provenance_json, refreshed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        disease_rows,
    )
    cur.executemany(
        """
        INSERT INTO district_mental_mart (
            province_code, amphur_code, amphur_name_th, population_total, reference_year_be,
            mental_risk_rate, depression_positive_count, depression_screen_target,
            suicide_risk_rate, suicide_risk_count, suicide_screen_target,
            source_note, provenance_json, refreshed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        mental_rows,
    )
    conn.commit()
    conn.close()
    return {
        "province_code": province_code,
        "disease_rows": len(disease_rows),
        "mental_rows": len(mental_rows),
        "reference_years": sorted(
            {
                int(component["reference_year_be"])
                for component in [*disease_components.values(), *mental_components.values()]
                if int(component["reference_year_be"] or 0) > 0
            }
        ),
        "refreshed_at": now_iso(),
    }


def _mart_row_count(conn: sqlite3.Connection, table_name: str, province_code: str | None = None) -> int:
    if province_code:
        row = conn.execute(
            f"SELECT COUNT(*) AS row_count FROM {table_name} WHERE province_code = ?",
            (province_code,),
        ).fetchone()
    else:
        row = conn.execute(f"SELECT COUNT(*) AS row_count FROM {table_name}").fetchone()
    return int(row["row_count"] or 0)


def ensure_district_need_source_marts(
    *,
    province_code: str | None = None,
    store_path: str | None = None,
    db_path: str | None = None,
) -> dict:
    build_district_baseline_schema(store_path)
    conn = get_store_connection(store_path)
    disease_rows = _mart_row_count(conn, "district_disease_mart", province_code=province_code)
    mental_rows = _mart_row_count(conn, "district_mental_mart", province_code=province_code)
    conn.close()
    if disease_rows > 0 and mental_rows > 0:
        return {
            "status": "ready",
            "province_code": province_code,
            "disease_rows": disease_rows,
            "mental_rows": mental_rows,
        }
    return refresh_district_need_source_marts(province_code=province_code, store_path=store_path, db_path=db_path)


def _load_district_disease_lookup(store_path: str | None = None) -> dict[tuple[str, str], dict]:
    conn = get_store_connection(store_path)
    rows = conn.execute(
        """
        SELECT province_code, amphur_code, reference_year_be,
               prevalence_cvd, prevalence_cancer, prevalence_dm, prevalence_ckd,
               source_note, provenance_json
        FROM district_disease_mart
        """
    ).fetchall()
    conn.close()
    return {
        (str(row["province_code"]), str(row["amphur_code"])): {
            "reference_year_be": int(row["reference_year_be"] or 0) or None,
            "prevalence_cvd": round(float(row["prevalence_cvd"] or 0.0), 2),
            "prevalence_cancer": round(float(row["prevalence_cancer"] or 0.0), 2),
            "prevalence_dm": round(float(row["prevalence_dm"] or 0.0), 2),
            "prevalence_ckd": round(float(row["prevalence_ckd"] or 0.0), 2),
            "source_note": row["source_note"] or "",
            "provenance": _json_loads(row["provenance_json"]) or {},
        }
        for row in rows
    }


def _load_district_mental_lookup_from_store(store_path: str | None = None) -> dict[tuple[str, str], dict]:
    conn = get_store_connection(store_path)
    rows = conn.execute(
        """
        SELECT province_code, amphur_code, reference_year_be,
               mental_risk_rate, depression_positive_count, depression_screen_target,
               suicide_risk_rate, suicide_risk_count, suicide_screen_target,
               source_note, provenance_json
        FROM district_mental_mart
        """
    ).fetchall()
    conn.close()
    return {
        (str(row["province_code"]), str(row["amphur_code"])): {
            "reference_year_be": int(row["reference_year_be"] or 0) or None,
            "mental_risk_rate": round(float(row["mental_risk_rate"] or 0.0), 2),
            "depression_positive_count": round(float(row["depression_positive_count"] or 0.0), 2),
            "depression_screen_target": round(float(row["depression_screen_target"] or 0.0), 2),
            "suicide_risk_rate": round(float(row["suicide_risk_rate"] or 0.0), 2),
            "suicide_risk_count": round(float(row["suicide_risk_count"] or 0.0), 2),
            "suicide_screen_target": round(float(row["suicide_screen_target"] or 0.0), 2),
            "source_note": row["source_note"] or "",
            "provenance": _json_loads(row["provenance_json"]) or {},
        }
        for row in rows
    }


def _extract_elderly_pct(age_sex_json, population_total: int) -> float:
    if population_total <= 0:
        return 0.0
    age_map = _json_loads(age_sex_json) if isinstance(age_sex_json, str) else (age_sex_json or {})
    if not isinstance(age_map, dict):
        return 0.0
    elderly_total = 0
    for age_key, payload in age_map.items():
        try:
            age_num = int(str(age_key))
        except (TypeError, ValueError):
            continue
        if age_num < 60:
            continue
        if isinstance(payload, dict):
            elderly_total += int(payload.get("male") or 0)
            elderly_total += int(payload.get("female") or 0)
    return round((elderly_total * 100.0) / float(population_total), 2)


def _load_district_chronic_burden_lookup(conn: sqlite3.Connection) -> dict[tuple[str, str], dict]:
    rows = conn.execute(
        """
        SELECT
            ou.province_code,
            ou.amphur_code,
            SUM(COALESCE(db.prevalence_count, 0)) AS prevalence_count,
            MAX(db.reference_year) AS reference_year
        FROM disease_burden db
        JOIN organizational_unit ou ON ou.unit_id = db.unit_id
        WHERE db.disease_category = 'chronic'
          AND ou.province_code IS NOT NULL
          AND TRIM(ou.province_code) <> ''
          AND ou.amphur_code IS NOT NULL
          AND TRIM(ou.amphur_code) <> ''
        GROUP BY ou.province_code, ou.amphur_code
        """
    ).fetchall()
    return {
        (str(row["province_code"]), str(row["amphur_code"])): {
            "prevalence_count": int(row["prevalence_count"] or 0),
            "reference_year": int(row["reference_year"] or 0) or None,
        }
        for row in rows
    }


def _load_district_mental_workload_lookup(conn: sqlite3.Connection) -> dict[tuple[str, str], dict]:
    rows = conn.execute(
        """
        WITH latest_year AS (
            SELECT MAX(period_year) AS period_year
            FROM workload
            WHERE period_year IS NOT NULL
        )
        SELECT
            ou.province_code,
            ou.amphur_code,
            SUM(COALESCE(w.mental_health_visits, 0)) AS mental_health_visits,
            MAX(w.period_year) AS reference_year
        FROM workload w
        JOIN latest_year y ON y.period_year = w.period_year
        JOIN organizational_unit ou ON ou.unit_id = w.unit_id
        WHERE ou.province_code IS NOT NULL
          AND TRIM(ou.province_code) <> ''
          AND ou.amphur_code IS NOT NULL
          AND TRIM(ou.amphur_code) <> ''
        GROUP BY ou.province_code, ou.amphur_code
        """
    ).fetchall()
    return {
        (str(row["province_code"]), str(row["amphur_code"])): {
            "mental_health_visits": int(row["mental_health_visits"] or 0),
            "reference_year": int(row["reference_year"] or 0) or None,
        }
        for row in rows
    }


def _build_need_profile(
    amphur_row: dict,
    *,
    province_population_total: int,
    district_disease_payload: dict | None,
    district_mental_payload: dict | None,
) -> dict:
    population_total = int(amphur_row.get("population_total") or 0)
    elderly_pct = _extract_elderly_pct(amphur_row.get("age_sex_json"), population_total)
    disease_payload = district_disease_payload or {}
    mental_payload = district_mental_payload or {}

    return {
        "population_total": population_total,
        "population_male": int(amphur_row.get("male_total") or 0),
        "population_female": int(amphur_row.get("female_total") or 0),
        "elderly_pct": elderly_pct,
        "prevalence_cvd": round(float(disease_payload.get("prevalence_cvd") or 0.0), 2),
        "prevalence_cancer": round(float(disease_payload.get("prevalence_cancer") or 0.0), 2),
        "prevalence_dm": round(float(disease_payload.get("prevalence_dm") or 0.0), 2),
        "prevalence_ckd": round(float(disease_payload.get("prevalence_ckd") or 0.0), 2),
        "mental_risk_rate": round(float(mental_payload.get("mental_risk_rate") or 0.0), 2),
        "suicide_risk_rate": round(float(mental_payload.get("suicide_risk_rate") or 0.0), 2),
        "population_reference_year": amphur_row.get("population_reference_year"),
        "population_source": amphur_row.get("population_source"),
        "province_population_total": province_population_total,
        "chronic_reference_year": disease_payload.get("reference_year_be"),
        "mental_reference_year": mental_payload.get("reference_year_be"),
        "disease_source_note": disease_payload.get("source_note") or "",
        "mental_source_note": mental_payload.get("source_note") or "",
        "disease_provenance": disease_payload.get("provenance") or {},
        "mental_provenance": mental_payload.get("provenance") or {},
        "source_note": "elderly uses HDC age structure; disease and mental rates use direct public report_data marts aggregated to district level",
    }


def _load_clinical_indicator_lookup(dataset_path: str | None = None) -> dict[str, dict[str, float]]:
    path = dataset_path or CLINICAL_DATASET_PATH
    if not os.path.exists(path):
        return {}
    indicator_codes = {
        item["indicator_code"]
        for item in DQ_INDICATOR_DEFINITIONS + CLINICAL_OUTCOME_DEFINITIONS + CLINICAL_SERVICE_PLAN_DEFINITIONS
    }
    with open(path, encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    if not rows:
        return {}
    lookup: dict[str, dict[str, float]] = defaultdict(dict)
    priorities: dict[tuple[str, str], tuple[int, int]] = {}
    for row in rows[1:]:
        if len(row) < 5:
            continue
        hospital_name = _normalize_lookup_key(row[2])
        indicator_raw = (row[3] or "").strip()
        indicator_code = indicator_raw.split("_", 1)[0]
        if hospital_name == "" or indicator_code not in indicator_codes:
            continue
        value_num = _to_float(row[4])
        if value_num is None:
            continue
        column_name = indicator_raw.split("_", 1)[1] if "_" in indicator_raw else ""
        priority = _clinical_indicator_priority(column_name)
        key = (hospital_name, indicator_code)
        if key not in priorities or priority < priorities[key]:
            priorities[key] = priority
            lookup[hospital_name][indicator_code] = value_num
    return dict(lookup)


def _fetch_hospital_units(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            s.hospital_name,
            s.unit_id,
            s.province_code,
            s.home_amphur_code AS amphur_code,
            s.home_amphur_name AS amphur_name,
            s.unit_type_label
        FROM hospital_scope_config s
        ORDER BY s.province_code, s.hospital_name
        """
    ).fetchall()
    rows_by_name = {
        _normalize_lookup_key(row["hospital_name"]): dict(row)
        for row in rows
        if row["hospital_name"]
    }
    units = []
    seen_unit_ids: set[str] = set()
    for level_profile in HOSPITAL_LEVEL_PROFILES:
        for hospital_name in level_profile.get("peer_hospital_names", []):
            row = rows_by_name.get(_normalize_lookup_key(hospital_name))
            if not row:
                continue
            seen_unit_ids.add(str(row["unit_id"]))
            units.append(
                {
                    "unit_id": row["unit_id"],
                    "unit_name": hospital_name,
                    "province_code": row["province_code"],
                    "amphur_code": row["amphur_code"],
                    "amphur_name": row["amphur_name"],
                    "unit_type_label": row["unit_type_label"],
                    "hospital_level": level_profile["hospital_level"],
                    "peer_unit_type_label": level_profile["peer_unit_type_label"],
                }
            )
    community_rows = conn.execute(
        """
        SELECT
            u.unit_id,
            u.unit_name,
            u.province_code,
            u.amphur_code,
            u.amphur_name,
            u.unit_type_label
        FROM organizational_unit u
        WHERE u.unit_type_label = 'รพช.'
          AND u.province_code IS NOT NULL
          AND TRIM(u.province_code) <> ''
        ORDER BY u.province_code, u.amphur_code, u.unit_name
        """
    ).fetchall()
    for row in community_rows:
        unit_id = str(row["unit_id"] or "")
        if not unit_id or unit_id in seen_unit_ids:
            continue
        units.append(
            {
                "unit_id": unit_id,
                "unit_name": row["unit_name"],
                "province_code": row["province_code"],
                "amphur_code": row["amphur_code"],
                "amphur_name": row["amphur_name"],
                "unit_type_label": row["unit_type_label"],
                "hospital_level": "รพช.",
                "peer_unit_type_label": "รพช.",
            }
        )
        seen_unit_ids.add(unit_id)
    return units


def _fetch_allowed_province_codes(conn: sqlite3.Connection) -> set[str]:
    allowlist = set(PROVINCE_DISEASE_PREVALENCE_REFERENCE.keys())
    rows = conn.execute(
        """
        SELECT DISTINCT province_code
        FROM organizational_unit
        WHERE unit_type_label IN ('รพศ.', 'รพท.', 'รพช.')
          AND province_code IS NOT NULL
          AND TRIM(province_code) <> ''
        """
    ).fetchall()
    return {str(row["province_code"]) for row in rows if str(row["province_code"]) in allowlist}


def _get_latest_pp_outcome_year(conn: sqlite3.Connection, province_code: str, amphur_code: str) -> int | None:
    row = conn.execute(
        """
        SELECT MAX(year_be) AS max_year
        FROM fact_pp_outcome_district
        WHERE province_code = ?
          AND amphur_code = ?
          AND display_level IN ('ampur', 'district')
        """,
        (province_code, amphur_code),
    ).fetchone()
    return int(row["max_year"]) if row and row["max_year"] else None


def _compute_unit_workforce_summary(conn: sqlite3.Connection, unit_id: str) -> dict:
    base_cte = """
        WITH active_positions AS (
            SELECT
                p.position_name_th,
                p.position_group_name,
                COALESCE(NULLIF(TRIM(p.position_specialist_name), ''), 'ไม่ระบุสาขา') AS specialist_name,
                COUNT(DISTINCT a.personnel_id) AS headcount
            FROM assignment a
            JOIN position p ON p.position_id = a.position_id
            WHERE p.unit_id = ?
              AND a.status = 'active'
              AND (a.end_date IS NULL OR a.end_date = '')
            GROUP BY p.position_name_th, p.position_group_name, COALESCE(NULLIF(TRIM(p.position_specialist_name), ''), 'ไม่ระบุสาขา')
        )
    """
    counts = {}
    for metric_code, definition in HR_WORKFORCE_DICTIONARY.items():
        placeholders = ",".join("?" for _ in definition["exact_position_names"])
        rows = conn.execute(
            base_cte
            + f"""
            SELECT SUM(headcount) AS headcount
            FROM active_positions
            WHERE TRIM(position_name_th) IN ({placeholders})
            """,
            (unit_id, *definition["exact_position_names"]),
        ).fetchall()
        headcount_total = sum(int(row["headcount"] or 0) for row in rows)
        counts[metric_code] = headcount_total
    return {
        "counts": counts,
        "total_headcount": int(sum(counts.values())),
    }


def _compute_unit_workload_summary(conn: sqlite3.Connection, unit_id: str) -> dict:
    year_row = conn.execute(
        "SELECT MAX(period_year) AS max_year FROM workload WHERE unit_id = ?",
        (unit_id,),
    ).fetchone()
    if not year_row or not year_row["max_year"]:
        return {}
    latest_year = int(year_row["max_year"])
    select_parts = [f"SUM(COALESCE({column}, 0)) AS {column}" for column in WORKLOAD_METRIC_COLUMNS]
    row = conn.execute(
        f"""
        SELECT {", ".join(select_parts)}
        FROM workload
        WHERE unit_id = ?
          AND period_year = ?
        """,
        (unit_id, latest_year),
    ).fetchone()
    if not row:
        return {}
    metrics = {column: round(float(row[column] or 0), 2) for column in WORKLOAD_METRIC_COLUMNS}
    metrics["reference_year"] = latest_year
    return metrics


def _build_unit_cache(conn: sqlite3.Connection) -> tuple[list[dict], dict[str, dict]]:
    units = _fetch_hospital_units(conn)
    cache: dict[str, dict] = {}
    for unit in units:
        cache[unit["unit_id"]] = {
            "meta": unit,
            "clinical_workforce": _compute_unit_workforce_summary(conn, unit["unit_id"]),
            "clinical_workload": _compute_unit_workload_summary(conn, unit["unit_id"]),
            "pp_capacity": get_pp_unit_capacity_summary(
                province_code=unit["province_code"],
                unit_name=unit["unit_name"],
            ),
        }
    return units, cache


def _pick_peer_units(units: list[dict], province_code: str, hospital_level: str) -> tuple[list[dict], str]:
    normalized_level = _normalize_hospital_level(hospital_level)
    same_level_units = [
        unit for unit in units
        if _normalize_hospital_level(unit.get("hospital_level")) == normalized_level
    ]
    province_units = [unit for unit in same_level_units if unit.get("province_code") == province_code]
    if province_units:
        return province_units, "province_same_level"
    return same_level_units, "health_region_same_level"


def _aggregate_clinical_workforce(peer_payloads: list[dict]) -> dict:
    metrics = []
    counts = {}
    for metric_code, definition in HR_WORKFORCE_DICTIONARY.items():
        values = [float(payload["clinical_workforce"]["counts"].get(metric_code, 0) or 0) for payload in peer_payloads]
        counts[metric_code] = _median(values)
        metrics.append(
            {
                "metric_code": metric_code,
                "label_th": definition["label_th"],
                "median_count": counts[metric_code],
                "min_count": round(min(values), 2) if values else 0.0,
                "max_count": round(max(values), 2) if values else 0.0,
                "peer_unit_count": len(values),
            }
        )
    metrics.sort(key=lambda item: (-item["median_count"], item["metric_code"]))
    return {
        "counts": counts,
        "metrics": metrics,
        "peer_unit_count": len(peer_payloads),
    }


def _aggregate_clinical_workload(peer_payloads: list[dict]) -> dict:
    metrics = []
    reference_years = []
    for column in WORKLOAD_METRIC_COLUMNS:
        values = []
        for payload in peer_payloads:
            summary = payload.get("clinical_workload") or {}
            if "reference_year" in summary:
                reference_years.append(int(summary["reference_year"]))
                values.append(float(summary.get(column) or 0))
        metrics.append(
            {
                "metric_code": column,
                "median_value": _median(values),
                "min_value": round(min(values), 2) if values else 0.0,
                "max_value": round(max(values), 2) if values else 0.0,
                "peer_unit_count": len(values),
            }
        )
    return {
        "reference_year": max(reference_years) if reference_years else None,
        "metrics": metrics,
    }


def _aggregate_pp_capacity(peer_payloads: list[dict]) -> dict:
    unit_maps = []
    function_labels = {}
    profession_labels = {}
    profession_totals_by_unit = []
    for payload in peer_payloads:
        capacity_map = {}
        for row in payload["pp_capacity"].get("capacity", []):
            key = (row["pp_function_code"], row["profession_code"])
            capacity_map[key] = {
                "fte_total": float(row.get("fte_total") or 0),
                "headcount_total": float(row.get("headcount_total") or 0),
            }
            function_labels[row["pp_function_code"]] = row.get("function_name_th") or row["pp_function_code"]
            profession_labels[row["profession_code"]] = row.get("profession_name_th") or row["profession_code"]
        unit_maps.append(capacity_map)
        profession_totals = {}
        for profession_code, audit in (payload["pp_capacity"].get("audit_trail") or {}).items():
            profession_totals[profession_code] = float(audit.get("count") or 0)
            profession_labels[profession_code] = audit.get("label") or profession_labels.get(profession_code) or profession_code
        profession_totals_by_unit.append(profession_totals)

    all_keys = sorted({key for item in unit_maps for key in item.keys()})
    rows = []
    for function_code, profession_code in all_keys:
        fte_values = [unit_map.get((function_code, profession_code), {}).get("fte_total", 0.0) for unit_map in unit_maps]
        headcount_values = [unit_map.get((function_code, profession_code), {}).get("headcount_total", 0.0) for unit_map in unit_maps]
        median_fte = _median(fte_values)
        median_headcount = _median(headcount_values)
        if median_fte <= 0 and median_headcount <= 0:
            continue
        rows.append(
            {
                "pp_function_code": function_code,
                "function_name_th": function_labels.get(function_code, function_code),
                "profession_code": profession_code,
                "profession_name_th": profession_labels.get(profession_code, profession_code),
                "fte_total": median_fte,
                "headcount_total": median_headcount,
                "peer_unit_count": len(peer_payloads),
            }
        )

    profession_totals = {}
    profession_codes = sorted({code for item in profession_totals_by_unit for code in item.keys()})
    for profession_code in profession_codes:
        values = [item.get(profession_code, 0.0) for item in profession_totals_by_unit]
        profession_totals[profession_code] = {
            "profession_code": profession_code,
            "profession_name_th": profession_labels.get(profession_code, profession_code),
            "headcount_total": _median(values),
            "peer_unit_count": len(peer_payloads),
        }

    rows.sort(key=lambda item: (item["function_name_th"], item["profession_name_th"]))
    return {
        "capacity": rows,
        "profession_totals": profession_totals,
        "peer_unit_count": len(peer_payloads),
    }


def _aggregate_clinical_indicator_baseline(
    peer_payloads: list[dict],
    indicator_lookup: dict[str, dict[str, float]],
    definitions: list[dict],
) -> list[dict]:
    rows = []
    for definition in definitions:
        indicator_code = definition["indicator_code"]
        values = []
        source_hospitals = []
        for payload in peer_payloads:
            unit_name = payload["meta"]["unit_name"]
            hospital_indicators = indicator_lookup.get(_normalize_lookup_key(unit_name), {})
            value_num = _to_float(hospital_indicators.get(indicator_code))
            if value_num is None:
                continue
            values.append(value_num)
            source_hospitals.append(unit_name)
        median_value = _median(values)
        if not values:
            continue
        rows.append(
            {
                "indicator_code": indicator_code,
                "label": definition.get("label") or indicator_code,
                "unit": definition.get("unit") or "",
                "value_num": median_value,
                "peer_unit_count": len(values),
                "source_hospitals": source_hospitals,
            }
        )
    return rows


def _build_peer_profile_cache(
    units: list[dict],
    unit_cache: dict[str, dict],
    clinical_indicator_lookup: dict[str, dict[str, float]],
    province_codes: list[str] | None = None,
) -> dict[tuple[str, str], dict]:
    peer_cache: dict[tuple[str, str], dict] = {}
    target_province_codes = province_codes or sorted({unit["province_code"] for unit in units})
    available_indicator_payloads = [
        payload
        for payload in unit_cache.values()
        if clinical_indicator_lookup.get(_normalize_lookup_key(payload["meta"].get("unit_name")))
    ]
    for province_code in target_province_codes:
        province_indicator_payloads = [
            payload
            for payload in available_indicator_payloads
            if payload["meta"].get("province_code") == province_code
        ]
        for level_profile in HOSPITAL_LEVEL_PROFILES:
            peer_units, peer_scope = _pick_peer_units(
                units,
                province_code=province_code,
                hospital_level=level_profile["hospital_level"],
            )
            peer_payloads = [unit_cache[unit["unit_id"]] for unit in peer_units if unit["unit_id"] in unit_cache]
            indicator_peer_payloads = [
                payload
                for payload in peer_payloads
                if clinical_indicator_lookup.get(_normalize_lookup_key(payload["meta"].get("unit_name")))
            ]
            indicator_peer_scope = peer_scope
            if not indicator_peer_payloads and province_indicator_payloads:
                indicator_peer_payloads = province_indicator_payloads
                indicator_peer_scope = "province_any_indicator_proxy"
            elif not indicator_peer_payloads and available_indicator_payloads:
                indicator_peer_payloads = available_indicator_payloads
                indicator_peer_scope = "health_region_any_indicator_proxy"
            peer_cache[(province_code, level_profile["hospital_level"])] = {
                "hospital_level": level_profile["hospital_level"],
                "peer_unit_type_label": level_profile["peer_unit_type_label"],
                "clinical_scope_type": level_profile["clinical_scope_type"],
                "clinical_scope_note": level_profile["clinical_scope_note"],
                "peer_scope": peer_scope,
                "peer_unit_count": len(peer_payloads),
                "indicator_peer_scope": indicator_peer_scope,
                "indicator_peer_unit_count": len(indicator_peer_payloads),
                "peer_units": [
                    {
                        "unit_name": payload["meta"]["unit_name"],
                        "province_code": payload["meta"]["province_code"],
                        "amphur_code": payload["meta"]["amphur_code"],
                        "amphur_name": payload["meta"].get("amphur_name"),
                        "unit_type_label": payload["meta"]["unit_type_label"],
                        "hospital_level": payload["meta"].get("hospital_level"),
                    }
                    for payload in peer_payloads
                ],
                "clinical_workforce": _aggregate_clinical_workforce(peer_payloads),
                "clinical_workload": _aggregate_clinical_workload(peer_payloads),
                "dq_profile": _aggregate_clinical_indicator_baseline(
                    indicator_peer_payloads,
                    clinical_indicator_lookup,
                    DQ_INDICATOR_DEFINITIONS,
                ),
                "clinical_outcomes": _aggregate_clinical_indicator_baseline(
                    indicator_peer_payloads,
                    clinical_indicator_lookup,
                    CLINICAL_OUTCOME_DEFINITIONS,
                ),
                "clinical_service_plan": _aggregate_clinical_indicator_baseline(
                    indicator_peer_payloads,
                    clinical_indicator_lookup,
                    CLINICAL_SERVICE_PLAN_DEFINITIONS,
                ),
                "pp_capacity": _aggregate_pp_capacity(peer_payloads),
            }
    return peer_cache


def _build_readiness_payload(pp_population_total: int, pp_outcomes: list[dict], peer_profile: dict) -> dict:
    population_ready = pp_population_total > 0
    pp_outcomes_ready = len(pp_outcomes) > 0
    pp_capacity_ready = len((peer_profile.get("pp_capacity") or {}).get("capacity", [])) > 0
    clinical_workforce_ready = bool((peer_profile.get("clinical_workforce") or {}).get("counts"))
    workload_ready = bool((peer_profile.get("clinical_workload") or {}).get("reference_year"))
    clinical_outcomes_ready = len(peer_profile.get("clinical_outcomes") or []) > 0
    clinical_service_plan_ready = len(peer_profile.get("clinical_service_plan") or []) > 0
    if population_ready and pp_outcomes_ready and pp_capacity_ready and clinical_workforce_ready:
        status = "ready_actual_pp_plus_proxy_clinical"
    elif population_ready and (pp_outcomes_ready or pp_capacity_ready or clinical_workforce_ready):
        status = "partial_ready"
    else:
        status = "insufficient_data"
    return {
        "status": status,
        "population_ready": population_ready,
        "pp_outcomes_ready": pp_outcomes_ready,
        "pp_capacity_ready": pp_capacity_ready,
        "clinical_workforce_ready": clinical_workforce_ready,
        "clinical_workload_ready": workload_ready,
        "clinical_outcomes_ready": clinical_outcomes_ready,
        "clinical_service_plan_ready": clinical_service_plan_ready,
        "uses_proxy_for_pp_capacity": True,
        "uses_proxy_for_clinical": True,
    }


def refresh_district_baseline_profiles(province_code: str | None = None, store_path: str | None = None, db_path: str | None = None) -> dict:
    build_district_baseline_schema(store_path)
    hr_conn = get_hr_connection(db_path)
    store_conn = get_store_connection(store_path)
    ensure_district_need_source_marts(province_code=province_code, store_path=store_path, db_path=db_path)
    units, unit_cache = _build_unit_cache(hr_conn)
    clinical_indicator_lookup = _load_clinical_indicator_lookup()
    allowed_provinces = _fetch_allowed_province_codes(hr_conn)
    amphur_rows = _load_amphur_reference_rows(province_code=province_code)
    amphur_rows = [row for row in amphur_rows if row["province_code"] in allowed_provinces]
    peer_cache = _build_peer_profile_cache(units, unit_cache, clinical_indicator_lookup, sorted(allowed_provinces))
    district_disease_lookup = _load_district_disease_lookup(store_path=store_path)
    district_mental_lookup = _load_district_mental_lookup_from_store(store_path=store_path)
    province_population_totals: dict[str, int] = {}
    for row in amphur_rows:
        province_population_totals[row["province_code"]] = province_population_totals.get(row["province_code"], 0) + int(row["population_total"] or 0)
    outcome_cache: dict[tuple[str, str], dict] = {}
    need_cache: dict[tuple[str, str], dict] = {}
    cur = store_conn.cursor()
    if province_code:
        cur.execute("DELETE FROM district_baseline_profile WHERE province_code = ?", (province_code,))
    else:
        cur.execute("DELETE FROM district_baseline_profile")

    inserted = 0
    for amphur_row in amphur_rows:
        outcome_key = (amphur_row["province_code"], amphur_row["amphur_code"])
        if outcome_key not in outcome_cache:
            pp_outcomes = get_pp_amphur_outcome_summary(
                province_code=amphur_row["province_code"],
                amphur_code=amphur_row["amphur_code"],
            )
            outcome_cache[outcome_key] = {
                "year_be": _get_latest_pp_outcome_year(hr_conn, amphur_row["province_code"], amphur_row["amphur_code"]),
                "rows": pp_outcomes,
                "indicator_count": len({item["indicator_code"] for item in pp_outcomes}),
                "off_target_count": len([item for item in pp_outcomes if item.get("is_off_target")]),
            }
        outcome_payload = outcome_cache[outcome_key]
        if outcome_key not in need_cache:
            need_cache[outcome_key] = _build_need_profile(
                amphur_row,
                province_population_total=province_population_totals.get(amphur_row["province_code"], amphur_row["population_total"]),
                district_disease_payload=district_disease_lookup.get(outcome_key),
                district_mental_payload=district_mental_lookup.get(outcome_key),
            )
        need_profile = need_cache[outcome_key]
        for level_profile in HOSPITAL_LEVEL_PROFILES:
            peer_profile = peer_cache.get((amphur_row["province_code"], level_profile["hospital_level"])) or {
                "hospital_level": level_profile["hospital_level"],
                "peer_unit_type_label": level_profile["peer_unit_type_label"],
                "clinical_scope_type": level_profile["clinical_scope_type"],
                "clinical_scope_note": level_profile["clinical_scope_note"],
                "peer_scope": "missing",
                "peer_unit_count": 0,
                "indicator_peer_scope": "missing",
                "indicator_peer_unit_count": 0,
                "peer_units": [],
                "clinical_workforce": {"counts": {}, "metrics": [], "peer_unit_count": 0},
                "clinical_workload": {"reference_year": None, "metrics": []},
                "dq_profile": [],
                "clinical_outcomes": [],
                "clinical_service_plan": [],
                "pp_capacity": {"capacity": [], "profession_totals": {}, "peer_unit_count": 0},
            }
            readiness = _build_readiness_payload(
                pp_population_total=amphur_row["population_total"],
                pp_outcomes=outcome_payload["rows"],
                peer_profile=peer_profile,
            )
            provenance = {
                "pp_population": {
                    "source_type": "actual",
                    "source_key": amphur_row["population_source"],
                    "reference_year_be": amphur_row["population_reference_year"],
                },
                "pp_outcomes": {
                    "source_type": "actual",
                    "source_key": "fact_pp_outcome_district",
                    "reference_year_be": outcome_payload["year_be"],
                    "indicator_count": outcome_payload["indicator_count"],
                },
                "pp_capacity": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "peer_unit_count": peer_profile["peer_unit_count"],
                },
                "need_profile": {
                    "source_type": "actual_population_plus_actual_public_need",
                    "population_source": amphur_row["population_source"],
                    "population_reference_year": amphur_row["population_reference_year"],
                    "chronic_reference_year": need_profile.get("chronic_reference_year"),
                    "mental_reference_year": need_profile.get("mental_reference_year"),
                    "disease_source_note": need_profile.get("disease_source_note"),
                    "mental_source_note": need_profile.get("mental_source_note"),
                },
                "dq_profile": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile.get("indicator_peer_scope") or peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "indicator_count": len(peer_profile.get("dq_profile") or []),
                    "peer_unit_count": peer_profile.get("indicator_peer_unit_count") or peer_profile["peer_unit_count"],
                },
                "clinical_workforce": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "peer_unit_count": peer_profile["peer_unit_count"],
                },
                "clinical_workload": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "reference_year": (peer_profile.get("clinical_workload") or {}).get("reference_year"),
                },
                "clinical_outcomes": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile.get("indicator_peer_scope") or peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "indicator_count": len(peer_profile.get("clinical_outcomes") or []),
                    "peer_unit_count": peer_profile.get("indicator_peer_unit_count") or peer_profile["peer_unit_count"],
                },
                "clinical_service_plan": {
                    "source_type": "peer_proxy",
                    "peer_scope": peer_profile.get("indicator_peer_scope") or peer_profile["peer_scope"],
                    "peer_unit_type_label": peer_profile["peer_unit_type_label"],
                    "indicator_count": len(peer_profile.get("clinical_service_plan") or []),
                    "peer_unit_count": peer_profile.get("indicator_peer_unit_count") or peer_profile["peer_unit_count"],
                },
                "granularity_note": peer_profile["clinical_scope_note"],
            }
            cur.execute(
                """
                INSERT INTO district_baseline_profile (
                    province_code, province_name_th, amphur_code, amphur_name_th,
                    hospital_level, peer_unit_type_label, clinical_scope_type, clinical_scope_note,
                    pp_population_total, pp_population_source, pp_population_reference_year,
                    pp_outcome_year_be, pp_outcome_indicator_count, pp_outcome_off_target_count,
                    readiness_status, peer_scope, peer_unit_count, peer_units_json,
                    pp_outcomes_json, pp_capacity_json, need_profile_json, dq_profile_json,
                    clinical_workforce_json, clinical_workload_json,
                    clinical_outcomes_json, clinical_service_plan_json,
                    readiness_json, provenance_json, refreshed_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (
                    amphur_row["province_code"],
                    amphur_row["province_name_th"],
                    amphur_row["amphur_code"],
                    amphur_row["amphur_name_th"],
                    level_profile["hospital_level"],
                    peer_profile["peer_unit_type_label"],
                    peer_profile["clinical_scope_type"],
                    peer_profile["clinical_scope_note"],
                    amphur_row["population_total"],
                    amphur_row["population_source"],
                    amphur_row["population_reference_year"],
                    outcome_payload["year_be"],
                    outcome_payload["indicator_count"],
                    outcome_payload["off_target_count"],
                    readiness["status"],
                    peer_profile["peer_scope"],
                    peer_profile["peer_unit_count"],
                    _json_dumps(peer_profile["peer_units"]),
                    _json_dumps(outcome_payload["rows"]),
                    _json_dumps(peer_profile["pp_capacity"]),
                    _json_dumps(need_profile),
                    _json_dumps(peer_profile.get("dq_profile") or []),
                    _json_dumps(peer_profile["clinical_workforce"]),
                    _json_dumps(peer_profile["clinical_workload"]),
                    _json_dumps(peer_profile["clinical_outcomes"]),
                    _json_dumps(peer_profile["clinical_service_plan"]),
                    _json_dumps(readiness),
                    _json_dumps(provenance),
                    now_iso(),
                ),
            )
            inserted += 1

    store_conn.commit()
    store_conn.close()
    hr_conn.close()
    return {
        "province_code": province_code,
        "inserted_profiles": inserted,
        "amphur_count": len(amphur_rows),
        "hospital_levels": [item["hospital_level"] for item in HOSPITAL_LEVEL_PROFILES],
        "refreshed_at": now_iso(),
    }


def ensure_district_baseline_profiles(store_path: str | None = None, db_path: str | None = None) -> dict:
    build_district_baseline_schema(store_path)
    conn = get_store_connection(store_path)
    row = conn.execute("SELECT COUNT(*) AS total_rows FROM district_baseline_profile").fetchone()
    disease_row = conn.execute("SELECT COUNT(*) AS total_rows FROM district_disease_mart").fetchone()
    mental_row = conn.execute("SELECT COUNT(*) AS total_rows FROM district_mental_mart").fetchone()
    allowlist_sql = ",".join(f"'{code}'" for code in sorted(PROVINCE_DISEASE_PREVALENCE_REFERENCE.keys()))
    extra_disease_row = conn.execute(
        f"SELECT COUNT(*) AS total_rows FROM district_disease_mart WHERE province_code NOT IN ({allowlist_sql})"
    ).fetchone()
    extra_mental_row = conn.execute(
        f"SELECT COUNT(*) AS total_rows FROM district_mental_mart WHERE province_code NOT IN ({allowlist_sql})"
    ).fetchone()
    stale_row = conn.execute(
        """
        SELECT COUNT(*) AS stale_rows
        FROM district_baseline_profile
        WHERE clinical_outcomes_json IS NULL
           OR clinical_service_plan_json IS NULL
           OR need_profile_json IS NULL
           OR dq_profile_json IS NULL
           OR need_profile_json LIKE '%proxy%'
           OR hospital_level NOT IN ('รพศ.', 'รพท.', 'รพช.')
        """
    ).fetchone()
    conn.close()
    if (
        int(row["total_rows"] or 0) == 0
        or int(stale_row["stale_rows"] or 0) > 0
        or int(disease_row["total_rows"] or 0) == 0
        or int(mental_row["total_rows"] or 0) == 0
        or int(extra_disease_row["total_rows"] or 0) > 0
        or int(extra_mental_row["total_rows"] or 0) > 0
    ):
        return refresh_district_baseline_profiles(store_path=store_path, db_path=db_path)
    return {"status": "ready", "row_count": int(row["total_rows"] or 0)}


def list_district_baseline_profiles(
    province_code: str | None = None,
    hospital_level: str | None = None,
    store_path: str | None = None,
) -> list[dict]:
    build_district_baseline_schema(store_path)
    conn = get_store_connection(store_path)
    sql = """
        SELECT
            province_code, province_name_th, amphur_code, amphur_name_th,
            hospital_level, peer_unit_type_label, clinical_scope_type,
            pp_population_total, pp_population_source, pp_population_reference_year,
            pp_outcome_year_be, pp_outcome_indicator_count, pp_outcome_off_target_count,
            readiness_status, peer_scope, peer_unit_count, refreshed_at, updated_at
        FROM district_baseline_profile
        WHERE 1 = 1
    """
    params = []
    if province_code:
        sql += " AND province_code = ?"
        params.append(province_code)
    if hospital_level:
        hospital_level = _normalize_hospital_level(hospital_level)
        sql += " AND hospital_level = ?"
        params.append(hospital_level)
    sql += " ORDER BY province_code, amphur_code, hospital_level"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_district_baseline_profile(
    province_code: str,
    amphur_code: str,
    hospital_level: str,
    store_path: str | None = None,
) -> dict | None:
    build_district_baseline_schema(store_path)
    conn = get_store_connection(store_path)
    normalized_level = _normalize_hospital_level(hospital_level)
    row = conn.execute(
        """
        SELECT *
        FROM district_baseline_profile
        WHERE province_code = ?
          AND amphur_code = ?
          AND hospital_level = ?
        LIMIT 1
        """,
        (province_code, amphur_code, normalized_level),
    ).fetchone()
    conn.close()
    if not row:
        return None
    payload = dict(row)
    for key in (
        "peer_units_json",
        "pp_outcomes_json",
        "pp_capacity_json",
        "need_profile_json",
        "dq_profile_json",
        "clinical_workforce_json",
        "clinical_workload_json",
        "clinical_outcomes_json",
        "clinical_service_plan_json",
        "readiness_json",
        "provenance_json",
    ):
        payload[key.replace("_json", "")] = _json_loads(payload.pop(key))
    return payload
