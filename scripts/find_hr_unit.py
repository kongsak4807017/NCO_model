"""
Find unit_name values in hr_blueprint.db for a given province_code.

Usage:
  python scripts/find_hr_unit.py 50 นครพิงค์
  python scripts/find_hr_unit.py 50
"""

from __future__ import annotations

import sys
import sqlite3
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def _norm(text: str) -> str:
    cleaned = unicodedata.normalize("NFKC", text or "").strip().lower()
    cleaned = "".join(ch for ch in cleaned if ch.isalnum())
    return cleaned


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: python scripts/find_hr_unit.py <province_code> [query]")
        return 2

    province_code = str(argv[1]).strip()
    query = " ".join(argv[2:]).strip() if len(argv) > 2 else ""
    q = _norm(query)

    db_path = ROOT / "hr_blueprint.db"
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    rows = cur.execute(
        """
        select unit_type_label, unit_name
        from organizational_unit
        where province_code = ?
        order by unit_type_label, unit_name
        """,
        (province_code,),
    ).fetchall()
    con.close()

    if not query:
        for typ, name in rows:
            print(f"{typ} | {name}")
        return 0

    hits = []
    for typ, name in rows:
        key = _norm(name)
        if q and (q in key or key in q):
            hits.append((typ, name))

    if not hits:
        print("No matches.")
        return 1

    for typ, name in hits:
        print(f"{typ} | {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

