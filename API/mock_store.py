import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(__file__)
MOCK_DB_PATH = os.path.join(BASE_DIR, "data", "mock_scenarios.db")


CATALOG_SEED = [
    {
        "indicator_code": "population_total",
        "indicator_name": "Population Total",
        "domain": "profile",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 1,
        "sort_order": 10,
        "description": "Population under hospital responsibility",
    },
    {
        "indicator_code": "population_male",
        "indicator_name": "Population Male",
        "domain": "profile",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 20,
        "description": "Male population",
    },
    {
        "indicator_code": "population_female",
        "indicator_name": "Population Female",
        "domain": "profile",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 30,
        "description": "Female population",
    },
    {
        "indicator_code": "elderly_pct",
        "indicator_name": "Elderly Population 60+",
        "domain": "need",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": None,
        "is_required": 1,
        "sort_order": 40,
        "description": "Percent population aged 60 and above",
    },
    {
        "indicator_code": "prevalence_cvd",
        "indicator_name": "CVD Prevalence",
        "domain": "need",
        "value_type": "number",
        "unit": "per_100k",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 50,
        "description": "Cardiovascular prevalence rate",
    },
    {
        "indicator_code": "prevalence_cancer",
        "indicator_name": "Cancer Prevalence",
        "domain": "need",
        "value_type": "number",
        "unit": "per_100k",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 60,
        "description": "Cancer prevalence rate",
    },
    {
        "indicator_code": "prevalence_dm",
        "indicator_name": "Diabetes Prevalence",
        "domain": "need",
        "value_type": "number",
        "unit": "per_100k",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 70,
        "description": "Diabetes prevalence rate",
    },
    {
        "indicator_code": "prevalence_ckd",
        "indicator_name": "CKD Prevalence",
        "domain": "need",
        "value_type": "number",
        "unit": "per_100k",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 80,
        "description": "Chronic kidney disease prevalence rate",
    },
    {
        "indicator_code": "mental_risk_rate",
        "indicator_name": "Mental Health Risk Rate",
        "domain": "need",
        "value_type": "number",
        "unit": "per_100k",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 90,
        "description": "Mental health risk rate",
    },
    {
        "indicator_code": "weight_elderly",
        "indicator_name": "HNI Weight Elderly",
        "domain": "need_weight",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 100,
        "description": "Weight for elderly axis",
    },
    {
        "indicator_code": "weight_chronic",
        "indicator_name": "HNI Weight Chronic",
        "domain": "need_weight",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 110,
        "description": "Weight for chronic disease axis",
    },
    {
        "indicator_code": "weight_mental",
        "indicator_name": "HNI Weight Mental",
        "domain": "need_weight",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 120,
        "description": "Weight for mental health axis",
    },
    {
        "indicator_code": "doctor_total",
        "indicator_name": "Doctor Headcount",
        "domain": "capacity",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 125,
        "description": "Total doctors",
    },
    {
        "indicator_code": "nurse_total",
        "indicator_name": "Nurse Headcount",
        "domain": "capacity",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 126,
        "description": "Total nurses",
    },
    {
        "indicator_code": "pharmacist_total",
        "indicator_name": "Pharmacist Headcount",
        "domain": "capacity",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 127,
        "description": "Total pharmacists",
    },
    {
        "indicator_code": "physical_therapist_total",
        "indicator_name": "Physical Therapist Headcount",
        "domain": "capacity_profession",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 128,
        "description": "Total physical therapists for rehab / disability burden response",
    },
    {
        "indicator_code": "psychologist_total",
        "indicator_name": "Psychologist Headcount",
        "domain": "capacity_profession",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 129,
        "description": "Total psychologists for mental health need and DALY response",
    },
    {
        "indicator_code": "clinical_psychologist_total",
        "indicator_name": "Clinical Psychologist Headcount",
        "domain": "capacity_profession",
        "value_type": "number",
        "unit": "people",
        "threshold_rule": None,
        "is_required": 0,
        "sort_order": 130,
        "description": "Total clinical psychologists for mental health outcome response",
    },
    {
        "indicator_code": "G01",
        "indicator_name": "Percent AdjRW Zero",
        "domain": "data_quality",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 1",
        "is_required": 0,
        "sort_order": 130,
        "description": "Data quality gate G01",
    },
    {
        "indicator_code": "G02",
        "indicator_name": "Percent Pdx Ill-defined",
        "domain": "data_quality",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 5",
        "is_required": 0,
        "sort_order": 140,
        "description": "Data quality gate G02",
    },
    {
        "indicator_code": "G03",
        "indicator_name": "Percent Pdx Ill-defined Death",
        "domain": "data_quality",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 10",
        "is_required": 0,
        "sort_order": 150,
        "description": "Data quality gate G03",
    },
    {
        "indicator_code": "G04",
        "indicator_name": "Percent Low Quality ICD",
        "domain": "data_quality",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 5",
        "is_required": 0,
        "sort_order": 160,
        "description": "Data quality gate G04",
    },
    {
        "indicator_code": "A01",
        "indicator_name": "Crude Death Rate",
        "domain": "outcome",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 3.5",
        "is_required": 0,
        "sort_order": 170,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "A04",
        "indicator_name": "AMI Mortality",
        "domain": "outcome",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 8",
        "is_required": 0,
        "sort_order": 171,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "A09",
        "indicator_name": "Sepsis Mortality",
        "domain": "outcome",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 20",
        "is_required": 0,
        "sort_order": 172,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "B01",
        "indicator_name": "Maternal Mortality",
        "domain": "outcome",
        "value_type": "number",
        "unit": "/100k",
        "threshold_rule": "< 70",
        "is_required": 0,
        "sort_order": 173,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "C02",
        "indicator_name": "CMI",
        "domain": "outcome",
        "value_type": "number",
        "unit": "AdjRW",
        "threshold_rule": "> 1.5",
        "is_required": 0,
        "sort_order": 180,
        "description": "Case mix index",
    },
    {
        "indicator_code": "D01",
        "indicator_name": "Bed Occupancy Rate",
        "domain": "outcome",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "80-85",
        "is_required": 0,
        "sort_order": 181,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "F10",
        "indicator_name": "Referral Leakage to Tertiary",
        "domain": "outcome",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 15",
        "is_required": 0,
        "sort_order": 182,
        "description": "Performance outcome",
    },
    {
        "indicator_code": "DH0101",
        "indicator_name": "STEMI Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 12",
        "is_required": 0,
        "sort_order": 190,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "DN0101",
        "indicator_name": "Stroke Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 15",
        "is_required": 0,
        "sort_order": 200,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "DN0142D",
        "indicator_name": "Ischemic Stroke Death with rtPA",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 1",
        "is_required": 0,
        "sort_order": 210,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "CI0101",
        "indicator_name": "Sepsis Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 20",
        "is_required": 0,
        "sort_order": 220,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "PE0102",
        "indicator_name": "Child Pneumonia Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 3",
        "is_required": 0,
        "sort_order": 230,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "CM0203",
        "indicator_name": "Neonatal Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "/1000",
        "threshold_rule": "< 10",
        "is_required": 0,
        "sort_order": 240,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "CM0101",
        "indicator_name": "Maternal Mortality Service Plan",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "/100k",
        "threshold_rule": "< 70",
        "is_required": 0,
        "sort_order": 250,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "DC0401",
        "indicator_name": "Cancer Mortality",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 15",
        "is_required": 0,
        "sort_order": 260,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "DG0201",
        "indicator_name": "Perforated Appendicitis",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "< 30",
        "is_required": 0,
        "sort_order": 270,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "PS0001",
        "indicator_name": "Suicide Rate",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "/100k",
        "threshold_rule": "< 5",
        "is_required": 0,
        "sort_order": 280,
        "description": "Service plan indicator",
    },
    {
        "indicator_code": "RH0101",
        "indicator_name": "Stroke Rehab Access",
        "domain": "service_plan",
        "value_type": "number",
        "unit": "%",
        "threshold_rule": "> 50",
        "is_required": 0,
        "sort_order": 290,
        "description": "Service plan indicator",
    },
]

