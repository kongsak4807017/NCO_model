import os
from typing import Any

try:
    from analysis_governance_store import get_benchmark_lookup
    from analysis_governance_store import get_workload_reference_lookup
    from clinical_denominator_store import resolve_clinical_denominator
except ImportError:
    from API.analysis_governance_store import get_benchmark_lookup
    from API.analysis_governance_store import get_workload_reference_lookup
    from API.clinical_denominator_store import resolve_clinical_denominator


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")
ENGINE_VERSION = "need-fte-backend-v1"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def compute_hni_from_components(
    *,
    elderly_rate_pct: float,
    chronic_rate_pct: float,
    mental_risk_rate_per100k: float,
    weight_elderly: float,
    weight_chronic: float,
    weight_mental: float,
    db_path: str | None = None,
) -> dict[str, Any]:
    benchmarks = get_benchmark_lookup("hni_component", db_path=db_path)
    ref_elderly = float(benchmarks.get("elderly_rate_pct", {}).get("reference_value") or benchmarks.get("elderly_rate_pct", {}).get("target_value") or 30.0)
    ref_chronic = float(benchmarks.get("chronic_rate_pct", {}).get("reference_value") or benchmarks.get("chronic_rate_pct", {}).get("target_value") or 25.0)
    ref_mental = float(benchmarks.get("mental_risk_rate_per100k", {}).get("reference_value") or benchmarks.get("mental_risk_rate_per100k", {}).get("target_value") or 5000.0)

    norm_elderly = clamp(float(elderly_rate_pct or 0.0) / max(ref_elderly, 1.0), 0.0, 1.5)
    norm_chronic = clamp(float(chronic_rate_pct or 0.0) / max(ref_chronic, 1.0), 0.0, 1.5)
    norm_mental = clamp(float(mental_risk_rate_per100k or 0.0) / max(ref_mental, 1.0), 0.0, 1.5)
    total_weight = max(float(weight_elderly or 0.0) + float(weight_chronic or 0.0) + float(weight_mental or 0.0), 1.0)
    hni_score = (
        (norm_elderly * float(weight_elderly or 0.0) / total_weight)
        + (norm_chronic * float(weight_chronic or 0.0) / total_weight)
        + (norm_mental * float(weight_mental or 0.0) / total_weight)
    ) * 100.0
    return {
        "hni_score": round(hni_score, 2),
        "reference": {
            "elderly_rate_pct": ref_elderly,
            "chronic_rate_pct": ref_chronic,
            "mental_risk_rate_per100k": ref_mental,
        },
        "normalized": {
            "elderly_rate_pct": round(norm_elderly, 4),
            "chronic_rate_pct": round(norm_chronic, 4),
            "mental_risk_rate_per100k": round(norm_mental, 4),
        },
    }


def _compute_profession_mix(
    *,
    elderly_rate_pct: float,
    chronic_rate_pct: float,
    mental_risk_rate_per100k: float,
    indicator_values: dict[str, float] | None = None,
    db_path: str | None = None,
) -> dict[str, float]:
    indicator_values = indicator_values or {}
    hni = compute_hni_from_components(
        elderly_rate_pct=elderly_rate_pct,
        chronic_rate_pct=chronic_rate_pct,
        mental_risk_rate_per100k=mental_risk_rate_per100k,
        weight_elderly=40.0,
        weight_chronic=40.0,
        weight_mental=20.0,
        db_path=db_path,
    )
    norm_elderly = hni["normalized"]["elderly_rate_pct"]
    norm_chronic = hni["normalized"]["chronic_rate_pct"]
    norm_mental = hni["normalized"]["mental_risk_rate_per100k"]
    rehab_value = indicator_values.get("RH0101")
    rehab_pressure = (0.45 * norm_elderly) + (0.2 * norm_chronic) if rehab_value is None else max(0.0, (50.0 - float(rehab_value)) / 50.0)
    suicide_value = indicator_values.get("PS0001")
    suicide_pressure = norm_mental if suicide_value is None else max(0.0, (float(suicide_value) - 5.0) / 5.0)

    raw_weights = {
        "doctor_total": 28.0 + (18.0 * norm_chronic) + (8.0 * norm_elderly),
        "nurse_total": 28.0 + (12.0 * norm_chronic) + (10.0 * norm_elderly) + (6.0 * norm_mental),
        "pharmacist_total": 10.0 + (8.0 * norm_chronic),
        "physical_therapist_total": 8.0 + (10.0 * rehab_pressure) + (6.0 * norm_elderly),
        "psychologist_total": 8.0 + (10.0 * norm_mental) + (4.0 * suicide_pressure),
        "clinical_psychologist_total": 6.0 + (10.0 * norm_mental) + (6.0 * suicide_pressure),
    }
    total_weight = max(sum(raw_weights.values()), 1.0)
    return {code: round((value / total_weight) * 100.0, 4) for code, value in raw_weights.items()}


def _get_need_burden_multiplier(hni_score: float) -> float:
    return clamp(0.75 + (float(hni_score or 0.0) / 100.0), 0.75, 1.6)


