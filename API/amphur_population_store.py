import io
import os
import sqlite3
import zipfile
from datetime import datetime, timezone

import pandas as pd
import requests


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")
DATA_DIR = os.path.join(BASE_DIR, "data")

DOPA_RESOURCE_URL = (
    "https://catalog.dopa.go.th/dataset/221a73a3-2223-4fdc-a79e-6738ff40bb57/"
    "resource/3100169d-d5f8-4719-8bc4-b319fe27814a/download/stat_67.zip"
)
DOPA_RESOURCE_PAGE = "https://www.data.go.th/dataset/dopa-star?is_fullscreen=1"
LOCAL_CACHE_PATH = os.path.join(DATA_DIR, "dopa_stat_67.zip")
SOURCE_KEY = "DOPA_STAT_67"


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_amphur_population_schema(db_path: str | None = None, refresh_if_missing: bool = True):
    conn = get_connection(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS amphur_population_reference (
            source_key TEXT NOT NULL,
            reference_yymm INTEGER NOT NULL,
            reference_year_be INTEGER NOT NULL,
            reference_month INTEGER NOT NULL,
            province_code TEXT NOT NULL,
            province_name_th TEXT NOT NULL,
            amphur_code TEXT NOT NULL,
            amphur_name_th TEXT NOT NULL,
            raw_registry_name TEXT,
            male_total INTEGER,
            female_total INTEGER,
            total_population INTEGER,
            house_total INTEGER,
            source_url TEXT,
            source_page_url TEXT,
            extracted_at TEXT,
            loaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (source_key, reference_yymm, province_code, amphur_code)
        )
        """
    )
    conn.commit()
    conn.close()
    if refresh_if_missing and not has_population_snapshot(db_path=db_path, source_key=SOURCE_KEY):
        refresh_amphur_population_reference(db_path=db_path)


def has_population_snapshot(db_path: str | None = None, source_key: str = SOURCE_KEY) -> bool:
    conn = get_connection(db_path)
    row = conn.execute(
        """
        SELECT COUNT(*) AS count_rows
        FROM amphur_population_reference
        WHERE source_key = ?
        """,
        (source_key,),
    ).fetchone()
    conn.close()
    return bool(row and row["count_rows"])


def _download_cached_zip(force: bool = False) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    if force or not os.path.exists(LOCAL_CACHE_PATH):
        response = requests.get(
            DOPA_RESOURCE_URL,
            timeout=120,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()
        with open(LOCAL_CACHE_PATH, "wb") as output_file:
            output_file.write(response.content)
    return LOCAL_CACHE_PATH


def _parse_html_xls_from_zip(zip_path: str) -> list[dict]:
    with zipfile.ZipFile(zip_path) as archive:
        member_name = next(
            name for name in archive.namelist() if name.lower().endswith("stat_a67.xls")
        )
        html_text = archive.read(member_name).decode("utf-8-sig", errors="replace")
    df = pd.read_html(io.StringIO(html_text))[0]
    df.columns = df.iloc[0]
    df = df.iloc[1:].copy()
    df = df.rename(
        columns={
            "ปีเดือน": "reference_yymm",
            "รหัสจังหวัด": "province_code",
            "ชื่อจังหวัด": "province_name_th",
            "รหัสสำนักทะเบียน": "amphur_code",
            "ชื่อสำนักทะเบียน": "raw_registry_name",
            "รหัสตำบล": "tambon_code",
            "ชื่อตำบล": "tambon_name",
            "รหัสหมู่บ้าน": "village_code",
            "ชื่อหมู่บ้าน": "village_name",
            "จำนวนประชากรชาย": "male_total",
            "จำนวนประชากรหญิง": "female_total",
            "จำนวนประชากรทั้งหมด": "total_population",
            "จำนวนบ้าน (หลังคาเรือน)": "house_total",
        }
    )
    records: list[dict] = []
    extracted_at = now_iso()
    for _, row in df.iterrows():
        province_code = _to_code(row.get("province_code"), width=2)
        amphur_code = _to_code(row.get("amphur_code"), width=4)
        tambon_code = _to_code(row.get("tambon_code"))
        village_code = _to_code(row.get("village_code"))
        if not province_code or province_code == "00":
            continue
        if not amphur_code or amphur_code == "0000":
            continue
        if tambon_code not in (None, "", "0", "00", "0000", "000000"):
            continue
        if village_code not in (None, "", "0", "00", "0000", "00000000"):
            continue
        reference_yymm = int(_to_number(row.get("reference_yymm")) or 0)
        if reference_yymm <= 0:
            continue
        raw_registry_name = str(row.get("raw_registry_name") or "").strip()
        records.append(
            {
                "source_key": SOURCE_KEY,
                "reference_yymm": reference_yymm,
                "reference_year_be": 2500 + (reference_yymm // 100),
                "reference_month": reference_yymm % 100,
                "province_code": province_code,
                "province_name_th": str(row.get("province_name_th") or "").strip(),
                "amphur_code": amphur_code,
                "amphur_name_th": _normalize_amphur_name(raw_registry_name),
                "raw_registry_name": raw_registry_name,
                "male_total": _to_number(row.get("male_total")),
                "female_total": _to_number(row.get("female_total")),
                "total_population": _to_number(row.get("total_population")),
                "house_total": _to_number(row.get("house_total")),
                "source_url": DOPA_RESOURCE_URL,
                "source_page_url": DOPA_RESOURCE_PAGE,
                "extracted_at": extracted_at,
            }
        )
    return records


def refresh_amphur_population_reference(db_path: str | None = None, force_download: bool = False) -> dict:
    build_amphur_population_schema(db_path=db_path, refresh_if_missing=False)
    zip_path = _download_cached_zip(force=force_download)
    records = _parse_html_xls_from_zip(zip_path)
    latest_yymm = max(record["reference_yymm"] for record in records)
    latest_records = [record for record in records if record["reference_yymm"] == latest_yymm]
    conn = get_connection(db_path)
    conn.execute("DELETE FROM amphur_population_reference WHERE source_key = ?", (SOURCE_KEY,))
    conn.executemany(
        """
        INSERT INTO amphur_population_reference (
            source_key, reference_yymm, reference_year_be, reference_month,
            province_code, province_name_th, amphur_code, amphur_name_th, raw_registry_name,
            male_total, female_total, total_population, house_total,
            source_url, source_page_url, extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                row["source_key"],
                row["reference_yymm"],
                row["reference_year_be"],
                row["reference_month"],
                row["province_code"],
                row["province_name_th"],
                row["amphur_code"],
                row["amphur_name_th"],
                row["raw_registry_name"],
                row["male_total"],
                row["female_total"],
                row["total_population"],
                row["house_total"],
                row["source_url"],
                row["source_page_url"],
                row["extracted_at"],
            )
            for row in latest_records
        ],
    )
    conn.commit()
    conn.close()
    return {
        "source_key": SOURCE_KEY,
        "reference_yymm": latest_yymm,
        "row_count": len(latest_records),
        "source_url": DOPA_RESOURCE_URL,
    }


