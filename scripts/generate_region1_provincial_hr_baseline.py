"""
Generate Region 1 provincial HR baseline using the *real* data already in this repo:
- Population: parsed from health_metrics_analysis_report.md (HDC 2569)
- Workforce filled/vacant + retirement risk: hr_blueprint.db

Outputs:
- output/hr_blueprint_provincial_baseline_region1.json

Note:
We keep this script in-repo so Thai literals are stored as UTF-8 (PowerShell pipe
can corrupt Thai literals in stdin, causing SQL filters to fail).
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
import sqlite3
import statistics
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _rate_per_10k(n: int, pop: int) -> float:
    if pop <= 0:
        return 0.0
    return (n / pop) * 10000.0


def _p75(vals: list[float]) -> float:
    # Deterministic "discrete" p75 selection for small N (N=8 provinces).
    # This matches the common "nearest rank" method.
    if not vals:
        return 0.0
    s = sorted(vals)
    k = math.ceil(0.75 * len(s)) - 1
    return s[max(0, min(k, len(s) - 1))]


def parse_region1_population() -> dict[str, int]:
    md = (ROOT / "health_metrics_analysis_report.md").read_text(
        encoding="utf-8", errors="replace"
    )

    # Rows like:
    # | **เชียงใหม่** | 566,320 | 604,374 | **1,170,694** |
    row_re = re.compile(
        r"\|\s*\*\*(?P<prov>[^*]+)\*\*\s*\|"
        r"\s*(?P<male>[0-9,]+)\s*\|"
        r"\s*(?P<female>[0-9,]+)\s*\|"
        r"\s*\*\*(?P<total>[0-9,]+)\*\*\s*\|"
    )

    prov_pop: dict[str, int] = {}
    for m in row_re.finditer(md):
        prov = m.group("prov").strip()
        if prov.startswith("รวมเขต"):
            continue
        total = int(m.group("total").replace(",", ""))
        prov_pop[prov] = total

    return prov_pop


def main() -> int:
    prov_pop = parse_region1_population()
    if len(prov_pop) != 8:
        raise SystemExit(
            f"Expected 8 provinces from HDC table, got {len(prov_pop)}: {list(prov_pop)}"
        )

    con = sqlite3.connect(str(ROOT / "hr_blueprint.db"))
    cur = con.cursor()

    prov_code_to_name = dict(
        cur.execute("select province_code, province_name_th from provinces").fetchall()
    )
    prov_name_to_code = {v: k for k, v in prov_code_to_name.items()}

    # Key professions we use for the provincial picture (can be extended later)
    POS = {
        "doctor": "นายแพทย์",
        "nurse": "พยาบาลวิชาชีพ",
        "pharmacist": "เภสัชกร",
    }

    # Filled counts (people) by province for each key profession
    q_filled = f"""
        select ou.province_code, p.position_name_th, count(*) as n
        from assignment a
        join position p on p.position_id = a.position_id
        join organizational_unit ou on ou.unit_id = a.unit_id
        where a.status='active'
          and p.position_status='filled'
          and p.position_name_th in ({','.join('?' for _ in POS)})
        group by ou.province_code, p.position_name_th
    """
    rows = cur.execute(q_filled, list(POS.values())).fetchall()

    filled = {code: {k: 0 for k in POS} for code in prov_code_to_name}
    for prov_code, pos_name, n in rows:
        for key, val in POS.items():
            if pos_name == val:
                filled[prov_code][key] = int(n)

    # Vacancy counts
    vac_all = dict(
        cur.execute(
            """
            select ou.province_code, count(*)
            from position p
            join organizational_unit ou on ou.unit_id=p.unit_id
            where p.position_status='vacant'
            group by ou.province_code
            """
        ).fetchall()
    )

    q_vac_key = f"""
        select ou.province_code, p.position_name_th, count(*)
        from position p
        join organizational_unit ou on ou.unit_id=p.unit_id
        where p.position_status='vacant'
          and p.position_name_th in ({','.join('?' for _ in POS)})
        group by ou.province_code, p.position_name_th
    """
    vac_key_rows = cur.execute(q_vac_key, list(POS.values())).fetchall()
    vac_key = {code: {k: 0 for k in POS} for code in prov_code_to_name}
    for prov_code, pos_name, n in vac_key_rows:
        for key, val in POS.items():
            if pos_name == val:
                vac_key[prov_code][key] = int(n)

    # Retirement risk (<= 5 years from current project date)
    # Project date is pinned here for reproducibility of the study artifact.
    study_date = dt.date(2026, 5, 4)
    cutoff = dt.date(study_date.year + 5, study_date.month, study_date.day)
    ret_rows = cur.execute(
        """
        select ou.province_code, count(*)
        from personnel per
        join assignment a on a.personnel_id=per.personnel_id
        join organizational_unit ou on ou.unit_id=a.unit_id
        where per.retirement_date is not null
          and date(per.retirement_date) <= date(?)
          and per.is_active=1
          and a.status='active'
        group by ou.province_code
        """,
        (cutoff.isoformat(),),
    ).fetchall()
    retire_5y = {code: 0 for code in prov_code_to_name}
    for prov_code, n in ret_rows:
        retire_5y[prov_code] = int(n)

    # Retirement risk by key profession (<= 5 years)
    q_ret_key = f"""
        select ou.province_code, p.position_name_th, count(*)
        from personnel per
        join assignment a on a.personnel_id=per.personnel_id
        join position p on p.position_id=a.position_id
        join organizational_unit ou on ou.unit_id=a.unit_id
        where per.retirement_date is not null
          and date(per.retirement_date) <= date(?)
          and per.is_active=1
          and a.status='active'
          and p.position_status='filled'
          and p.position_name_th in ({','.join('?' for _ in POS)})
        group by ou.province_code, p.position_name_th
    """
    ret_key_rows = cur.execute(
        q_ret_key, (cutoff.isoformat(), *list(POS.values()))
    ).fetchall()
    retire_5y_key = {code: {k: 0 for k in POS} for code in prov_code_to_name}
    for prov_code, pos_name, n in ret_key_rows:
        for key, val in POS.items():
            if pos_name == val:
                retire_5y_key[prov_code][key] = int(n)

    # Build baseline rows for the 8 provinces from the population table
    rows_out: list[dict[str, object]] = []
    for prov_name, pop in prov_pop.items():
        prov_code = prov_name_to_code.get(prov_name)
        if not prov_code:
            raise SystemExit(f"Province not found in hr_blueprint.db provinces table: {prov_name}")

        f = filled[prov_code]
        r = {
            "province": prov_name,
            "province_code": prov_code,
            "population": pop,
            "doctor": f["doctor"],
            "nurse": f["nurse"],
            "pharmacist": f["pharmacist"],
            "doctor_per10k": _rate_per_10k(f["doctor"], pop),
            "nurse_per10k": _rate_per_10k(f["nurse"], pop),
            "pharmacist_per10k": _rate_per_10k(f["pharmacist"], pop),
            "vacant_all": int(vac_all.get(prov_code, 0)),
            "vacant_doctor": vac_key[prov_code]["doctor"],
            "vacant_nurse": vac_key[prov_code]["nurse"],
            "vacant_pharmacist": vac_key[prov_code]["pharmacist"],
            "retire_5y_all": retire_5y.get(prov_code, 0),
            "retire_5y_doctor": retire_5y_key[prov_code]["doctor"],
            "retire_5y_nurse": retire_5y_key[prov_code]["nurse"],
            "retire_5y_pharmacist": retire_5y_key[prov_code]["pharmacist"],
        }
        rows_out.append(r)

    # Benchmarks within Region 1 (median + discrete p75)
    benchmarks: dict[str, dict[str, float]] = {}
    for metric in ["doctor_per10k", "nurse_per10k", "pharmacist_per10k"]:
        vals = [float(r[metric]) for r in rows_out]
        benchmarks[metric] = {
            "median": float(statistics.median(vals)),
            "p75": float(_p75(vals)),
        }

    # Targets: headcount needed to reach median/p75 per10k
    for r in rows_out:
        pop = int(r["population"])
        for role, metric in [
            ("doctor", "doctor_per10k"),
            ("nurse", "nurse_per10k"),
            ("pharmacist", "pharmacist_per10k"),
        ]:
            med = benchmarks[metric]["median"]
            p75 = benchmarks[metric]["p75"]
            target_med = int(math.ceil(med * pop / 10000.0))
            target_p75 = int(math.ceil(p75 * pop / 10000.0))
            r[f"{role}_target_median"] = target_med
            r[f"{role}_gap_median"] = target_med - int(r[role])
            r[f"{role}_target_p75"] = target_p75
            r[f"{role}_gap_p75"] = target_p75 - int(r[role])

    out = {
        "generated_at": "2026-05-04",
        "study_date": str(study_date),
        "cutoff_retire_5y": str(cutoff),
        "benchmarks_per10k": benchmarks,
        "rows": rows_out,
        "sources": {
            "population": "health_metrics_analysis_report.md (HDC 2569 table)",
            "workforce": "hr_blueprint.db (assignment, position, personnel, organizational_unit, provinces)",
        },
    }

    out_path = ROOT / "output" / "hr_blueprint_provincial_baseline_region1.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