SPECIALTY_CAPACITY_CONFIG = [
    ("DH0101", "Interventional Cardio", "CCU / Cath Lab Nurse"),
    ("DH0102", "Cardiologist", "CCU Nurse"),
    ("DN0101", "Neurologist", "Stroke Nurse"),
    ("DN0142D", "Neurologist + ER", "ER / Stroke Fast Track Nurse"),
    ("CI0101", "ID / Internal Medicine", "ICU Nurse"),
    ("PE0102", "Pediatric Pulmonologist", "PICU Nurse"),
    ("CM0203", "Neonatologist", "NICU Nurse"),
    ("CM0101", "OB-GYN", "Labor Nurse"),
    ("DC0401", "Oncologist", "Chemo Nurse"),
    ("DG0201", "General Surgeon", "ER / OR Nurse"),
    ("PS0001", "Psychiatrist", "Psych Nurse"),
    ("RH0101", "Rehab Physician", "Rehab / Stroke Ward Nurse"),
]

PROFESSION_SUPPORT_CONFIG = [
    ("RH0101", "pt", "Physical Therapist Stroke Rehab"),
    ("PS0001", "psychologist", "Psychologist Suicide / Depression Clinic"),
    ("PS0001", "clinical_psychologist", "Clinical Psychologist Crisis Intervention"),
]


