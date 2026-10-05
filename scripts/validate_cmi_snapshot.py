#!/usr/bin/env python3
"""Strict validation for the committed CMI five-year snapshot."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

SNAPSHOT = Path("output/cmi_5y/health_kpi_records.json")
YEARS = {2565,2566,2567,2568,2569}


def main() -> int:
    if not SNAPSHOT.exists():
        print("missing snapshot", file=sys.stderr)
        return 2
    doc = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    assert doc.get("schema_version") == "nco-cmi-kpi-5y-v1"
    assert set(doc.get("years") or []) == YEARS
    records = doc.get("records") or []

    seen = set()
    errors = []
    for i, row in enumerate(records):
        key = (row.get("year"), row.get("indicator_code"), row.get("hospital_code"))
        if key in seen:
            errors.append(f"duplicate key {key}")
        seen.add(key)

        if row.get("year") not in YEARS:
            errors.append(f"row {i}: year outside 5-year window")
        if not str(row.get("indicator_code") or "").strip():
            errors.append(f"row {i}: missing indicator_code")
        if not str(row.get("hospital_code") or "").isdigit() or len(str(row.get("hospital_code"))) != 5:
            errors.append(f"row {i}: invalid hospital_code")
        if not row.get("source_url"):
            errors.append(f"row {i}: missing source_url")
        if not row.get("source_sha256"):
            errors.append(f"row {i}: missing source_sha256")
        if row.get("value") is None and row.get("numerator") is None and row.get("denominator") is None:
            errors.append(f"row {i}: no measurable value")

        n, d, value = row.get("numerator"), row.get("denominator"), row.get("value")
        unit = str(row.get("unit") or "")
        if n is not None and d not in (None, 0) and value is not None:
            scale = 100000 if "100k" in unit else 1000 if "1000" in unit else 100 if unit == "%" else None
            if scale:
                expected = float(n) / float(d) * scale
                tolerance = max(0.15, abs(expected) * 0.02)
                if not math.isclose(float(value), expected, abs_tol=tolerance):
                    errors.append(f"row {i}: numerator/denominator mismatch {key}: value={value} expected≈{expected:.4f}")

    # Empty snapshot is allowed only before first authorised collection.
    if not records and doc.get("status") not in {"awaiting_authorised_collection","incomplete"}:
        errors.append("empty snapshot with invalid status")

    if errors:
        print("\n".join(errors[:100]), file=sys.stderr)
        print(f"{len(errors)} validation error(s)", file=sys.stderr)
        return 1

    print(f"CMI snapshot valid: {len(records)} records; status={doc.get('status')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
