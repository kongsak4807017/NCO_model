from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
import pandas as pd
import os
import json
import sqlite3
import unicodedata

try:
    from analysis_governance_store import (
        build_analysis_governance_schema,
        create_analysis_run_history,
        compute_hr_confidence_summary,
        compute_pp_confidence_summary,
        get_analysis_config,
        get_benchmark_lookup,
        list_analysis_run_history,
        list_analysis_benchmarks,
        list_indicator_policies,
        list_workload_references,
    )
    from workload_source_store import (
        build_workload_source_schema,
        list_workload_source_runs,
        refresh_manual_service_statistics_sources,
        refresh_public_workload_sources,
    )
    from district_baseline_store import (
        build_district_baseline_schema,
        ensure_district_baseline_profiles,
        get_district_baseline_profile,
        list_district_baseline_profiles,
        refresh_district_baseline_profiles,
    )
    from need_fte_engine import compute_clinical_need_fte_preview
    from amphur_population_store import (
        build_amphur_population_schema,
        get_amphur_population,
        list_amphur_population_rows,
        refresh_amphur_population_reference,
    )
    from hdc_population_store import (
        build_hdc_population_schema,
        get_hdc_amphur_population,
        list_hdc_population_rows,
        refresh_hdc_population_reference,
    )
    from hospital_scope_store import build_scope_schema, get_hospital_scope, list_hospital_scopes
    from hr_workforce_dictionary import HR_WORKFORCE_DICTIONARY, render_metric_sql
    from mock_store import (
        build_db,
        create_mock_hospital,
        create_mock_scenario,
        create_run_result,
        get_mock_hospital,
        get_mock_scenario,
        list_catalog,
        list_mock_hospitals,
        upsert_input_values,
    )
    from pp_store import (
        build_pp_schema,
        get_pp_amphur_outcome_summary,
        get_pp_amphur_summary,
        get_pp_capacity_summary,
        get_pp_unit_capacity_summary,
        get_pp_district_summary,
        get_pp_province_summary,
        list_pp_catalog,
        list_pp_crosswalk,
        list_pp_indicator_workforce_map,
        list_pp_shortlist_catalog,
    )
    from pp_workforce_dictionary import PP_WORKFORCE_DICTIONARY
except ImportError:
    from API.analysis_governance_store import (
        build_analysis_governance_schema,
        create_analysis_run_history,
        compute_hr_confidence_summary,
        compute_pp_confidence_summary,
        get_analysis_config,
        get_benchmark_lookup,
        list_analysis_run_history,
        list_analysis_benchmarks,
        list_indicator_policies,
        list_workload_references,
    )
    from API.workload_source_store import (
        build_workload_source_schema,
        list_workload_source_runs,
        refresh_manual_service_statistics_sources,
        refresh_public_workload_sources,
    )
    from API.district_baseline_store import (
        build_district_baseline_schema,
        ensure_district_baseline_profiles,
        get_district_baseline_profile,
        list_district_baseline_profiles,
        refresh_district_baseline_profiles,
    )
    from API.need_fte_engine import compute_clinical_need_fte_preview
    from API.amphur_population_store import (
        build_amphur_population_schema,
        get_amphur_population,
        list_amphur_population_rows,
        refresh_amphur_population_reference,
    )
    from API.hdc_population_store import (
        build_hdc_population_schema,
        get_hdc_amphur_population,
        list_hdc_population_rows,
        refresh_hdc_population_reference,
    )
    from API.hospital_scope_store import build_scope_schema, get_hospital_scope, list_hospital_scopes
    from API.hr_workforce_dictionary import HR_WORKFORCE_DICTIONARY, render_metric_sql
    from API.mock_store import (
        build_db,
        create_mock_hospital,
        create_mock_scenario,
        create_run_result,
        get_mock_hospital,
        get_mock_scenario,
        list_catalog,
        list_mock_hospitals,
        upsert_input_values,
    )
    from API.pp_store import (
        build_pp_schema,
        get_pp_amphur_outcome_summary,
        get_pp_amphur_summary,
        get_pp_capacity_summary,
        get_pp_unit_capacity_summary,
        get_pp_district_summary,
        get_pp_province_summary,
        list_pp_catalog,
        list_pp_crosswalk,
        list_pp_indicator_workforce_map,
        list_pp_shortlist_catalog,
    )
    from API.pp_workforce_dictionary import PP_WORKFORCE_DICTIONARY