def build_specialty_capacity_seed():
    seed = []
    base_sort = 600
    for index, (service_code, doctor_label, nurse_label) in enumerate(SPECIALTY_CAPACITY_CONFIG):
        offset = index * 10
        seed.extend(
            [
                {
                    "indicator_code": f"{service_code}_doc_headcount",
                    "indicator_name": f"{service_code} Doctor Headcount",
                    "domain": "capacity_specialty",
                    "value_type": "number",
                    "unit": "people",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 1,
                    "description": f"Current specialty doctor capacity: {doctor_label}",
                },
                {
                    "indicator_code": f"{service_code}_nurse_headcount",
                    "indicator_name": f"{service_code} Nurse Headcount",
                    "domain": "capacity_specialty",
                    "value_type": "number",
                    "unit": "people",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 2,
                    "description": f"Current specialty nurse capacity: {nurse_label}",
                },
                {
                    "indicator_code": f"{service_code}_fte_factor",
                    "indicator_name": f"{service_code} FTE Factor",
                    "domain": "capacity_factor",
                    "value_type": "number",
                    "unit": "ratio",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 3,
                    "description": "FTE factor by specialty team",
                },
                {
                    "indicator_code": f"{service_code}_coverage_pct",
                    "indicator_name": f"{service_code} Coverage 24x7",
                    "domain": "capacity_factor",
                    "value_type": "number",
                    "unit": "%",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 4,
                    "description": "Shift/coverage completeness for specialty team",
                },
            ]
        )
    return seed


def build_profession_support_seed():
    seed = []
    base_sort = 760
    for index, (service_code, role_code, role_label) in enumerate(PROFESSION_SUPPORT_CONFIG):
        offset = index * 10
        seed.extend(
            [
                {
                    "indicator_code": f"{service_code}_{role_code}_headcount",
                    "indicator_name": f"{service_code} {role_label} Headcount",
                    "domain": "capacity_support_profession",
                    "value_type": "number",
                    "unit": "people",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 1,
                    "description": f"Current support profession headcount: {role_label}",
                },
                {
                    "indicator_code": f"{service_code}_{role_code}_fte_factor",
                    "indicator_name": f"{service_code} {role_label} FTE Factor",
                    "domain": "capacity_support_profession",
                    "value_type": "number",
                    "unit": "ratio",
                    "threshold_rule": None,
                    "is_required": 0,
                    "sort_order": base_sort + offset + 2,
                    "description": f"Current support profession FTE factor: {role_label}",
                },
            ]
        )
    return seed


