"""
Run hospital-level HR forecast scenarios by calling the local NCO API.

Input: CSV template (see templates/hr_forecast_template.csv)
Output: output/hr_forecast_results.json

This intentionally uses the existing NCO "need-fte-preview" endpoint so
the answers are aligned with the simulator model.
"""

from __future__ import annotations

import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
import sqlite3
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_API_BASE = "http://127.0.0.1:8765"


@dataclass
class ForecastRow:
    year_be: int
    province_code: str
    unit_name: str
    hospital_name: str
    population_total: float
    elderly_rate_pct: float
    chronic_rate_pct: float
    mental_risk_rate_per100k: float
    weight_elderly: float
    weight_chronic: float
    weight_mental: float
    clinical_scope_type: str
    clinical_scope_name: str
    persist: bool
    persisted_from_step: str | None


def _as_float(value: str, default: float = 0.0) -> float:
    text = (value or "").strip()
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _as_int(value: str, default: int = 0) -> int:
    text = (value or "").strip()
    if not text:
        return default
    try:
        return int(float(text))
    except ValueError:
        return default


def _as_bool(value: str) -> bool:
    text = (value or "").strip().lower()
    return text in {"1", "true", "yes", "y"}


def read_rows(csv_path: Path) -> list[ForecastRow]:
    rows: list[ForecastRow] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for i, r in enumerate(reader, start=2):
            if not r:
                continue
            year_be = _as_int(r.get("year_be", ""), 0)
            province_code = (r.get("province_code", "") or "").strip()
            unit_name = (r.get("unit_name", "") or "").strip()
            hospital_name = (r.get("hospital_name", "") or "").strip() or unit_name
            if not (year_be and province_code and unit_name):
                raise SystemExit(f"Row {i} missing required fields: year_be/province_code/unit_name")
            rows.append(
                ForecastRow(
                    year_be=year_be,
                    province_code=province_code,
                    unit_name=unit_name,
                    hospital_name=hospital_name,
                    population_total=_as_float(r.get("population_total", "")),
                    elderly_rate_pct=_as_float(r.get("elderly_rate_pct", "")),
                    chronic_rate_pct=_as_float(r.get("chronic_rate_pct", "")),
                    mental_risk_rate_per100k=_as_float(r.get("mental_risk_rate_per100k", "")),
                    weight_elderly=_as_float(r.get("weight_elderly", ""), 40.0),
                    weight_chronic=_as_float(r.get("weight_chronic", ""), 40.0),
                    weight_mental=_as_float(r.get("weight_mental", ""), 20.0),
                    clinical_scope_type=(r.get("clinical_scope_type", "") or "").strip(),
                    clinical_scope_name=(r.get("clinical_scope_name", "") or "").strip(),
                    persist=_as_bool(r.get("persist", "")),
                    persisted_from_step=(r.get("persisted_from_step", "") or "").strip() or None,
                )
            )
    return rows


def top_gap_rows(preview: dict[str, Any], limit: int = 3) -> list[dict[str, Any]]:
    rows = preview.get("rows") or []
    if not isinstance(rows, list):
        return []
    filtered = []
    for item in rows:
        gap = 0.0
        if isinstance(item, dict):
            raw = item.get("gapFte")
            if raw is None:
                raw = item.get("gap_fte")
            try:
                gap = float(raw or 0)
            except Exception:
                gap = 0.0
        if gap > 0.05:
            filtered.append(item)
    def _gap_val(x: dict[str, Any]) -> float:
        raw = x.get("gapFte")
        if raw is None:
            raw = x.get("gap_fte")
        try:
            return float(raw or 0)
        except Exception:
            return 0.0

    filtered.sort(key=_gap_val, reverse=True)
    return filtered[:limit]

def _norm(text: str) -> str:
    # Similar spirit to API.normalize_lookup_key (keep it local to avoid importing API code).
    cleaned = unicodedata.normalize("NFKC", text or "").strip().lower()
    cleaned = "".join(ch for ch in cleaned if ch.isalnum())
    return cleaned


def suggest_unit_names(province_code: str, query: str, limit: int = 12) -> list[str]:
    db_path = ROOT / "hr_blueprint.db"
    if not db_path.exists():
        return []
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    rows = cur.execute(
        "select unit_name from organizational_unit where province_code = ? order by unit_name",
        (province_code,),
    ).fetchall()
    con.close()
    q = _norm(query)
    if not q:
        return [name for (name,) in rows[:limit]]
    scored: list[tuple[int, str]] = []
    for (name,) in rows:
        key = _norm(name)
        if not key:
            continue
        score = 0
        if q == key:
            score = 100
        elif q in key:
            score = 80
        elif key in q:
            score = 60
        elif q[:4] and q[:4] in key:
            score = 40
        if score:
            scored.append((score, name))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [name for _, name in scored[:limit]]


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python scripts/run_hr_forecast.py <path-to-forecast.csv>")
        return 2

    csv_path = (ROOT / argv[1]).resolve() if not Path(argv[1]).is_absolute() else Path(argv[1])
    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}")
        return 2

    api_base = DEFAULT_API_BASE
    try:
        resp = requests.get(f"{api_base}/api/overview", timeout=2)
        if resp.status_code != 200:
            raise RuntimeError("API not healthy")
    except Exception:
        print(f"ERROR: API not reachable at {api_base}. Run run_simulator.bat first.")
        return 3

    rows = read_rows(csv_path)

    results: list[dict[str, Any]] = []
    for r in rows:
        payload = {
            "hospital_name": r.hospital_name,
            "province_code": r.province_code,
            "unit_name": r.unit_name,
            "population_total": r.population_total,
            "elderly_rate_pct": r.elderly_rate_pct,
            "chronic_rate_pct": r.chronic_rate_pct,
            "mental_risk_rate_per100k": r.mental_risk_rate_per100k,
            "weight_elderly": r.weight_elderly,
            "weight_chronic": r.weight_chronic,
            "weight_mental": r.weight_mental,
            "clinical_scope_type": r.clinical_scope_type or None,
            "clinical_scope_name": r.clinical_scope_name or None,
            "persist": bool(r.persist),
            "persisted_from_step": r.persisted_from_step,
            # leave workforce_counts empty: API will auto-fetch baseline counts via province_code+unit_name
            "workforce_counts": {},
            "indicator_values": {},
        }

        res = requests.post(f"{api_base}/api/analysis/need-fte-preview", json=payload, timeout=30)
        if res.status_code == 404:
            try:
                detail = (res.json() or {}).get("detail")
            except Exception:
                detail = None
            if isinstance(detail, str) and "Hospital unit not found" in detail:
                suggestions = suggest_unit_names(r.province_code, r.unit_name)
                hint = ""
                if suggestions:
                    hint = " Suggestions: " + " | ".join(suggestions)
                raise SystemExit(
                    f"Unit not found in hr_blueprint.db for province_code={r.province_code}: '{r.unit_name}'.{hint}"
                )
        res.raise_for_status()
        body = res.json()
        preview = body.get("preview") or {}
        results.append(
            {
                "year_be": r.year_be,
                "province_code": r.province_code,
                "unit_name": r.unit_name,
                "hospital_name": r.hospital_name,
                "input": payload,
                "preview": preview,
                "top_gaps": top_gap_rows(preview, limit=3),
                "persisted_run": body.get("persisted_run"),
            }
        )

    out = {
        "generated_from": str(csv_path),
        "api_base": api_base,
        "count_rows": len(results),
        "results": results,
    }
    out_path = ROOT / "output" / "hr_forecast_results.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