app = FastAPI(title="Health Needs vs Workforce API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DATA_PATH = os.path.join(BASE_DIR, "final_dataset_regional.csv")
HR_DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")


def normalize_lookup_key(value: str | None) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


class MockHospitalCreate(BaseModel):
    hospital_name: str = Field(..., min_length=1, max_length=255)
    province_ref: str | None = Field(default=None, max_length=100)
    hospital_level: str | None = Field(default=None, max_length=50)
    note: str | None = None


class MockScenarioCreate(BaseModel):
    scenario_name: str = Field(..., min_length=1, max_length=255)
    based_on_unit_id: str | None = Field(default=None, max_length=100)
    status: str = Field(default="draft", max_length=20)


class MockInputValuePayload(BaseModel):
    indicator_code: str = Field(..., min_length=1, max_length=100)
    scope: str | None = Field(default="global", max_length=100)
    value_num: float | None = None
    value_text: str | None = None
    value_json: dict | list | str | int | float | bool | None = None


class MockInputBulkUpsert(BaseModel):
    values: list[MockInputValuePayload]


class MockRunResultDetailPayload(BaseModel):
    indicator_code: str | None = Field(default=None, max_length=100)
    observed_value: float | None = None
    status: str | None = Field(default=None, max_length=50)
    suggested_doc_add: int | None = None
    suggested_nurse_add: int | None = None
    process_note: str | None = None
    detail_json: dict | list | str | int | float | bool | None = None


class MockRunResultCreate(BaseModel):
    hni_score: float | None = None
    wci_score: float | None = None
    gap_score: float | None = None
    dq_pass: bool | None = None
    confidence_level: str | None = Field(default=None, max_length=20)
    engine_version: str | None = Field(default=None, max_length=50)
    summary_json: dict | list | str | int | float | bool | None = None
    details: list[MockRunResultDetailPayload] = Field(default_factory=list)


class NeedFtePreviewRequest(BaseModel):
    hospital_name: str | None = Field(default=None, max_length=255)
    province_code: str | None = Field(default=None, max_length=10)
    unit_name: str | None = Field(default=None, max_length=255)
    population_total: float = Field(default=0, ge=0)
    elderly_rate_pct: float = Field(default=0, ge=0)
    chronic_rate_pct: float = Field(default=0, ge=0)
    mental_risk_rate_per100k: float = Field(default=0, ge=0)
    weight_elderly: float = Field(default=40, ge=0)
    weight_chronic: float = Field(default=40, ge=0)
    weight_mental: float = Field(default=20, ge=0)
    indicator_values: dict[str, float] = Field(default_factory=dict)
    workforce_counts: dict[str, float] = Field(default_factory=dict)
    clinical_scope_type: str | None = Field(default=None, max_length=50)
    clinical_scope_name: str | None = Field(default=None, max_length=255)
    persist: bool = False
    persisted_from_step: str | None = Field(default=None, max_length=50)


class WorkloadRefreshRequest(BaseModel):
    requested_year_be: int = Field(default=2569, ge=2500, le=2600)
    refresh_manual: bool = False


build_db()
build_pp_schema()
build_amphur_population_schema()
build_hdc_population_schema()
build_scope_schema()
build_analysis_governance_schema()
build_workload_source_schema()
build_district_baseline_schema()
ensure_district_baseline_profiles()


def model_to_dict(model):
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()

def load_data():
    if not os.path.exists(DATA_PATH): return None
    try: return pd.read_csv(DATA_PATH)
    except: return None

@app.get("/api/overview")
def get_overview():
    df = load_data()
    if df is None: return {"error": "Dataset not found"}
    metrics = {
        "total_districts": len(df['facility_id'].dropna().unique()) if "facility_id" in df.columns else 0,
        "avg_hni": float(df["HNI"].mean() if "HNI" in df.columns else 0),
        "avg_wci": float(df["WCI"].mean() if "WCI" in df.columns else 0),
        "critical_districts": int((df["Priority"] > df["Priority"].quantile(0.8)).sum() if "Priority" in df.columns else 0)
    }
    return {"metrics": metrics, "data": json.loads(df.fillna(0).to_json(orient="records"))}

@app.get("/api/ranking")
def get_ranking():
    df = load_data()
    if df is None or "Priority" not in df.columns: return {"error": "Dataset not found"}
    df_sorted = df.sort_values(by="Priority", ascending=False).head(30).fillna(0)
    return {"ranking": json.loads(df_sorted.to_json(orient="records"))}

@app.get("/api/scatter")
def get_scatter():
    df = load_data()
    if df is None: return {"error": "Dataset not found"}
    cols = ["facility_id", "unit_name", "amphur_code", "HNI", "WCI_norm", "Priority", "WCI"]
    scatter_data = df[[c for c in cols if c in df.columns]].dropna()
    return {"scatter": json.loads(scatter_data.to_json(orient="records"))}

@app.get("/api/specialties/{facility_id}")
def get_specialties(facility_id: str):
    spec_path = os.path.join(BASE_DIR, "etl", "fact_specialists.csv")
    if not os.path.exists(spec_path): return {"error": "Specialists data not found"}
    df = pd.read_csv(spec_path)
    df['facility_id'] = df['facility_id'].astype(str)
    res = df[df['facility_id'] == facility_id]
    return {"specialties": res.to_dict(orient="records")}


@app.get("/api/mock/catalog")
def get_mock_catalog():
    return {"catalog": list_catalog()}


@app.get("/api/pp/catalog")
def get_pp_catalog():
    return {"catalog": list_pp_catalog()}


@app.get("/api/pp/shortlist")
def get_pp_shortlist(phase_code: str = "phase1"):
    return {"shortlist": list_pp_shortlist_catalog(phase_code=phase_code)}


@app.get("/api/pp/crosswalk")
def get_pp_crosswalk():
    return {"crosswalk": list_pp_crosswalk()}


@app.get("/api/pp/indicator-workforce-map")
def get_pp_indicator_workforce_crosswalk():
    return {"mappings": list_pp_indicator_workforce_map()}


@app.get("/api/pp/workforce-dictionary")
def get_pp_workforce_dictionary():
    return {"dictionary": PP_WORKFORCE_DICTIONARY}


@app.get("/api/analysis/config")
def get_analysis_config_endpoint():
    return get_analysis_config()


@app.get("/api/analysis/benchmarks")
def get_analysis_benchmarks_endpoint(domain: str | None = None):
    return {"benchmarks": list_analysis_benchmarks(domain=domain)}


@app.get("/api/analysis/workload-references")
def get_workload_references_endpoint():
    return {"workload_references": list_workload_references()}


@app.get("/api/analysis/workload-source-runs")
def get_workload_source_runs_endpoint():
    return {"runs": list_workload_source_runs()}


@app.post("/api/analysis/refresh-workload-sources")
def post_refresh_workload_sources(payload: WorkloadRefreshRequest):
    public_result = refresh_public_workload_sources(requested_year_be=payload.requested_year_be)
    manual_result = refresh_manual_service_statistics_sources() if payload.refresh_manual else None
    build_analysis_governance_schema()
    return {
        "public_result": public_result,
        "manual_result": manual_result,
        "workload_references": list_workload_references(),
    }


@app.get("/api/analysis/indicator-policies")
def get_indicator_policies_endpoint():
    return {"policies": list_indicator_policies()}


@app.post("/api/analysis/need-fte-preview")
def post_need_fte_preview(payload: NeedFtePreviewRequest):
    workforce_counts = dict(payload.workforce_counts or {})
    if (not workforce_counts) and payload.province_code and payload.unit_name:
        hr_summary = get_hr_unit_workforce_summary(payload.province_code, payload.unit_name)
        workforce_counts = dict(hr_summary.get("summary", {}).get("counts") or {})
    result = compute_clinical_need_fte_preview(
        hospital_name=payload.hospital_name,
        province_code=payload.province_code,
        unit_name=payload.unit_name,
        population_total=payload.population_total,
        elderly_rate_pct=payload.elderly_rate_pct,
        chronic_rate_pct=payload.chronic_rate_pct,
        mental_risk_rate_per100k=payload.mental_risk_rate_per100k,
        weight_elderly=payload.weight_elderly,
        weight_chronic=payload.weight_chronic,
        weight_mental=payload.weight_mental,
        indicator_values=payload.indicator_values,
        workforce_counts=workforce_counts,
        clinical_scope_type=payload.clinical_scope_type,
        clinical_scope_name=payload.clinical_scope_name,
    )
    persisted_run = None
    if payload.persist:
        persisted_run = create_analysis_run_history(
            hospital_name=payload.hospital_name,
            province_code=payload.province_code,
            unit_name=payload.unit_name,
            engine_version=result.get("engine_version"),
            scope_type=result.get("clinical_scope_type"),
            scope_name=result.get("clinical_scope_name"),
            denominator_method=(result.get("denominator") or {}).get("denominator_method"),
            denominator_population_total=(result.get("denominator") or {}).get("denominator_population_total"),
            persisted_from_step=payload.persisted_from_step,
            request_payload=model_to_dict(payload),
            result_payload=result,
        )
    return {"preview": result, "persisted_run": persisted_run}


@app.get("/api/analysis/run-history")
def get_analysis_run_history_endpoint(hospital_name: str | None = None, limit: int = 20):
    return {"runs": list_analysis_run_history(hospital_name=hospital_name, limit=limit)}


@app.get("/api/scope/hospital")
def get_hospital_scope_detail(hospital_name: str):
    scope = get_hospital_scope(hospital_name)
    if scope is None:
        raise HTTPException(status_code=404, detail="Hospital scope not found")
    return {"scope": scope}


@app.get("/api/scope/hospitals")
def get_hospital_scope_list():
    return {"scopes": list_hospital_scopes()}


@app.get("/api/reference/amphur-population")
def get_amphur_population_reference(province_code: str | None = None, source: str = "best"):
    normalized_source = (source or "best").strip().lower()
    if normalized_source == "hdc":
        return {"source": "hdc", "rows": list_hdc_population_rows(province_code=province_code)}
    if normalized_source == "dopa":
        return {"source": "dopa", "rows": list_amphur_population_rows(province_code=province_code)}
    hdc_rows = list_hdc_population_rows(province_code=province_code)
    if hdc_rows:
        return {"source": "hdc", "rows": hdc_rows}
    return {"source": "dopa", "rows": list_amphur_population_rows(province_code=province_code)}


@app.post("/api/reference/amphur-population/refresh")
def refresh_amphur_population_reference_endpoint(source: str = "hdc"):
    normalized_source = (source or "hdc").strip().lower()
    if normalized_source == "dopa":
        result = refresh_amphur_population_reference(force_download=True)
    else:
        result = refresh_hdc_population_reference()
    build_scope_schema()
    return {"result": result, "scopes": list_hospital_scopes()}


@app.get("/api/reference/amphur-population-hdc")
def get_hdc_amphur_population_reference(province_code: str | None = None):
    return {"source": "hdc", "rows": list_hdc_population_rows(province_code=province_code)}


@app.get("/api/baseline/district-profiles")
def get_district_baseline_profiles_endpoint(province_code: str | None = None, hospital_level: str | None = None):
    return {
        "profiles": list_district_baseline_profiles(
            province_code=province_code,
            hospital_level=hospital_level,
        )
    }


@app.get("/api/baseline/district-profile")
def get_district_baseline_profile_endpoint(province_code: str, amphur_code: str, hospital_level: str):
    profile = get_district_baseline_profile(
        province_code=province_code,
        amphur_code=amphur_code,
        hospital_level=hospital_level,
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="District baseline profile not found")
    return {"profile": profile}


@app.post("/api/baseline/district-profiles/refresh")
def refresh_district_baseline_profiles_endpoint(province_code: str | None = None):
    result = refresh_district_baseline_profiles(province_code=province_code)
    return {"result": result}


@app.get("/api/pp/province-summary/{province_code}")
def get_pp_summary(province_code: str, year_be: int | None = None, shortlist_only: bool = True):
    return {"summary": get_pp_province_summary(province_code, year_be=year_be, shortlist_only=shortlist_only)}


@app.get("/api/pp/unit-capacity-summary")
def get_pp_unit_capacity(province_code: str, unit_name: str):
    return {"summary": get_pp_unit_capacity_summary(province_code=province_code, unit_name=unit_name)}


@app.get("/api/pp/hospital-summary")
def get_pp_hospital_scope_summary(hospital_name: str, year_be: int | None = None, shortlist_only: bool = True):
    scope = get_hospital_scope(hospital_name)
    if scope is None:
        raise HTTPException(status_code=404, detail="Hospital scope not found")
    summary = get_pp_amphur_summary(
        province_code=scope["province_code"],
        amphur_code=scope["pp_scope_code"],
        amphur_name=scope["pp_scope_name"],
        unit_name=scope["lookup_unit_name"],
        year_be=year_be,
        shortlist_only=shortlist_only,
    )
    summary["scope_population_total"] = scope.get("pp_population_total")
    summary["scope_population_source"] = scope.get("pp_population_source")
    summary["scope_population_reference_year"] = scope.get("pp_population_reference_year")
    summary["confidence"] = compute_pp_confidence_summary(
        scope_population_source=scope.get("pp_population_source"),
        reference_year=scope.get("pp_population_reference_year"),
        scope_type=scope.get("pp_scope_type"),
        observed_indicator_count=int(summary.get("data_status", {}).get("indicator_count") or 0),
        expected_indicator_count=int(summary.get("data_status", {}).get("expected_indicator_count") or 0),
        audit_available=bool(summary.get("audit_trail")),
    )
    summary["scope"] = {
        "pp_scope_type": scope.get("pp_scope_type"),
        "pp_scope_code": scope.get("pp_scope_code"),
        "pp_scope_name": scope.get("pp_scope_name"),
        "clinical_scope_type": scope.get("clinical_scope_type"),
        "clinical_scope_code": scope.get("clinical_scope_code"),
        "clinical_scope_name": scope.get("clinical_scope_name"),
        "clinical_scope_note": scope.get("clinical_scope_note"),
    }
    return {
        "summary": summary,
        "scope": scope,
    }


@app.get("/api/pp/district-summary/{province_code}")
def get_pp_districts(province_code: str, year_be: int | None = None, shortlist_only: bool = True):
    return {"districts": get_pp_district_summary(province_code, year_be=year_be, shortlist_only=shortlist_only)}


@app.get("/api/pp/amphur-outcome-summary")
def get_pp_amphur_outcomes(province_code: str, amphur_code: str, year_be: int | None = None, shortlist_only: bool = True):
    return {
        "outcomes": get_pp_amphur_outcome_summary(
            province_code=province_code,
            amphur_code=amphur_code,
            year_be=year_be,
            shortlist_only=shortlist_only,
        )
    }


@app.get("/api/hr/workforce-dictionary")
def get_hr_workforce_dictionary():
    return {"dictionary": HR_WORKFORCE_DICTIONARY}


@app.get("/api/hr/unit-workforce-summary")
def get_hr_unit_workforce_summary(province_code: str, unit_name: str):
    conn = sqlite3.connect(HR_DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    candidate_rows = cur.execute(
        """
        SELECT unit_id, unit_name, province_code, unit_type_label
        FROM organizational_unit
        WHERE province_code = ?
        ORDER BY unit_name
        """,
        (province_code,),
    ).fetchall()
    lookup_unit_name = normalize_lookup_key(unit_name)
    unit_row = next(
        (row for row in candidate_rows if normalize_lookup_key(row["unit_name"]) == lookup_unit_name),
        None,
    )
    if not unit_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Hospital unit not found in hr_blueprint.db")

    unit_id = unit_row["unit_id"]

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

    position_rows = cur.execute(
        base_cte + """
        SELECT position_name_th, SUM(headcount) AS headcount
        FROM active_positions
        GROUP BY position_name_th
        ORDER BY headcount DESC, position_name_th
        """,
        (unit_id,),
    ).fetchall()

    doctor_specialty_rows = cur.execute(
        base_cte + """
        SELECT specialist_name, SUM(headcount) AS headcount
        FROM active_positions
        WHERE position_name_th LIKE '%นายแพทย์%'
        GROUP BY specialist_name
        ORDER BY headcount DESC, specialist_name
        LIMIT 5
        """,
        (unit_id,),
    ).fetchall()

    nurse_group_rows = cur.execute(
        base_cte + """
        SELECT position_group_name, SUM(headcount) AS headcount
        FROM active_positions
        WHERE position_name_th LIKE '%พยาบาลวิชาชีพ%'
        GROUP BY position_group_name
        ORDER BY headcount DESC, position_group_name
        LIMIT 5
        """,
        (unit_id,),
    ).fetchall()

    counts = {}
    audit_trail = {}
    for metric_code, definition in HR_WORKFORCE_DICTIONARY.items():
        metric_rows = cur.execute(
            base_cte + f"""
            SELECT position_name_th, position_group_name, specialist_name, SUM(headcount) AS headcount
            FROM active_positions
            WHERE TRIM(position_name_th) IN ({",".join("?" for _ in definition["exact_position_names"])})
            GROUP BY position_name_th, position_group_name, specialist_name
            ORDER BY headcount DESC, position_name_th, position_group_name
            """,
            (unit_id, *definition["exact_position_names"]),
        ).fetchall()
        count = sum(int(row["headcount"] or 0) for row in metric_rows)
        counts[metric_code] = count
        audit_trail[metric_code] = {
            "label": definition["label_th"],
            "note": definition["note_th"],
            "count": count,
            "sql": render_metric_sql(metric_code),
            "source_rows": [
                {
                    "position_name_th": row["position_name_th"],
                    "position_group_name": row["position_group_name"],
                    "specialist_name": row["specialist_name"],
                    "count": int(row["headcount"] or 0),
                }
                for row in metric_rows
            ],
        }

    conn.close()
    hr_benchmarks = get_benchmark_lookup("clinical_profession")
    confidence = compute_hr_confidence_summary(
        unit_matched=bool(unit_row),
        audit_available=bool(audit_trail),
    )
    return {
        "summary": {
            "unit_id": unit_row["unit_id"],
            "unit_name": unit_row["unit_name"],
            "province_code": unit_row["province_code"],
            "unit_type_label": unit_row["unit_type_label"],
            "counts": counts,
            "top_doctors": [{"label": row["specialist_name"], "count": int(row["headcount"] or 0)} for row in doctor_specialty_rows],
            "top_nurses": [{"label": row["position_group_name"], "count": int(row["headcount"] or 0)} for row in nurse_group_rows],
            "top_positions": [{"label": row["position_name_th"], "count": int(row["headcount"] or 0)} for row in position_rows[:10]],
            "audit_trail": audit_trail,
            "dictionary": HR_WORKFORCE_DICTIONARY,
            "benchmarks": hr_benchmarks,
            "confidence": confidence,
        }
    }


@app.get("/api/mock/hospitals")
def get_mock_hospitals():
    return {"hospitals": list_mock_hospitals()}


@app.post("/api/mock/hospitals")
def post_mock_hospital(payload: MockHospitalCreate):
    hospital = create_mock_hospital(model_to_dict(payload))
    return {"hospital": hospital}


@app.get("/api/mock/hospitals/{mock_hospital_id}")
def get_mock_hospital_detail(mock_hospital_id: str):
    hospital = get_mock_hospital(mock_hospital_id)
    if hospital is None:
        raise HTTPException(status_code=404, detail="Mock hospital not found")
    return {"hospital": hospital}


@app.post("/api/mock/hospitals/{mock_hospital_id}/scenarios")
def post_mock_scenario(mock_hospital_id: str, payload: MockScenarioCreate):
    scenario = create_mock_scenario(mock_hospital_id, model_to_dict(payload))
    if scenario is None:
        raise HTTPException(status_code=404, detail="Mock hospital not found")
    return {"scenario": scenario}


@app.get("/api/mock/scenarios/{scenario_id}")
def get_mock_scenario_detail(scenario_id: str):
    scenario = get_mock_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Mock scenario not found")
    return {"scenario": scenario}


@app.put("/api/mock/scenarios/{scenario_id}/inputs")
def put_mock_input_values(scenario_id: str, payload: MockInputBulkUpsert):
    scenario = upsert_input_values(
        scenario_id,
        [model_to_dict(item) for item in payload.values],
    )
    if scenario is None:
        raise HTTPException(status_code=404, detail="Mock scenario not found")
    return {"scenario": scenario}


@app.post("/api/mock/scenarios/{scenario_id}/runs")
def post_mock_run_result(scenario_id: str, payload: MockRunResultCreate):
    run_result = create_run_result(scenario_id, model_to_dict(payload))
    if run_result is None:
        raise HTTPException(status_code=404, detail="Mock scenario not found")
    return {"run_result": run_result}

dashboard_path = os.path.join(os.path.dirname(BASE_DIR), "dashboard")
app.mount("/dashboard", StaticFiles(directory=dashboard_path, html=True), name="dashboard")

@app.get("/")
def root(): return RedirectResponse(url="/dashboard")
