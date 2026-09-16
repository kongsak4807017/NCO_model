import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.generate_region1_district_hr_baseline import build_district_rows


POPULATION_ROWS = [
    {
        "province_code": "57",
        "province_name_th": "เชียงราย",
        "amphur_code": "5701",
        "amphur_name_th": "เมืองเชียงราย",
        "reference_year_be": 2567,
        "male_total": 100,
        "female_total": 120,
        "total_population": 220,
        "house_total": 80,
    }
]


class DistrictBaselineGeneratorTest(unittest.TestCase):
    def test_population_only_row_is_explicitly_marked_without_hr_snapshot(self):
        rows = build_district_rows(POPULATION_ROWS, db_path=None)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertFalse(row["hr_available"])
        self.assertEqual(row["population_by_year"], {"2567": 220})
        self.assertIsNone(row["doctor"])
        self.assertIsNone(row["vacant_all"])

    def test_local_hr_database_is_aggregated_by_district(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "hr.db"
            conn = sqlite3.connect(db_path)
            conn.executescript(
                """
                CREATE TABLE organizational_unit (
                    unit_id INTEGER PRIMARY KEY,
                    province_code TEXT,
                    amphur_code TEXT,
                    amphur_name TEXT
                );
                CREATE TABLE position (
                    position_id INTEGER PRIMARY KEY,
                    unit_id INTEGER,
                    position_name_th TEXT,
                    position_status TEXT
                );
                CREATE TABLE assignment (
                    assignment_id INTEGER PRIMARY KEY,
                    personnel_id INTEGER,
                    position_id INTEGER,
                    unit_id INTEGER,
                    status TEXT
                );
                CREATE TABLE personnel (
                    personnel_id INTEGER PRIMARY KEY,
                    retirement_date TEXT,
                    is_active INTEGER
                );
                """
            )
            conn.execute("INSERT INTO organizational_unit VALUES (1, '57', '5701', 'เมืองเชียงราย')")
            conn.execute("INSERT INTO position VALUES (1, 1, 'นายแพทย์', 'filled')")
            conn.execute("INSERT INTO position VALUES (2, 1, 'พยาบาลวิชาชีพ', 'vacant')")
            conn.execute("INSERT INTO personnel VALUES (10, '2030-01-01', 1)")
            conn.execute("INSERT INTO assignment VALUES (1, 10, 1, 1, 'active')")
            conn.commit()
            conn.close()

            rows = build_district_rows(POPULATION_ROWS, db_path=db_path)
            row = rows[0]
            self.assertTrue(row["hr_available"])
            self.assertEqual(row["doctor"], 1)
            self.assertEqual(row["nurse"], 0)
            self.assertEqual(row["vacant_all"], 1)
            self.assertEqual(row["vacant_nurse"], 1)
            self.assertGreaterEqual(row["retire_5y_all"], 1)


if __name__ == "__main__":
    unittest.main()