def _compute_workload_function_pressure(denominator: dict[str, Any], db_path: str | None = None) -> dict[str, Any]:
    components = denominator.get("workload_components") or {}
    population = max(float(denominator.get("denominator_population_total") or 0.0), 1.0)

    def per_10k(value: float) -> float:
        return (float(value or 0.0) / population) * 10000.0

    workload_rates = {
        "opd_per_10k": per_10k(components.get("outpatient_visits") or 0.0),
        "ipd_per_10k": per_10k(components.get("inpatient_visits") or 0.0),
        "er_per_10k": per_10k(components.get("emergency_visits") or 0.0),
        "or_per_10k": per_10k(components.get("surgery_count") or 0.0),
        "delivery_per_10k": per_10k(components.get("delivery_count") or 0.0),
        "mental_per_10k": per_10k(components.get("mental_health_visits") or 0.0),
        "chronic_per_10k": per_10k(components.get("chronic_disease_visits") or 0.0),
        "icu_per_10k": None,
    }

    workload_reference_lookup = get_workload_reference_lookup(db_path=db_path)

    def ref(metric_code: str, fallback: float) -> float:
        item = workload_reference_lookup.get(metric_code) or {}
        return float(item.get("calibrated_reference_value") or item.get("default_reference_value") or fallback)

    def intensity(value: float, reference: float) -> float:
        return clamp(float(value or 0.0) / max(reference, 1.0), 0.0, 2.0)

    doctor_signal = (
        0.30 * intensity(workload_rates["ipd_per_10k"], ref("ipd_per_10k", 120))
        + 0.25 * intensity(workload_rates["er_per_10k"], ref("er_per_10k", 220))
        + 0.25 * intensity(workload_rates["or_per_10k"], ref("or_per_10k", 18))
        + 0.20 * intensity(workload_rates["delivery_per_10k"], ref("delivery_per_10k", 12))
    )
    nurse_signal = (
        0.35 * intensity(workload_rates["opd_per_10k"], ref("opd_per_10k", 1800))
        + 0.25 * intensity(workload_rates["ipd_per_10k"], ref("ipd_per_10k", 120))
        + 0.20 * intensity(workload_rates["er_per_10k"], ref("er_per_10k", 220))
        + 0.20 * intensity(workload_rates["delivery_per_10k"], ref("delivery_per_10k", 12))
    )
    pharmacist_signal = (
        0.45 * intensity(workload_rates["opd_per_10k"], ref("opd_per_10k", 1800))
        + 0.55 * intensity(workload_rates["chronic_per_10k"], ref("chronic_per_10k", 700))
    )
    pt_signal = (
        0.60 * intensity(workload_rates["ipd_per_10k"], ref("ipd_per_10k", 120))
        + 0.40 * intensity(workload_rates["or_per_10k"], ref("or_per_10k", 18))
    )
    psych_signal = intensity(workload_rates["mental_per_10k"], ref("mental_per_10k", 350))
    clinical_psych_signal = intensity(workload_rates["mental_per_10k"], ref("mental_per_10k", 350))

    profession_pressure = {
        "doctor_total": clamp(0.85 + (doctor_signal * 0.35), 0.85, 1.55),
        "nurse_total": clamp(0.85 + (nurse_signal * 0.35), 0.85, 1.55),
        "pharmacist_total": clamp(0.85 + (pharmacist_signal * 0.30), 0.85, 1.45),
        "physical_therapist_total": clamp(0.80 + (pt_signal * 0.35), 0.80, 1.50),
        "psychologist_total": clamp(0.80 + (psych_signal * 0.40), 0.80, 1.60),
        "clinical_psychologist_total": clamp(0.80 + (clinical_psych_signal * 0.45), 0.80, 1.65),
    }
    return {
        "components": components,
        "rates_per_10k": workload_rates,
        "profession_pressure": profession_pressure,
        "reference_lookup": workload_reference_lookup,
    }


def _build_service_denominator_matrix(denominator: dict[str, Any], workload_pressure: dict[str, Any]) -> list[dict[str, Any]]:
    references = workload_pressure.get("reference_lookup") or {}
    rates = workload_pressure.get("rates_per_10k") or {}
    matrix = []
    for metric_code in (
        "opd_per_10k",
        "ipd_per_10k",
        "er_per_10k",
        "or_per_10k",
        "delivery_per_10k",
        "mental_per_10k",
        "chronic_per_10k",
        "icu_per_10k",
    ):
        reference = references.get(metric_code) or {}
        matrix.append(
            {
                "metric_code": metric_code,
                "service_function": reference.get("service_function"),
                "metric_name_th": reference.get("metric_name_th") or metric_code,
                "actual_rate_per_10k": rates.get(metric_code),
                "reference_rate_per_10k": reference.get("calibrated_reference_value") or reference.get("default_reference_value"),
                "availability_status": reference.get("availability_status") or ("missing" if rates.get(metric_code) is None else "available"),
                "sample_count": reference.get("sample_count"),
                "coverage_ratio": reference.get("coverage_ratio"),
                "mapped_professions": reference.get("mapped_professions") or [],
                "scope_type": denominator.get("scope_type"),
                "denominator_population_total": denominator.get("denominator_population_total"),
            }
        )
    return matrix