CATALOG_SEED.extend(build_specialty_capacity_seed())
CATALOG_SEED.extend(build_profession_support_seed())


def utcnow_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def dict_from_row(row):
    return dict(row) if row is not None else None


def build_db():
    os.makedirs(os.path.dirname(MOCK_DB_PATH), exist_ok=True)
    with sqlite3.connect(MOCK_DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS mock_hospital (
                mock_hospital_id TEXT PRIMARY KEY,
                hospital_name TEXT NOT NULL,
                province_ref TEXT,
                hospital_level TEXT,
                note TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mock_scenario (
                scenario_id TEXT PRIMARY KEY,
                mock_hospital_id TEXT NOT NULL,
                scenario_name TEXT NOT NULL,
                based_on_unit_id TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                version_no INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (mock_hospital_id) REFERENCES mock_hospital(mock_hospital_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mock_indicator_catalog (
                indicator_code TEXT PRIMARY KEY,
                indicator_name TEXT NOT NULL,
                domain TEXT NOT NULL,
                value_type TEXT NOT NULL,
                unit TEXT,
                threshold_rule TEXT,
                is_required INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS mock_input_value (
                input_value_id INTEGER PRIMARY KEY AUTOINCREMENT,
                scenario_id TEXT NOT NULL,
                indicator_code TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                value_num REAL,
                value_text TEXT,
                value_json TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (scenario_id) REFERENCES mock_scenario(scenario_id) ON DELETE CASCADE,
                UNIQUE (scenario_id, indicator_code, scope)
            );

            CREATE TABLE IF NOT EXISTS mock_run_result (
                run_result_id TEXT PRIMARY KEY,
                scenario_id TEXT NOT NULL,
                run_no INTEGER NOT NULL,
                hni_score REAL,
                wci_score REAL,
                gap_score REAL,
                dq_pass INTEGER,
                confidence_level TEXT,
                engine_version TEXT,
                summary_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (scenario_id) REFERENCES mock_scenario(scenario_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mock_run_result_detail (
                run_result_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_result_id TEXT NOT NULL,
                indicator_code TEXT,
                observed_value REAL,
                status TEXT,
                suggested_doc_add INTEGER,
                suggested_nurse_add INTEGER,
                process_note TEXT,
                detail_json TEXT,
                FOREIGN KEY (run_result_id) REFERENCES mock_run_result(run_result_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mock_audit_log (
                audit_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                payload_json TEXT,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.executemany(
            """
            INSERT INTO mock_indicator_catalog (
                indicator_code, indicator_name, domain, value_type, unit,
                threshold_rule, is_required, sort_order, description
            ) VALUES (
                :indicator_code, :indicator_name, :domain, :value_type, :unit,
                :threshold_rule, :is_required, :sort_order, :description
            )
            ON CONFLICT(indicator_code) DO UPDATE SET
                indicator_name = excluded.indicator_name,
                domain = excluded.domain,
                value_type = excluded.value_type,
                unit = excluded.unit,
                threshold_rule = excluded.threshold_rule,
                is_required = excluded.is_required,
                sort_order = excluded.sort_order,
                description = excluded.description
            """,
            CATALOG_SEED,
        )
        conn.commit()


@contextmanager
def get_conn():
    build_db()
    conn = sqlite3.connect(MOCK_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def write_audit(conn, entity_type, entity_id, action, payload):
    conn.execute(
        """
        INSERT INTO mock_audit_log (entity_type, entity_id, action, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (entity_type, entity_id, action, json.dumps(payload, ensure_ascii=False), utcnow_iso()),
    )


def list_mock_hospitals():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                h.*,
                COUNT(DISTINCT s.scenario_id) AS scenario_count
            FROM mock_hospital h
            LEFT JOIN mock_scenario s ON s.mock_hospital_id = h.mock_hospital_id
            GROUP BY h.mock_hospital_id
            ORDER BY h.updated_at DESC
            """
        ).fetchall()
    return [dict_from_row(row) for row in rows]


def create_mock_hospital(payload):
    now = utcnow_iso()
    mock_hospital_id = str(uuid.uuid4())
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO mock_hospital (
                mock_hospital_id, hospital_name, province_ref, hospital_level, note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mock_hospital_id,
                payload["hospital_name"],
                payload.get("province_ref"),
                payload.get("hospital_level"),
                payload.get("note"),
                now,
                now,
            ),
        )
        write_audit(conn, "mock_hospital", mock_hospital_id, "create", payload)
        row = conn.execute(
            "SELECT * FROM mock_hospital WHERE mock_hospital_id = ?",
            (mock_hospital_id,),
        ).fetchone()
    return dict_from_row(row)


def get_mock_hospital(mock_hospital_id):
    with get_conn() as conn:
        hospital = conn.execute(
            "SELECT * FROM mock_hospital WHERE mock_hospital_id = ?",
            (mock_hospital_id,),
        ).fetchone()
        if hospital is None:
            return None
        scenarios = conn.execute(
            """
            SELECT * FROM mock_scenario
            WHERE mock_hospital_id = ?
            ORDER BY updated_at DESC
            """,
            (mock_hospital_id,),
        ).fetchall()
    result = dict_from_row(hospital)
    result["scenarios"] = [dict_from_row(row) for row in scenarios]
    return result


def create_mock_scenario(mock_hospital_id, payload):
    now = utcnow_iso()
    scenario_id = str(uuid.uuid4())
    with get_conn() as conn:
        hospital = conn.execute(
            "SELECT mock_hospital_id FROM mock_hospital WHERE mock_hospital_id = ?",
            (mock_hospital_id,),
        ).fetchone()
        if hospital is None:
            return None
        current_version = conn.execute(
            "SELECT COALESCE(MAX(version_no), 0) AS max_version FROM mock_scenario WHERE mock_hospital_id = ?",
            (mock_hospital_id,),
        ).fetchone()["max_version"]
        version_no = int(current_version) + 1
        conn.execute(
            """
            INSERT INTO mock_scenario (
                scenario_id, mock_hospital_id, scenario_name, based_on_unit_id, status,
                version_no, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                scenario_id,
                mock_hospital_id,
                payload["scenario_name"],
                payload.get("based_on_unit_id"),
                payload.get("status", "draft"),
                version_no,
                now,
                now,
            ),
        )
        conn.execute(
            "UPDATE mock_hospital SET updated_at = ? WHERE mock_hospital_id = ?",
            (now, mock_hospital_id),
        )
        write_audit(conn, "mock_scenario", scenario_id, "create", payload)
        row = conn.execute(
            "SELECT * FROM mock_scenario WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
    return dict_from_row(row)


def get_mock_scenario(scenario_id):
    with get_conn() as conn:
        scenario = conn.execute(
            """
            SELECT
                s.*,
                h.hospital_name,
                h.province_ref,
                h.hospital_level
            FROM mock_scenario s
            JOIN mock_hospital h ON h.mock_hospital_id = s.mock_hospital_id
            WHERE s.scenario_id = ?
            """,
            (scenario_id,),
        ).fetchone()
        if scenario is None:
            return None
        inputs = conn.execute(
            """
            SELECT
                iv.scenario_id,
                iv.indicator_code,
                iv.scope,
                iv.value_num,
                iv.value_text,
                iv.value_json,
                iv.updated_at,
                c.indicator_name,
                c.domain,
                c.value_type,
                c.unit,
                c.threshold_rule
            FROM mock_input_value iv
            LEFT JOIN mock_indicator_catalog c ON c.indicator_code = iv.indicator_code
            WHERE iv.scenario_id = ?
            ORDER BY COALESCE(c.sort_order, 999999), iv.indicator_code, iv.scope
            """,
            (scenario_id,),
        ).fetchall()
        runs = conn.execute(
            """
            SELECT * FROM mock_run_result
            WHERE scenario_id = ?
            ORDER BY run_no DESC, created_at DESC
            """,
            (scenario_id,),
        ).fetchall()
    result = dict_from_row(scenario)
    result["inputs"] = [dict_from_row(row) for row in inputs]
    result["runs"] = [dict_from_row(row) for row in runs]
    return result


def list_catalog():
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM mock_indicator_catalog
            ORDER BY domain, sort_order, indicator_code
            """
        ).fetchall()
    return [dict_from_row(row) for row in rows]


def upsert_input_values(scenario_id, values):
    now = utcnow_iso()
    with get_conn() as conn:
        scenario = conn.execute(
            "SELECT scenario_id, mock_hospital_id FROM mock_scenario WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
        if scenario is None:
            return None
        for item in values:
            scope = item.get("scope") or "global"
            indicator_code = item["indicator_code"]
            value_num = item.get("value_num")
            value_text = item.get("value_text")
            value_json = item.get("value_json")
            if value_json is not None and not isinstance(value_json, str):
                value_json = json.dumps(value_json, ensure_ascii=False)
            conn.execute(
                """
                INSERT INTO mock_input_value (
                    scenario_id, indicator_code, scope, value_num, value_text, value_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(scenario_id, indicator_code, scope) DO UPDATE SET
                    value_num = excluded.value_num,
                    value_text = excluded.value_text,
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """,
                (scenario_id, indicator_code, scope, value_num, value_text, value_json, now),
            )
        conn.execute(
            "UPDATE mock_scenario SET updated_at = ? WHERE scenario_id = ?",
            (now, scenario_id),
        )
        conn.execute(
            "UPDATE mock_hospital SET updated_at = ? WHERE mock_hospital_id = ?",
            (now, scenario["mock_hospital_id"]),
        )
        write_audit(conn, "mock_input_value", scenario_id, "bulk_upsert", {"count": len(values)})
    return get_mock_scenario(scenario_id)


def create_run_result(scenario_id, payload):
    now = utcnow_iso()
    run_result_id = str(uuid.uuid4())
    details = payload.get("details", [])
    with get_conn() as conn:
        scenario = conn.execute(
            "SELECT scenario_id FROM mock_scenario WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()
        if scenario is None:
            return None
        next_run_no = conn.execute(
            "SELECT COALESCE(MAX(run_no), 0) + 1 AS next_run_no FROM mock_run_result WHERE scenario_id = ?",
            (scenario_id,),
        ).fetchone()["next_run_no"]
        conn.execute(
            """
            INSERT INTO mock_run_result (
                run_result_id, scenario_id, run_no, hni_score, wci_score, gap_score,
                dq_pass, confidence_level, engine_version, summary_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_result_id,
                scenario_id,
                next_run_no,
                payload.get("hni_score"),
                payload.get("wci_score"),
                payload.get("gap_score"),
                payload.get("dq_pass"),
                payload.get("confidence_level"),
                payload.get("engine_version"),
                json.dumps(payload.get("summary_json"), ensure_ascii=False) if payload.get("summary_json") is not None else None,
                now,
            ),
        )
        for detail in details:
            detail_json = detail.get("detail_json")
            if detail_json is not None and not isinstance(detail_json, str):
                detail_json = json.dumps(detail_json, ensure_ascii=False)
            conn.execute(
                """
                INSERT INTO mock_run_result_detail (
                    run_result_id, indicator_code, observed_value, status,
                    suggested_doc_add, suggested_nurse_add, process_note, detail_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_result_id,
                    detail.get("indicator_code"),
                    detail.get("observed_value"),
                    detail.get("status"),
                    detail.get("suggested_doc_add"),
                    detail.get("suggested_nurse_add"),
                    detail.get("process_note"),
                    detail_json,
                ),
            )
        write_audit(conn, "mock_run_result", run_result_id, "create", {"scenario_id": scenario_id, "detail_count": len(details)})
        row = conn.execute(
            "SELECT * FROM mock_run_result WHERE run_result_id = ?",
            (run_result_id,),
        ).fetchone()
    return dict_from_row(row)
