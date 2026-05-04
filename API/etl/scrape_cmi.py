import os, sys
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

"""
CMI Web Scraper V3 — ดึงข้อมูลตัวชี้วัด Performance A-H + Service Plan
ระบบ CMI เขตสุขภาพที่ 1 (cmi.maewanghospital.go.th)

ใช้ pandas.read_html เป็นหลักในการ parse ตาราง

วิธีใช้:
  python scrape_cmi.py                  # Performance A-H ทั้งหมด
  python scrape_cmi.py --sp-only        # Service Plan ทั้งหมด
  python scrape_cmi.py --all            # ทั้งหมด (ใช้เวลานาน ~3 นาที)
  python scrape_cmi.py --id A01         # เฉพาะตัวชี้วัด A01
  python scrape_cmi.py --level A        # กรองเฉพาะ รพ.ระดับ A

Output: cmi_scraped_data.csv
"""

import requests
import pandas as pd
import re
import time
import argparse
from datetime import datetime

BASE_URL = "https://cmi.maewanghospital.go.th/web/index.php"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DELAY = 0.8

PERF_IDS = [
    'A01','A02','A03','A04','A05','A06','A07','A08','A09',
    'A10','A11','A12','A13','A14','A15','A16','A17',
    'B01','B02','B03','B04','B05','B06','B07',
    'C01','C02','C03','C04','C05','C06','C07','C08','C09',
    'C10','C11','C12','C13','C14',
    'D01','D02','D03','D04','D05','D06',
    'E01','E02','E03',
    'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12',
    'G01','G02','G03','G04',
    'H01','H02',
]

SP_IDS = [
    'DH0101','DH0102','DH0110','DH0111','DH0112','DH0114',
    'DH0115','DH0116','DH0117','DH0118','DH0201','DH0203','DH0204','DH0205',
    'BN0001','DN0301','DN0302','DN0303','DN0304','DN0305','DN0306','DN0307',
    'DC0401','DC0403','DC0404','DC0405','DC0406','DC0407','DC0408','DC0501',
    'CM0202','CM0203','CM0204','CM0206','CM0207','CM0208','CM0209','CM0210','CM0211','NB0101',
    'DN0100','DN0101','DN01011','DN01012','DN0108','DN0109',
    'DN0120','DN0121','DN0122','DN0130','DN0131','DN0132',
    'DN0140','DN0141','DN0142','DN0142D','DN0150','DN0151',
    'DG0201','DG0202','DG0203','DG0204','DG0205','DG02051','DG0206','DG02061','LC0001',
    'CI0101','CI01011','CI0102','CI01021','DR0101',
    'PE0101','PE01011','PE01012','PE0102','PE0103','PE0103D',
    'DO0205','DO0206','DO0210','DO02101','DO0211','DO0304',
    'CM0100','CM0101','CM0104','CM0105','CM0107','CM0109','CM0110','CM0117',
    'EYE0101','PS0001','DR0303','DR0402','DR0403','DR0404',
    'CG0103','DG0100','DG0102','DG0103','DC0300','DC0301',
    'RH0101','DC0107','ODS0101','ODS0201','MIS01',
    'IM0101','IM0102','IM0201','IM0202','IM0301','IM0302','IM0401','IM0402',
    'FX6001','FX6002','FX60021','FX60022','FX6003','FX6004','FX60041','FX6005','FX60051','FX7001',
]


def build_url(indicator_id, category='Performance', level=None):
    """สร้าง URL สำหรับดึงข้อมูล"""
    if category == 'Performance':
        url = f"{BASE_URL}?r=report/drgindexreport&id={indicator_id}"
    else:
        url = f"{BASE_URL}?r=service/index&co_thip_new={indicator_id}"
    if level:
        url += f"&level={level}"
    return url


_session = None

def get_session():
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8',
        })
    return _session