def compute_clinical_need_fte_preview(
    *,
    population_total: float,
    workforce_counts: dict[str, float],
    elderly_rate_pct: float,
    chronic_rate_pct: float,
    mental_risk_rate_per100k: float,
    weight_elderly: float = 40.0,
    weight_chronic: float = 40.0,
    weight_mental: float = 20.0,
    indicator_values: dict[str, float] | None = None,
    hospital_name: str | None = None,
    province_code: str | None = None,
    unit_name: str | None = None,
    clinical_scope_type: str | None = None,
    clinical_scope_name: str | None = None,
    db_path: str | None = None,
) -> dict[str, Any]:
    denominator = resolve_clinical_denominator(
        hospital_name=hospital_name,
        province_code=province_code,
        unit_name=unit_name,
        clinical_scope_type=clinical_scope_type,
        clinical_scope_name=clinical_scope_name,
        fallback_population_total=population_total,
        db_path=db_path,
    )
    effective_population_total = float(denominator.get("denominator_population_total") or population_total or 0.0)
    workload_pressure = _compute_workload_function_pressure(denominator, db_path=db_path)
    hni = compute_hni_from_components(
        elderly_rate_pct=elderly_rate_pct,
        chronic_rate_pct=chronic_rate_pct,
        mental_risk_rate_per100k=mental_risk_rate_per100k,
        weight_elderly=weight_elderly,
        weight_chronic=weight_chronic,
        weight_mental=weight_mental,
        db_path=db_path,
    )
    hni_score = hni["hni_score"]
    profession_mix = _compute_profession_mix(
        elderly_rate_pct=elderly_rate_pct,
        chronic_rate_pct=chronic_rate_pct,
        mental_risk_rate_per100k=mental_risk_rate_per100k,
        indicator_values=indicator_values,
        db_path=db_path,
    )
    burden_multiplier = _get_need_burden_multiplier(hni_score)
    benchmarks = get_benchmark_lookup("clinical_profession", db_path=db_path)

    rows = []
    for code, benchmark in benchmarks.items():
        rate_per = float(benchmark.get("rate_per") or 0.0)
        target_value = float(benchmark.get("target_value") or 0.0)
        if rate_per <= 0 or target_value <= 0:
            continue
        baseline_need = (target_value * effective_population_total) / rate_per
        default_weight = float(benchmark.get("default_weight_pct") or 0.0)
        actual_weight = float(profession_mix.get(code) or 0.0)
        mix_adjustment = max(0.65, (actual_weight / default_weight)) if default_weight > 0 else 1.0
        base_pressure_factor = float(benchmark.get("pressure_fte_factor") or 1.0)
        workload_pressure_factor = float(workload_pressure["profession_pressure"].get(code) or 1.0)
        pressure_factor = base_pressure_factor * workload_pressure_factor
        need_fte = baseline_need * burden_multiplier * mix_adjustment * pressure_factor
        headcount = float(workforce_counts.get(code) or 0.0)
        fte_per_headcount = float(benchmark.get("fte_per_headcount") or 1.0)
        available_fte = headcount * fte_per_headcount
        gap_fte = max(0.0, need_fte - available_fte)
        rows.append(
            {
                "profession_code": code,
                "label": benchmark.get("subject_name_th") or code,
                "profession_name_th": benchmark.get("subject_name_th") or code,
                "rate_per": rate_per,
                "target_ratio": target_value,
                "baseline_need_fte": round(baseline_need, 2),
                "need_fte": round(need_fte, 2),
                "available_fte": round(available_fte, 2),
                "gap_fte": round(gap_fte, 2),
                "suggested_add": int(max(0, round(gap_fte + 0.499999))),
                "headcount": round(headcount, 2),
                "mix_pct": round(actual_weight, 2),
                "default_weight_pct": round(default_weight, 2),
                "mix_adjustment": round(mix_adjustment, 4),
                "burden_multiplier": round(burden_multiplier, 4),
                "workload_pressure_factor": round(workload_pressure_factor, 4),
                "base_pressure_factor": round(base_pressure_factor, 4),
                "benchmark": benchmark,
            }
        )
    rows.sort(key=lambda item: item["gap_fte"], reverse=True)
    service_denominator_matrix = _build_service_denominator_matrix(denominator, workload_pressure)

    return {
        "engine_version": ENGINE_VERSION,
        "hospital_name": hospital_name,
        "clinical_scope_type": denominator.get("scope_type") or clinical_scope_type,
        "clinical_scope_name": denominator.get("scope_name") or clinical_scope_name,
        "population_total": effective_population_total,
        "requested_population_total": float(population_total or 0.0),
        "hni_score": hni_score,
        "hni_reference": hni["reference"],
        "hni_normalized": hni["normalized"],
        "profession_mix": profession_mix,
        "burden_multiplier": round(burden_multiplier, 4),
        "denominator": denominator,
        "workload_pressure": workload_pressure,
        "service_denominator_matrix": service_denominator_matrix,
        "rows": rows,
    }
