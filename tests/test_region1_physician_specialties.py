import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from scripts.build_region1_physician_specialties import build, aggregate_records

CATALOG={"specialties":[
    {"code":"S1","name_th":"อายุรศาสตร์","name_en":"Internal Medicine"},
    {"code":"S2","name_th":"ศัลยศาสตร์","name_en":"Surgery"}
]}

class RegionalSpecialtiesTest(unittest.TestCase):
    def test_raw_identity_dedup_and_privacy(self):
        records=[
          {"employee_id":"D1","name":"สมชาย","surname":"คนดี","line_position_name":"นายแพทย์","province_code":"57","code5":"10674","rev_name":"เชียงรายประชานุเคราะห์","position_specialist_name":"อายุรศาสตร์"},
          {"employee_id":"D1","name":"สมชาย","surname":"คนดี","line_position_name":"นายแพทย์","province_code":"57","code5":"10674","rev_name":"เชียงรายประชานุเคราะห์","position_specialist_name":"อายุรศาสตร์"},
          {"employee_id":"D2","name":"สมหญิง","surname":"คนเก่ง","line_position_name":"นายแพทย์","province_code":"57","code5":"10674","rev_name":"เชียงรายประชานุเคราะห์","highest_specialist_name":"ศัลยศาสตร์"},
          {"employee_id":"D3","name":"A","surname":"B","line_position_name":"พยาบาลวิชาชีพ","province_code":"57","code5":"10674","position_specialist_name":"ศัลยศาสตร์"},
        ]
        result=aggregate_records(records,CATALOG,2569,"hr_personnel")
        r=result["hospitals"][0]
        self.assertEqual(r["total_doctors"],2)
        self.assertEqual(r["mapped_doctors"],2)
        self.assertEqual(r["position_mapped"],1)
        self.assertEqual(r["credential_proxy_mapped"],1)
        self.assertEqual(result["region"]["unique_doctors"],2)
        dumped=json.dumps(result,ensure_ascii=False)
        for value in ["สมชาย","สมหญิง","D1","D2"]:
            self.assertNotIn(value,dumped)
        self.assertEqual(result["checkmd_verified_count"],0)

    def test_unmapped_and_missing_not_zero_specialists(self):
        records=[
          {"employee_id":"D1","line_position_name":"นายแพทย์","province_code":"50","code5":"10713","position_specialist_name":"Unknown X"},
          {"employee_id":"D2","line_position_name":"นายแพทย์","province_code":"50","code5":"10713"},
        ]
        r=aggregate_records(records,CATALOG,2569,"hr_personnel")["hospitals"][0]
        self.assertEqual(r["total_doctors"],2)
        self.assertEqual(r["mapped_doctors"],0)
        self.assertEqual(r["unmapped_doctors"],1)
        self.assertEqual(r["missing_specialty_doctors"],1)

    def test_load_normalized_schema_without_person_names(self):
        with tempfile.TemporaryDirectory() as folder:
          db=Path(folder)/"hr.db"
          con=sqlite3.connect(db)
          con.executescript("""
          CREATE TABLE organizational_unit(unit_id INTEGER,unit_name TEXT,province_code TEXT,code5 TEXT);
          CREATE TABLE position(position_id INTEGER,unit_id INTEGER,position_name_th TEXT,position_specialist_name TEXT,position_status TEXT);
          CREATE TABLE assignment(personnel_id INTEGER,unit_id INTEGER,position_id INTEGER,status TEXT,end_date TEXT,fte_percentage REAL);
          INSERT INTO organizational_unit VALUES(1,'รพ.ทดลอง','56','12345');
          INSERT INTO position VALUES(1,1,'นายแพทย์','อายุรศาสตร์','filled');
          INSERT INTO assignment VALUES(10,1,1,'active',NULL,100);
          INSERT INTO assignment VALUES(11,1,1,'inactive',NULL,100);
          """)
          con.commit();con.close()
          cat=Path(folder)/"cat.json"
          cat.write_text(json.dumps(CATALOG,ensure_ascii=False),encoding="utf-8")
          data=build(db,cat,2569)
          self.assertEqual(data["region"]["unique_doctors"],1)
          self.assertEqual(data["hospitals"][0]["mapped_doctors"],1)
          self.assertTrue(data["source"].endswith("assignment/position/organizational_unit"))

    def test_site_across_province_unique_person(self):
        rows=[
          {"employee_id":"D1","line_position_name":"นายแพทย์","province_code":"57","code5":"10674","position_specialist_name":"อายุรศาสตร์"},
          {"employee_id":"D1","line_position_name":"นายแพทย์","province_code":"50","code5":"10713","position_specialist_name":"อายุรศาสตร์"},
        ]
        data=aggregate_records(rows,CATALOG,2569,"hr_personnel")
        self.assertEqual(data["region"]["unique_doctors"],1)
        self.assertEqual(data["region"]["hospital_assignments"],2)

if __name__ == "__main__":
    unittest.main()