def get_amphur_population(province_code: str, amphur_code: str, db_path: str | None = None) -> dict | None:
    build_amphur_population_schema(db_path=db_path)
    conn = get_connection(db_path)
    row = conn.execute(
        """
        SELECT *
        FROM amphur_population_reference
        WHERE province_code = ?
          AND amphur_code = ?
        ORDER BY reference_yymm DESC
        LIMIT 1
        """,
        (str(province_code), str(amphur_code)),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def list_amphur_population_rows(province_code: str | None = None, db_path: str | None = None) -> list[dict]:
    build_amphur_population_schema(db_path=db_path)
    conn = get_connection(db_path)
    if province_code:
        rows = conn.execute(
            """
            SELECT *
            FROM amphur_population_reference
            WHERE province_code = ?
            ORDER BY amphur_code
            """,
            (str(province_code),),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM amphur_population_reference ORDER BY province_code, amphur_code"
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def _to_code(value, width: int | None = None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().replace(".0", "")
    if not text:
        return None
    if width:
        return text.zfill(width)
    return text


def _to_number(value) -> int | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text or text == "-":
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _normalize_amphur_name(raw_name: str) -> str:
    name = (raw_name or "").strip()
    if name.startswith("อำเภอ"):
        return name.replace("อำเภอ", "", 1).strip()
    if name.startswith("ท้องถิ่นเขต"):
        return name.replace("ท้องถิ่นเขต", "", 1).strip()
    return name
