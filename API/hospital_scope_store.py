import os
import sqlite3
import unicodedata

try:
    from hdc_population_store import get_hdc_amphur_population
except ImportError:
    from API.hdc_population_store import get_hdc_amphur_population

try:
    from amphur_population_store import get_amphur_population
except ImportError:
    from API.amphur_population_store import get_amphur_population

BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")


def _normalize_lookup_key(value: str | None) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


HOSPITAL_SCOPE_SEED = [
    {
        "hospital_name": "นครพิงค์",
        "lookup_unit_name": "นครพิงค์",
        "preferred_unit_type_label": "รพศ.",
        "province_code": "50",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "province",
        "clinical_scope_note": "รพศ. ดูแลการรักษาระดับตติยภูมิทั้งจังหวัดเป็นหลัก",
    },
    {
        "hospital_name": "ลำพูน",
        "lookup_unit_name": "ลำพูน",
        "preferred_unit_type_label": "รพท.",
        "province_code": "51",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "รพท. ดูแลเคสเกินศักยภาพระดับอำเภอในเครือข่ายส่งต่อรอบโรงพยาบาล",
    },
    {
        "hospital_name": "ลำปาง",
        "lookup_unit_name": "ลำปาง",
        "preferred_unit_type_label": "รพศ.",
        "province_code": "52",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "province",
        "clinical_scope_note": "รพศ. ดูแลการรักษาระดับตติยภูมิทั้งจังหวัดเป็นหลัก",
    },
    {
        "hospital_name": "แพร่",
        "lookup_unit_name": "แพร่",
        "preferred_unit_type_label": "รพท.",
        "province_code": "54",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "รพท. ดูแลเคสเกินศักยภาพระดับอำเภอในเครือข่ายส่งต่อรอบโรงพยาบาล",
    },
    {
        "hospital_name": "น่าน",
        "lookup_unit_name": "น่าน",
        "preferred_unit_type_label": "รพท.",
        "province_code": "55",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "รพท. ดูแลเคสเกินศักยภาพระดับอำเภอในเครือข่ายส่งต่อรอบโรงพยาบาล",
    },
    {
        "hospital_name": "พะเยา",
        "lookup_unit_name": "พะเยา",
        "preferred_unit_type_label": "รพท.",
        "province_code": "56",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "รพท. ดูแลเคสเกินศักยภาพระดับอำเภอในเครือข่ายส่งต่อรอบโรงพยาบาล",
    },
    {
        "hospital_name": "เชียงคำ",
        "lookup_unit_name": "เชียงคำ",
        "preferred_unit_type_label": "รพท.",
        "province_code": "56",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "network_zone",
        "clinical_scope_note": "รพท. ดูแลเคสเกินศักยภาพระดับอำเภอในเครือข่ายส่งต่อรอบโรงพยาบาล",
    },
    {
        "hospital_name": "เชียงรายประชานุเคราะห์",
        "lookup_unit_name": "เชียงรายประชานุเคราะห์",
        "preferred_unit_type_label": "รพศ.",
        "province_code": "57",
        "pp_scope_type": "amphur",
        "clinical_scope_type": "province",
        "clinical_scope_note": "รพศ. ดูแลการรักษาระดับตติยภูมิทั้งจังหวัดเป็นหลัก",
    },
]


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_scope_schema(db_path: str | None = None):
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS hospital_scope_config (
            hospital_name TEXT PRIMARY KEY,
            unit_id TEXT,
            lookup_unit_name TEXT NOT NULL,
            preferred_unit_type_label TEXT,
            province_code TEXT NOT NULL,
            province_name_th TEXT,
            home_amphur_code TEXT,
            home_amphur_name TEXT,
            pp_scope_type TEXT NOT NULL DEFAULT 'amphur',
            pp_scope_code TEXT,
            pp_scope_name TEXT,
            pp_population_total INTEGER,
            pp_population_source TEXT,
            pp_population_reference_year INTEGER,
            clinical_scope_type TEXT NOT NULL,
            clinical_scope_code TEXT,
            clinical_scope_name TEXT,
            clinical_scope_note TEXT,
            unit_type_label TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    existing_columns = {row["name"] for row in cur.execute("PRAGMA table_info(hospital_scope_config)").fetchall()}
    if "pp_population_reference_year" not in existing_columns:
        cur.execute("ALTER TABLE hospital_scope_config ADD COLUMN pp_population_reference_year INTEGER")
    _seed_scope_config(cur)
    conn.commit()
    conn.close()


def _pick_unit_row(cur: sqlite3.Cursor, lookup_unit_name: str, province_code: str, preferred_unit_type_label: str):
    strategies = [
        (
            """
            SELECT unit_id, unit_name, unit_type_label, province_code, amphur_code, amphur_name
            FROM organizational_unit
            WHERE unit_name = ?
              AND province_code = ?
              AND unit_type_label = ?
            LIMIT 1
            """,
            (lookup_unit_name, province_code, preferred_unit_type_label),
        ),
        (
            """
            SELECT unit_id, unit_name, unit_type_label, province_code, amphur_code, amphur_name
            FROM organizational_unit
            WHERE unit_name = ?
              AND province_code = ?
            ORDER BY CASE unit_type_label
                WHEN 'รพศ.' THEN 1
                WHEN 'รพท.' THEN 2
                WHEN 'รพช.' THEN 3
                ELSE 9
            END
            LIMIT 1
            """,
            (lookup_unit_name, province_code),
        ),
        (
            """
            SELECT unit_id, unit_name, unit_type_label, province_code, amphur_code, amphur_name
            FROM organizational_unit
            WHERE unit_name LIKE ?
              AND province_code = ?
              AND unit_type_label = ?
            ORDER BY LENGTH(unit_name), unit_name
            LIMIT 1
            """,
            (f"%{lookup_unit_name}%", province_code, preferred_unit_type_label),
        ),
        (
            """
            SELECT unit_id, unit_name, unit_type_label, province_code, amphur_code, amphur_name
            FROM organizational_unit
            WHERE unit_name LIKE ?
              AND province_code = ?
            ORDER BY CASE unit_type_label
                WHEN 'รพศ.' THEN 1
                WHEN 'รพท.' THEN 2
                WHEN 'รพช.' THEN 3
                ELSE 9
            END, LENGTH(unit_name), unit_name
            LIMIT 1
            """,
            (f"%{lookup_unit_name}%", province_code),
        ),
    ]
    for sql, params in strategies:
        row = cur.execute(sql, params).fetchone()
        if row:
            return row
    return None


def _pick_population(cur: sqlite3.Cursor, row: sqlite3.Row) -> tuple[int | None, str, int | None]:
    hdc_amphur_population = get_hdc_amphur_population(
        province_code=row["province_code"],
        amphur_code=row["amphur_code"],
    )
    if hdc_amphur_population and hdc_amphur_population.get("total_population"):
        return (
            int(hdc_amphur_population["total_population"]),
            "verified_amphur_population_hdc",
            int(hdc_amphur_population.get("reference_year_be") or 0) or None,
        )

    verified_amphur_population = get_amphur_population(
        province_code=row["province_code"],
        amphur_code=row["amphur_code"],
    )
    if verified_amphur_population and verified_amphur_population.get("total_population"):
        return (
            int(verified_amphur_population["total_population"]),
            "verified_amphur_population_dopa",
            int(verified_amphur_population.get("reference_year_be") or 0) or None,
        )

    direct_population = cur.execute(
        """
        SELECT total_population
        FROM population_data
        WHERE unit_id = ?
        ORDER BY reference_year DESC
        LIMIT 1
        """,
        (row["unit_id"],),
    ).fetchone()
    if direct_population and direct_population["total_population"]:
        return int(direct_population["total_population"]), "unit_population_proxy", None

    amphur_population = cur.execute(
        """
        SELECT pd.total_population
        FROM organizational_unit ou
        JOIN population_data pd ON pd.unit_id = ou.unit_id
        WHERE ou.province_code = ?
          AND ou.amphur_code = ?
          AND ou.unit_type_label = 'สสอ.'
        ORDER BY pd.reference_year DESC
        LIMIT 1
        """,
        (row["province_code"], row["amphur_code"]),
    ).fetchone()
    if amphur_population and amphur_population["total_population"]:
        return int(amphur_population["total_population"]), "district_office_proxy", None

    return None, "missing", None


def _seed_scope_config(cur: sqlite3.Cursor):
    for item in HOSPITAL_SCOPE_SEED:
        row = _pick_unit_row(
            cur,
            lookup_unit_name=item["lookup_unit_name"],
            province_code=item["province_code"],
            preferred_unit_type_label=item["preferred_unit_type_label"],
        )
        if not row:
            continue

        province_row = cur.execute(
            "SELECT province_name_th FROM provinces WHERE province_code = ? LIMIT 1",
            (row["province_code"],),
        ).fetchone()
        population_total, population_source, population_reference_year = _pick_population(cur, row)
        clinical_scope_code = row["province_code"] if item["clinical_scope_type"] == "province" else row["amphur_code"]
        clinical_scope_name = (
            province_row["province_name_th"]
            if item["clinical_scope_type"] == "province" and province_row
            else row["amphur_name"]
        )
        cur.execute(
            """
            INSERT INTO hospital_scope_config (
                hospital_name, unit_id, lookup_unit_name, preferred_unit_type_label,
                province_code, province_name_th, home_amphur_code, home_amphur_name,
                pp_scope_type, pp_scope_code, pp_scope_name, pp_population_total, pp_population_source, pp_population_reference_year,
                clinical_scope_type, clinical_scope_code, clinical_scope_name, clinical_scope_note, unit_type_label, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(hospital_name) DO UPDATE SET
                unit_id=excluded.unit_id,
                lookup_unit_name=excluded.lookup_unit_name,
                preferred_unit_type_label=excluded.preferred_unit_type_label,
                province_code=excluded.province_code,
                province_name_th=excluded.province_name_th,
                home_amphur_code=excluded.home_amphur_code,
                home_amphur_name=excluded.home_amphur_name,
                pp_scope_type=excluded.pp_scope_type,
                pp_scope_code=excluded.pp_scope_code,
                pp_scope_name=excluded.pp_scope_name,
                pp_population_total=excluded.pp_population_total,
                pp_population_source=excluded.pp_population_source,
                pp_population_reference_year=excluded.pp_population_reference_year,
                clinical_scope_type=excluded.clinical_scope_type,
                clinical_scope_code=excluded.clinical_scope_code,
                clinical_scope_name=excluded.clinical_scope_name,
                clinical_scope_note=excluded.clinical_scope_note,
                unit_type_label=excluded.unit_type_label,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                item["hospital_name"],
                row["unit_id"],
                item["lookup_unit_name"],
                item["preferred_unit_type_label"],
                row["province_code"],
                province_row["province_name_th"] if province_row else row["province_code"],
                row["amphur_code"],
                row["amphur_name"],
                item["pp_scope_type"],
                row["amphur_code"],
                row["amphur_name"],
                population_total,
                population_source,
                population_reference_year,
                item["clinical_scope_type"],
                clinical_scope_code,
                clinical_scope_name,
                item["clinical_scope_note"],
                row["unit_type_label"],
            ),
        )


def get_hospital_scope(hospital_name: str, db_path: str | None = None) -> dict | None:
    build_scope_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM hospital_scope_config ORDER BY province_code, hospital_name"
    ).fetchall()
    conn.close()
    lookup = _normalize_lookup_key(hospital_name)
    for row in rows:
        payload = dict(row)
        if _normalize_lookup_key(payload.get("hospital_name")) == lookup:
            return payload
    return None


def list_hospital_scopes(db_path: str | None = None) -> list[dict]:
    build_scope_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM hospital_scope_config ORDER BY province_code, hospital_name"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
