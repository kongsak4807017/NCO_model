import json
import os
import sqlite3
import uuid
from datetime import datetime


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")

WORKLOAD_REFERENCE_SEED = [
    {
        "metric_code": "opd_per_10k",
        "metric_name_th": "OPD visits per 10k",
        "service_function": "OPD",
        "rate_unit": "per_10k",
        "default_reference_value": 1800.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total", "pharmacist_total"], ensure_ascii=False),
        "source_strategy": "public_direct_plus_manual_optional",
        "source_detail_json": json.dumps(
            {
                "public_datasets": ["s_opd_all"],
                "manual_activity_codes": ["OPD_VISIT"],
                "notes": "Calibrate from Open Data province aggregates; manual import remains optional for unit-level refinement.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "ipd_per_10k",
        "metric_name_th": "IPD visits per 10k",
        "service_function": "IPD",
        "rate_unit": "per_10k",
        "default_reference_value": 120.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total", "physical_therapist_total"], ensure_ascii=False),
        "source_strategy": "public_direct_plus_manual_optional",
        "source_detail_json": json.dumps(
            {
                "public_datasets": ["s_ipd_all"],
                "manual_activity_codes": ["BED_DAYS", "IPD_ADMIT", "IPD_DISCHARGE"],
                "notes": "Public source uses aggregate inpatient workload; manual import can override with facility-level bed-days and admissions.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "er_per_10k",
        "metric_name_th": "ER visits per 10k",
        "service_function": "ER",
        "rate_unit": "per_10k",
        "default_reference_value": 220.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total"], ensure_ascii=False),
        "source_strategy": "public_proxy_plus_manual_preferred",
        "source_detail_json": json.dumps(
            {
                "public_datasets": ["s_urgency_admit"],
                "manual_activity_codes": ["ER_VISIT", "ER_ADMIT"],
                "notes": "Current public source is an emergency severity/admit proxy, not full ER volume. Manual ER_VISIT is preferred for exact denominator.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "or_per_10k",
        "metric_name_th": "OR cases per 10k",
        "service_function": "OR",
        "rate_unit": "per_10k",
        "default_reference_value": 18.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total", "physical_therapist_total"], ensure_ascii=False),
        "source_strategy": "manual_required",
        "source_detail_json": json.dumps(
            {
                "public_datasets": [],
                "manual_activity_codes": ["OR_MAJOR", "OR_MINOR"],
                "notes": "No generic public OR workload dataset was identified in MoPH Open Data search as of 2026-03-27; manual service statistics are required.",
            },
            ensure_ascii=False,
        ),
        "empty_status": "manual_source_required",
    },
    {
        "metric_code": "delivery_per_10k",
        "metric_name_th": "Delivery cases per 10k",
        "service_function": "Delivery",
        "rate_unit": "per_10k",
        "default_reference_value": 12.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total"], ensure_ascii=False),
        "source_strategy": "manual_preferred",
        "source_detail_json": json.dumps(
            {
                "public_datasets": [],
                "manual_activity_codes": ["DELIVERY", "CSECTION"],
                "notes": "Delivery workload can be captured from manual service statistics; no generic district-wide public workload dataset is wired in this release.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "mental_per_10k",
        "metric_name_th": "Mental health visits per 10k",
        "service_function": "Mental",
        "rate_unit": "per_10k",
        "default_reference_value": 350.0,
        "mapped_professions_json": json.dumps(["psychologist_total", "clinical_psychologist_total", "nurse_total"], ensure_ascii=False),
        "source_strategy": "internal_available",
        "source_detail_json": json.dumps(
            {
                "public_datasets": [],
                "manual_activity_codes": [],
                "notes": "Currently calibrated from internal workload table because mental_health_visits is populated in hr_blueprint.db.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "chronic_per_10k",
        "metric_name_th": "Chronic visits per 10k",
        "service_function": "Chronic",
        "rate_unit": "per_10k",
        "default_reference_value": 700.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total", "pharmacist_total"], ensure_ascii=False),
        "source_strategy": "manual_preferred",
        "source_detail_json": json.dumps(
            {
                "public_datasets": [],
                "manual_activity_codes": [],
                "notes": "Chronic workload is not yet calibrated from a generic public dataset in this release.",
            },
            ensure_ascii=False,
        ),
    },
    {
        "metric_code": "icu_per_10k",
        "metric_name_th": "ICU bed-days per 10k",
        "service_function": "ICU",
        "rate_unit": "per_10k",
        "default_reference_value": 25.0,
        "mapped_professions_json": json.dumps(["doctor_total", "nurse_total"], ensure_ascii=False),
        "source_strategy": "manual_required",
        "source_detail_json": json.dumps(
            {
                "public_datasets": [],
                "manual_activity_codes": ["ICU_BED_DAYS"],
                "notes": "No generic public ICU bed-day dataset was identified in MoPH Open Data search as of 2026-03-27; manual service statistics are required.",
            },
            ensure_ascii=False,
        ),
        "empty_status": "manual_source_required",
    },
]


BENCHMARK_SEED = [
    {
        "benchmark_key": "HNI_ELDERLY_RATE_PCT",
        "benchmark_domain": "hni_component",
        "subject_code": "elderly_rate_pct",
        "subject_name_th": "อัตราผู้สูงอายุ",
        "scope_type": "population",
        "rate_per": None,
        "target_value": 30.0,
        "reference_value": 30.0,
        "default_weight_pct": 40.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "internal_reference_v1",
        "evidence_level": "provisional",
        "notes": "ย้ายออกจาก hardcode ใน frontend เพื่อให้ reference คงที่",
    },
    {
        "benchmark_key": "HNI_CHRONIC_RATE_PCT",
        "benchmark_domain": "hni_component",
        "subject_code": "chronic_rate_pct",
        "subject_name_th": "อัตราโรคเรื้อรังรวม",
        "scope_type": "population",
        "rate_per": None,
        "target_value": 25.0,
        "reference_value": 25.0,
        "default_weight_pct": 40.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "internal_reference_v1",
        "evidence_level": "provisional",
        "notes": "ใช้เป็น reference คงที่แทน dynamic max normalization",
    },
    {
        "benchmark_key": "HNI_MENTAL_RISK_RATE_PER100K",
        "benchmark_domain": "hni_component",
        "subject_code": "mental_risk_rate_per100k",
        "subject_name_th": "อัตราความเสี่ยงสุขภาพจิต",
        "scope_type": "population",
        "rate_per": 100000.0,
        "target_value": 5000.0,
        "reference_value": 5000.0,
        "default_weight_pct": 20.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "internal_reference_v1",
        "evidence_level": "provisional",
        "notes": "ค่าอ้างอิงชั่วคราวจนกว่าจะมี reference table ระดับเขต/ประเทศ",
    },
    {
        "benchmark_key": "CLINICAL_DOCTOR_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "doctor_total",
        "subject_name_th": "แพทย์ทั้งหมด",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 3.5,
        "reference_value": None,
        "default_weight_pct": 32.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "migrated_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "เดิมเป็น hardcode ใน computeMultiProfessionWCI",
    },
    {
        "benchmark_key": "CLINICAL_NURSE_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "nurse_total",
        "subject_name_th": "พยาบาลทั้งหมด",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 12.0,
        "reference_value": None,
        "default_weight_pct": 38.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "migrated_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "เดิมเป็น hardcode ใน computeMultiProfessionWCI",
    },
    {
        "benchmark_key": "CLINICAL_PHARMACIST_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "pharmacist_total",
        "subject_name_th": "เภสัชกร",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 1.5,
        "reference_value": None,
        "default_weight_pct": 10.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "migrated_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "เดิมเป็น hardcode ใน computeMultiProfessionWCI",
    },
    {
        "benchmark_key": "CLINICAL_PT_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "physical_therapist_total",
        "subject_name_th": "นักกายภาพบำบัด",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 0.8,
        "reference_value": None,
        "default_weight_pct": 8.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "converted_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "แปลงจาก 8 ต่อแสน เป็น 0.8 ต่อหมื่น เพื่อให้ตรงกับ UI",
    },
    {
        "benchmark_key": "CLINICAL_PSY_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "psychologist_total",
        "subject_name_th": "นักจิตวิทยา",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 0.4,
        "reference_value": None,
        "default_weight_pct": 6.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "converted_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "แปลงจาก 4 ต่อแสน เป็น 0.4 ต่อหมื่น เพื่อให้ตรงกับ UI",
    },
    {
        "benchmark_key": "CLINICAL_CPSY_TOTAL",
        "benchmark_domain": "clinical_profession",
        "subject_code": "clinical_psychologist_total",
        "subject_name_th": "นักจิตวิทยาคลินิก",
        "scope_type": "clinical",
        "rate_per": 10000.0,
        "target_value": 0.2,
        "reference_value": None,
        "default_weight_pct": 6.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": None,
        "benchmark_source": "converted_from_frontend_v1",
        "evidence_level": "provisional",
        "notes": "แปลงจาก 2 ต่อแสน เป็น 0.2 ต่อหมื่น เพื่อให้ตรงกับ UI",
    },
    {
        "benchmark_key": "PP_FAM_MD",
        "benchmark_domain": "pp_profession",
        "subject_code": "FAM_MD",
        "subject_name_th": "แพทย์เวชศาสตร์ครอบครัว",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 0.3,
        "reference_value": None,
        "default_weight_pct": 15.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.4,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
    {
        "benchmark_key": "PP_RN",
        "benchmark_domain": "pp_profession",
        "subject_code": "RN",
        "subject_name_th": "พยาบาลวิชาชีพ",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 3.0,
        "reference_value": None,
        "default_weight_pct": 35.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.6,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
    {
        "benchmark_key": "PP_PH_ACAD",
        "benchmark_domain": "pp_profession",
        "subject_code": "PH_ACAD",
        "subject_name_th": "นักวิชาการสาธารณสุข",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 1.5,
        "reference_value": None,
        "default_weight_pct": 25.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.5,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
    {
        "benchmark_key": "PP_PH_OFFICER",
        "benchmark_domain": "pp_profession",
        "subject_code": "PH_OFFICER",
        "subject_name_th": "นักสาธารณสุข / เจ้าพนักงานสาธารณสุข",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 1.2,
        "reference_value": None,
        "default_weight_pct": 20.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.5,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
    {
        "benchmark_key": "PP_PSY",
        "benchmark_domain": "pp_profession",
        "subject_code": "PSY",
        "subject_name_th": "นักจิตวิทยา",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 0.15,
        "reference_value": None,
        "default_weight_pct": 3.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.4,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
    {
        "benchmark_key": "PP_CPSY",
        "benchmark_domain": "pp_profession",
        "subject_code": "CPSY",
        "subject_name_th": "นักจิตวิทยาคลินิก",
        "scope_type": "pp",
        "rate_per": 10000.0,
        "target_value": 0.08,
        "reference_value": None,
        "default_weight_pct": 2.0,
        "fte_per_headcount": 1.0,
        "pressure_fte_factor": 0.3,
        "benchmark_source": "internal_pp_seed_v1",
        "evidence_level": "provisional",
        "notes": "benchmark ชั่วคราวสำหรับ need preview ฝั่ง PP",
    },
]


INDICATOR_POLICY_SEED = [
    {
        "indicator_code": "49e6c2e9fb9ee2deb0639680325cfbcd",
        "policy_domain": "MENTAL",
        "policy_name_th": "8Q chronic",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "234d24523894e656f33260494dddd968",
        "policy_domain": "MENTAL",
        "policy_name_th": "2Q chronic",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "8f104b5d2848b8a05a487205f0287991",
        "policy_domain": "MENTAL",
        "policy_name_th": "2Q elderly",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "68e401815a64e624c286d97ef3582aa3",
        "policy_domain": "NCD",
        "policy_name_th": "HT screening",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "150edaa99ecbe538378b8150e0776763",
        "policy_domain": "NCD",
        "policy_name_th": "DM screening",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "82a12029ec7f57eb2e286e830f90b039",
        "policy_domain": "NCD",
        "policy_name_th": "HT control",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain_blocked_source",
    },
    {
        "indicator_code": "848b5045eab655b7be0069efcc445dd9",
        "policy_domain": "NCD",
        "policy_name_th": "DM control",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "28dd2c7955ce926456240b2ff0100bde",
        "policy_domain": "IMMUNIZATION",
        "policy_name_th": "fully immunized",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "c47283d3c2c1e6528ddcf88c254f21b3",
        "policy_domain": "IMMUNIZATION",
        "policy_name_th": "DTP5 Polio5",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "df12bdd1a98ec0306ad71b914356f313",
        "policy_domain": "NUTRITION",
        "policy_name_th": "nutrition 0-2",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "b86aa996a4d38717de811ed5d04663d5",
        "policy_domain": "NUTRITION",
        "policy_name_th": "nutrition 3-5",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "8189e9a96e80298c71924cc2cab4bcb6",
        "policy_domain": "NUTRITION",
        "policy_name_th": "weight for height 0-2",
        "include_in_phase1": 1,
        "include_in_outcome_validation": 1,
        "include_in_recommendation": 1,
        "attribution_scope": "public_pp",
        "private_sector_bias_flag": 0,
        "policy_note": "retain",
    },
    {
        "indicator_code": "1c1b8e24aff59258a806f122e264031e",
        "policy_domain": "MCH",
        "policy_name_th": "ANC first visit <= 12 weeks",
        "include_in_phase1": 0,
        "include_in_outcome_validation": 0,
        "include_in_recommendation": 0,
        "attribution_scope": "mixed_public_private",
        "private_sector_bias_flag": 1,
        "policy_note": "exclude_private_anc_bias",
    },
    {
        "indicator_code": "5087190fa0a3c28974fdde7fd1443d5e",
        "policy_domain": "MCH",
        "policy_name_th": "ANC quality",
        "include_in_phase1": 0,
        "include_in_outcome_validation": 0,
        "include_in_recommendation": 0,
        "attribution_scope": "mixed_public_private",
        "private_sector_bias_flag": 1,
        "policy_note": "exclude_private_anc_bias",
    },
    {
        "indicator_code": "f50124b9cbc6636272844273980ca42e",
        "policy_domain": "MCH",
        "policy_name_th": "postnatal 3 visits",
        "include_in_phase1": 0,
        "include_in_outcome_validation": 0,
        "include_in_recommendation": 0,
        "attribution_scope": "mixed_public_private",
        "private_sector_bias_flag": 1,
        "policy_note": "exclude_private_postnatal_bias",
    },
]


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_dict(row):
    return dict(row) if row is not None else None


def _percentile(values: list[float], q: float) -> float | None:
    ordered = sorted(float(v) for v in values if v is not None)
    if not ordered:
        return None
    if len(ordered) == 1:
        return ordered[0]
    idx = (len(ordered) - 1) * q
    lower = int(idx)
    upper = min(lower + 1, len(ordered) - 1)
    if lower == upper:
        return ordered[lower]
    fraction = idx - lower
    return ordered[lower] + ((ordered[upper] - ordered[lower]) * fraction)


def _table_exists(cur: sqlite3.Cursor, table_name: str) -> bool:
    row = cur.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _column_exists(cur: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
    try:
        rows = cur.execute(f"PRAGMA table_info({table_name})").fetchall()
    except sqlite3.OperationalError:
        return False
    for row in rows:
        name = row["name"] if isinstance(row, sqlite3.Row) else row[1]
        if str(name) == column_name:
            return True
    return False


def _load_external_workload_samples(cur: sqlite3.Cursor, metric_code: str) -> tuple[list[float], int]:
    if not _table_exists(cur, "analysis_workload_source_fact"):
        return [], 0
    rows = cur.execute(
        """
        WITH province_population AS (
            SELECT province_code, MAX(reference_year_be) AS reference_year_be, SUM(total_population) AS total_population
            FROM hdc_amphur_population_reference
            GROUP BY province_code
        ),
        province_metric AS (
            SELECT province_code, b_year, SUM(value_num) AS metric_total
            FROM analysis_workload_source_fact
            WHERE metric_code = ?
              AND province_code IS NOT NULL
              AND TRIM(province_code) <> ''
              AND value_num IS NOT NULL
              AND value_num > 0
            GROUP BY province_code, b_year
        )
        SELECT pm.province_code, pm.metric_total, pp.total_population
        FROM province_metric pm
        LEFT JOIN province_population pp
          ON pp.province_code = pm.province_code
        """
        ,
        (metric_code,),
    ).fetchall()
    positive_samples: list[float] = []
    total_units = 0
    for row in rows:
        metric_total = float(row["metric_total"] or 0.0)
        population_total = float(row["total_population"] or 0.0)
        if population_total <= 0:
            continue
        total_units += 1
        if metric_total > 0 and population_total > 0:
            positive_samples.append((metric_total / population_total) * 10000.0)
    return positive_samples, total_units


def _load_internal_workload_samples(cur: sqlite3.Cursor, metric_code: str) -> tuple[list[float], int]:
    column_name = {
        "opd_per_10k": "outpatient_visits",
        "ipd_per_10k": "inpatient_visits",
        "er_per_10k": "emergency_visits",
        "or_per_10k": "surgery_count",
        "delivery_per_10k": "delivery_count",
        "mental_per_10k": "mental_health_visits",
        "chronic_per_10k": "chronic_disease_visits",
        "icu_per_10k": None,
    }[metric_code]
    if not column_name:
        return [], 0
    rows = cur.execute(
        f"""
        WITH unit_population AS (
            SELECT province_code, amphur_code, MAX(reference_year_be) AS reference_year_be, MAX(total_population) AS total_population
            FROM hdc_amphur_population_reference
            GROUP BY province_code, amphur_code
        )
        SELECT ou.unit_id,
               SUM(COALESCE(w.{column_name}, 0)) AS metric_total,
               MAX(up.total_population) AS population_total
        FROM organizational_unit ou
        LEFT JOIN workload w ON w.unit_id = ou.unit_id
        LEFT JOIN unit_population up
          ON up.province_code = ou.province_code
         AND up.amphur_code = ou.amphur_code
        GROUP BY ou.unit_id
        """
    ).fetchall()
    positive_samples: list[float] = []
    total_units = 0
    for row in rows:
        total_units += 1
        metric_total = float(row["metric_total"] or 0.0)
        population_total = float(row["population_total"] or 0.0)
        if metric_total > 0 and population_total > 0:
            positive_samples.append((metric_total / population_total) * 10000.0)
    return positive_samples, total_units


def _rebuild_workload_reference(cur: sqlite3.Cursor):
    cur.execute("DELETE FROM analysis_workload_reference")
    for item in WORKLOAD_REFERENCE_SEED:
        metric_code = item["metric_code"]
        positive_samples, total_units = _load_external_workload_samples(cur, metric_code)
        if not positive_samples:
            positive_samples, total_units = _load_internal_workload_samples(cur, metric_code)

        sample_count = len(positive_samples)
        coverage_ratio = round(sample_count / max(total_units, 1), 4) if total_units else 0.0
        observed_p50 = _percentile(positive_samples, 0.5)
        observed_p75 = _percentile(positive_samples, 0.75)
        availability_status = "available" if sample_count >= 30 else "sparse" if sample_count > 0 else item.get("empty_status", "missing")
        calibrated_reference_value = observed_p75 if observed_p75 is not None else item["default_reference_value"]

        cur.execute(
            """
            INSERT INTO analysis_workload_reference (
                metric_code, metric_name_th, service_function, rate_unit,
                default_reference_value, calibrated_reference_value,
                observed_p50, observed_p75, sample_count, coverage_ratio,
                availability_status, mapped_professions_json,
                source_strategy, source_detail_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                metric_code,
                item["metric_name_th"],
                item["service_function"],
                item["rate_unit"],
                item["default_reference_value"],
                calibrated_reference_value,
                observed_p50,
                observed_p75,
                sample_count,
                coverage_ratio,
                availability_status,
                item["mapped_professions_json"],
                item.get("source_strategy"),
                item.get("source_detail_json"),
            ),
        )


def build_analysis_governance_schema(db_path: str | None = None):
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS analysis_benchmark_reference (
            benchmark_key TEXT PRIMARY KEY,
            benchmark_domain TEXT NOT NULL,
            subject_code TEXT NOT NULL,
            subject_name_th TEXT,
            scope_type TEXT,
            rate_per REAL,
            target_value REAL,
            reference_value REAL,
            default_weight_pct REAL,
            fte_per_headcount REAL DEFAULT 1,
            pressure_fte_factor REAL,
            benchmark_source TEXT,
            evidence_level TEXT,
            notes TEXT,
            is_active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_indicator_policy (
            indicator_code TEXT PRIMARY KEY,
            policy_domain TEXT,
            policy_name_th TEXT,
            include_in_phase1 INTEGER DEFAULT 1,
            include_in_outcome_validation INTEGER DEFAULT 1,
            include_in_recommendation INTEGER DEFAULT 1,
            attribution_scope TEXT,
            private_sector_bias_flag INTEGER DEFAULT 0,
            policy_note TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_analysis_benchmark_domain
        ON analysis_benchmark_reference(benchmark_domain, subject_code, is_active);
        CREATE INDEX IF NOT EXISTS idx_analysis_indicator_policy_phase1
        ON analysis_indicator_policy(include_in_phase1, include_in_outcome_validation, include_in_recommendation);

        CREATE TABLE IF NOT EXISTS analysis_workload_reference (
            metric_code TEXT PRIMARY KEY,
            metric_name_th TEXT,
            service_function TEXT,
            rate_unit TEXT,
            default_reference_value REAL,
            calibrated_reference_value REAL,
            observed_p50 REAL,
            observed_p75 REAL,
            sample_count INTEGER DEFAULT 0,
            coverage_ratio REAL DEFAULT 0,
            availability_status TEXT DEFAULT 'missing',
            mapped_professions_json TEXT,
            source_strategy TEXT,
            source_detail_json TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_run_history (
            run_id TEXT PRIMARY KEY,
            hospital_name TEXT,
            province_code TEXT,
            unit_name TEXT,
            engine_version TEXT,
            scope_type TEXT,
            scope_name TEXT,
            denominator_method TEXT,
            denominator_population_total REAL,
            persisted_from_step TEXT,
            request_json TEXT,
            result_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_analysis_run_history_hospital
        ON analysis_run_history(hospital_name, created_at DESC);
        """
    )
    if not _column_exists(cur, "analysis_workload_reference", "source_strategy"):
        cur.execute("ALTER TABLE analysis_workload_reference ADD COLUMN source_strategy TEXT")
    if not _column_exists(cur, "analysis_workload_reference", "source_detail_json"):
        cur.execute("ALTER TABLE analysis_workload_reference ADD COLUMN source_detail_json TEXT")
    cur.execute("DELETE FROM analysis_benchmark_reference")
    for item in BENCHMARK_SEED:
        cur.execute(
            """
            INSERT INTO analysis_benchmark_reference (
                benchmark_key, benchmark_domain, subject_code, subject_name_th, scope_type,
                rate_per, target_value, reference_value, default_weight_pct, fte_per_headcount,
                pressure_fte_factor, benchmark_source, evidence_level, notes, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            """,
            (
                item["benchmark_key"],
                item["benchmark_domain"],
                item["subject_code"],
                item.get("subject_name_th"),
                item.get("scope_type"),
                item.get("rate_per"),
                item.get("target_value"),
                item.get("reference_value"),
                item.get("default_weight_pct"),
                item.get("fte_per_headcount", 1.0),
                item.get("pressure_fte_factor"),
                item.get("benchmark_source"),
                item.get("evidence_level"),
                item.get("notes"),
            ),
        )
    cur.execute("DELETE FROM analysis_indicator_policy")
    for item in INDICATOR_POLICY_SEED:
        cur.execute(
            """
            INSERT INTO analysis_indicator_policy (
                indicator_code, policy_domain, policy_name_th, include_in_phase1,
                include_in_outcome_validation, include_in_recommendation, attribution_scope,
                private_sector_bias_flag, policy_note, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                item["indicator_code"],
                item.get("policy_domain"),
                item.get("policy_name_th"),
                item.get("include_in_phase1", 1),
                item.get("include_in_outcome_validation", 1),
                item.get("include_in_recommendation", 1),
                item.get("attribution_scope"),
                item.get("private_sector_bias_flag", 0),
                item.get("policy_note"),
            ),
        )
    _rebuild_workload_reference(cur)
    conn.commit()
    conn.close()
    try:
        from workload_source_store import build_workload_source_schema

        build_workload_source_schema(db_path)
    except Exception:
        pass


def list_analysis_benchmarks(domain: str | None = None, db_path: str | None = None) -> list[dict]:
    build_analysis_governance_schema(db_path)
    conn = get_connection(db_path)
    if domain:
        rows = conn.execute(
            """
            SELECT * FROM analysis_benchmark_reference
            WHERE benchmark_domain = ? AND is_active = 1
            ORDER BY benchmark_domain, subject_code
            """,
            (domain,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM analysis_benchmark_reference
            WHERE is_active = 1
            ORDER BY benchmark_domain, subject_code
            """
        ).fetchall()
    conn.close()
    return [_row_to_dict(row) for row in rows]


def get_benchmark_lookup(domain: str, db_path: str | None = None) -> dict[str, dict]:
    return {item["subject_code"]: item for item in list_analysis_benchmarks(domain=domain, db_path=db_path)}


def list_workload_references(db_path: str | None = None) -> list[dict]:
    build_analysis_governance_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT * FROM analysis_workload_reference
        ORDER BY service_function, metric_code
        """
    ).fetchall()
    conn.close()
    payload = []
    for row in rows:
        item = _row_to_dict(row)
        item["mapped_professions"] = json.loads(item.get("mapped_professions_json") or "[]")
        item["source_detail"] = json.loads(item.get("source_detail_json") or "{}")
        payload.append(item)
    return payload


def get_workload_reference_lookup(db_path: str | None = None) -> dict[str, dict]:
    return {item["metric_code"]: item for item in list_workload_references(db_path=db_path)}


def list_indicator_policies(db_path: str | None = None) -> list[dict]:
    build_analysis_governance_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT * FROM analysis_indicator_policy
        ORDER BY include_in_phase1 DESC, policy_domain, policy_name_th
        """
    ).fetchall()
    conn.close()
    return [_row_to_dict(row) for row in rows]


def get_indicator_policy_lookup(db_path: str | None = None) -> dict[str, dict]:
    return {item["indicator_code"]: item for item in list_indicator_policies(db_path=db_path)}


def create_analysis_run_history(
    *,
    hospital_name: str | None,
    province_code: str | None,
    unit_name: str | None,
    engine_version: str | None,
    scope_type: str | None,
    scope_name: str | None,
    denominator_method: str | None,
    denominator_population_total: float | None,
    persisted_from_step: str | None,
    request_payload: dict,
    result_payload: dict,
    db_path: str | None = None,
) -> dict:
    build_analysis_governance_schema(db_path)
    conn = get_connection(db_path)
    request_json = json.dumps(request_payload, ensure_ascii=False)
    result_json = json.dumps(result_payload, ensure_ascii=False)
    latest_row = conn.execute(
        """
        SELECT * FROM analysis_run_history
        WHERE hospital_name = ?
          AND COALESCE(persisted_from_step, '') = COALESCE(?, '')
          AND request_json = ?
          AND result_json = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (hospital_name, persisted_from_step, request_json, result_json),
    ).fetchone()
    if latest_row:
        latest_payload = _row_to_dict(latest_row)
        if latest_payload.get("request_json") == request_json and latest_payload.get("result_json") == result_json:
            conn.close()
            latest_payload["request_json"] = json.loads(latest_payload.get("request_json") or "{}")
            latest_payload["result_json"] = json.loads(latest_payload.get("result_json") or "{}")
            return latest_payload
    run_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO analysis_run_history (
            run_id, hospital_name, province_code, unit_name, engine_version,
            scope_type, scope_name, denominator_method, denominator_population_total,
            persisted_from_step, request_json, result_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (
            run_id,
            hospital_name,
            province_code,
            unit_name,
            engine_version,
            scope_type,
            scope_name,
            denominator_method,
            denominator_population_total,
            persisted_from_step,
            request_json,
            result_json,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM analysis_run_history WHERE run_id = ?", (run_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


def list_analysis_run_history(
    hospital_name: str | None = None,
    limit: int = 20,
    db_path: str | None = None,
) -> list[dict]:
    build_analysis_governance_schema(db_path)
    conn = get_connection(db_path)
    if hospital_name:
        rows = conn.execute(
            """
            SELECT * FROM analysis_run_history
            WHERE hospital_name = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (hospital_name, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT * FROM analysis_run_history
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    conn.close()
    payload = []
    for row in rows:
        item = _row_to_dict(row)
        item["request_json"] = json.loads(item.get("request_json") or "{}")
        item["result_json"] = json.loads(item.get("result_json") or "{}")
        payload.append(item)
    return payload


def get_phase1_indicator_count(db_path: str | None = None) -> int:
    return sum(1 for item in list_indicator_policies(db_path=db_path) if int(item.get("include_in_phase1") or 0) == 1)


def _current_be_year() -> int:
    return datetime.now().year + 543


def _score_to_level(score: float) -> str:
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    return "provisional"


def compute_pp_confidence_summary(
    *,
    scope_population_source: str | None,
    reference_year: int | None,
    scope_type: str | None,
    observed_indicator_count: int,
    expected_indicator_count: int,
    audit_available: bool,
) -> dict:
    source = (scope_population_source or "").strip().lower()
    source_score = 10
    source_label = "proxy/unknown"
    if "hdc" in source:
        source_score = 30
        source_label = "HDC verified"
    elif "dopa" in source:
        source_score = 25
        source_label = "DOPA verified"

    current_be = _current_be_year()
    if reference_year is None:
        year_score = 8
        year_note = "unknown year"
    else:
        delta = max(0, current_be - int(reference_year))
        if delta == 0:
            year_score = 25
        elif delta == 1:
            year_score = 20
        elif delta == 2:
            year_score = 15
        else:
            year_score = 10
        year_note = f"year delta {delta}"

    scope_score = 20 if (scope_type or "").strip().lower() == "amphur" else 8
    completeness_ratio = min(1.0, observed_indicator_count / max(expected_indicator_count, 1))
    completeness_score = round(completeness_ratio * 15, 2)
    audit_score = 10 if audit_available else 0
    total = round(source_score + year_score + scope_score + completeness_score + audit_score, 2)
    return {
        "score": total,
        "level": _score_to_level(total),
        "factors": {
            "source_score": source_score,
            "source_label": source_label,
            "year_score": year_score,
            "year_note": year_note,
            "scope_score": scope_score,
            "scope_type": scope_type,
            "completeness_score": completeness_score,
            "observed_indicator_count": observed_indicator_count,
            "expected_indicator_count": expected_indicator_count,
            "audit_score": audit_score,
        },
    }


def compute_hr_confidence_summary(*, unit_matched: bool, audit_available: bool) -> dict:
    source_score = 40
    scope_score = 25 if unit_matched else 10
    dictionary_score = 20
    audit_score = 15 if audit_available else 0
    year_score = 10
    total = round(source_score + scope_score + dictionary_score + audit_score + year_score, 2)
    return {
        "score": total,
        "level": _score_to_level(total),
        "factors": {
            "source_score": source_score,
            "scope_score": scope_score,
            "dictionary_score": dictionary_score,
            "audit_score": audit_score,
            "year_score": year_score,
            "year_note": "HR data year not explicitly versioned in current schema",
        },
    }


def get_analysis_config(db_path: str | None = None) -> dict:
    build_analysis_governance_schema(db_path)
    return {
        "benchmarks": {
            "hni_component": get_benchmark_lookup("hni_component", db_path=db_path),
            "clinical_profession": get_benchmark_lookup("clinical_profession", db_path=db_path),
            "pp_profession": get_benchmark_lookup("pp_profession", db_path=db_path),
        },
        "workload_references": get_workload_reference_lookup(db_path=db_path),
        "indicator_policies": get_indicator_policy_lookup(db_path=db_path),
        "phase1_indicator_count": get_phase1_indicator_count(db_path=db_path),
    }