def scrape_one(indicator_id, category='Performance', level=None):
    """ดึง + parse ตัวชี้วัดหนึ่งตัว คืน list of dicts"""
    url = build_url(indicator_id, category, level)
    session = get_session()

    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        resp.encoding = 'utf-8'
        html = resp.text
        from io import StringIO
        dfs = pd.read_html(StringIO(html))
    except Exception as e:
        return [], str(e)

    results = []
    
    for tbl_idx, tbl in enumerate(dfs):
        if len(tbl) < 1 or len(tbl.columns) < 3:
            continue

        cols = [str(c).strip() for c in tbl.columns]
        
        # ค้นหาตาราง hospital-level: 
        # 1. มีคอลัมน์ 'ระดับ' + 'สถานพยาบาล' (Performance)
        # 2. หรือมีข้อมูลรหัส 5 ตัว เช่น 10713
        is_hospital_table = False
        hosp_col_idx = None
        level_col_idx = None
        
        for i, c in enumerate(cols):
            if 'สถานพยาบาล' in c or 'สถานบริการ' in c or 'หน่วยบริการ' in c:
                hosp_col_idx = i
                is_hospital_table = True
            if 'ระดับ' in c:
                level_col_idx = i

        # ลองเช็คว่ามี 5-digit hospital code ไหม
        if not is_hospital_table:
            for _, row in tbl.head(5).iterrows():
                for val in row.values:
                    sval = str(val).strip()
                    if re.match(r'^\d{5}\s', sval):
                        is_hospital_table = True
                        break
                if is_hospital_table:
                    break

        if not is_hospital_table:
            continue

        # Parse each row
        for _, row in tbl.iterrows():
            rec = {
                'indicator_id': indicator_id,
                'category': category,
                'table_idx': tbl_idx,
            }

            # Map all columns
            for i, c in enumerate(cols):
                val = str(row.iloc[i]).strip() if pd.notna(row.iloc[i]) else ''
                if val == 'nan':
                    val = ''
                rec[c] = val

            # Extract hospital code + name
            hosp_text = ''
            if hosp_col_idx is not None:
                hosp_text = str(row.iloc[hosp_col_idx]).strip()
            else:
                # ลองหาใน cell ที่มี 5-digit code
                for val in row.values:
                    sval = str(val).strip()
                    if re.match(r'^\d{5}\s', sval):
                        hosp_text = sval
                        break

            code_match = re.match(r'^(\d{5})\s+(.+)', hosp_text)
            if code_match:
                rec['hospital_code'] = code_match.group(1)
                rec['hospital_name'] = code_match.group(2).strip()
            else:
                rec['hospital_code'] = ''
                rec['hospital_name'] = hosp_text

            results.append(rec)

    return results, None


def main():
    parser = argparse.ArgumentParser(description='CMI Scraper V3')
    parser.add_argument('--perf-only', action='store_true')
    parser.add_argument('--sp-only', action='store_true')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--id', type=str)
    parser.add_argument('--level', type=str, default=None)
    parser.add_argument('--output', type=str, default=None)
    parser.add_argument('--delay', type=float, default=DELAY)
    args = parser.parse_args()

    out = args.output or os.path.join(OUTPUT_DIR, 'cmi_scraped_data.csv')

    print("=" * 60)
    print("  CMI Web Scraper V3")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Level: {args.level or 'ALL'}")
    print(f"  Output: {out}")
    print("=" * 60)

    perf, sp = [], []
    if args.id:
        if args.id in PERF_IDS:
            perf = [args.id]
        elif args.id in SP_IDS:
            sp = [args.id]
        else:
            perf = [args.id]
    elif args.sp_only:
        sp = SP_IDS
    elif args.all:
        perf = PERF_IDS
        sp = SP_IDS
    else:
        perf = PERF_IDS

    total = len(perf) + len(sp)
    i = 0
    all_data = []
    ok, fail = 0, 0

    for pid in perf:
        i += 1
        print(f"  [{i}/{total}] PERF {pid}", end=' ', flush=True)
        rows, err = scrape_one(pid, 'Performance', args.level)
        if err:
            print(f"ERR: {err[:50]}")
            fail += 1
        elif rows:
            print(f"-> {len(rows)} rows")
            all_data.extend(rows)
            ok += 1
        else:
            print("-> 0 rows")
            fail += 1
        time.sleep(args.delay)

    for sid in sp:
        i += 1
        print(f"  [{i}/{total}] SP {sid}", end=' ', flush=True)
        rows, err = scrape_one(sid, 'ServicePlan', args.level)
        if err:
            print(f"ERR: {err[:50]}")
            fail += 1
        elif rows:
            print(f"-> {len(rows)} rows")
            all_data.extend(rows)
            ok += 1
        else:
            print("-> 0 rows")
            fail += 1
        time.sleep(args.delay)

    if all_data:
        df = pd.DataFrame(all_data)
        # Reorder columns: put key cols first
        key_cols = ['indicator_id','category','hospital_code','hospital_name']
        other_cols = [c for c in df.columns if c not in key_cols]
        df = df[key_cols + other_cols]
        df.to_csv(out, index=False, encoding='utf-8-sig')
        
        print(f"\n{'='*60}")
        print(f"  SAVED: {out}")
        print(f"  Rows: {len(df)}")
        print(f"  Indicators OK: {ok} | Empty/Error: {fail}")
        print(f"  Unique indicators: {df['indicator_id'].nunique()}")
        has_hosp = df[df['hospital_code'] != '']
        print(f"  Hospitals: {has_hosp['hospital_name'].nunique()}")
        print(f"  Done: {datetime.now().strftime('%H:%M:%S')}")
        print(f"{'='*60}")
    else:
        print("\n  NO DATA")


if __name__ == '__main__':
    main()
