import requests
from bs4 import BeautifulSoup
import re
import pandas as pd
import time
import urllib3
import os
import io

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://cmi.maewanghospital.go.th/web/index.php"

def get_indicators():
    print("[1] Fetching all available Performance Indicators (Categories A-H)...")
    url = f"{BASE_URL}?r=report%2Fanalysis"
    r = requests.get(url, verify=False)
    soup = BeautifulSoup(r.text, 'html.parser')
    
    indicators = {}
    for a in soup.find_all('a', href=True):
        match = re.search(r'id=([A-Z]\d+)', a['href'])
        if match:
            ind_id = match.group(1)
            title = a.get_text(strip=True)
            if not title and a.find_parent('div'):
                title = a.find_parent('div').get_text(strip=True)
            indicators[ind_id] = title
    
    print(f"    Found {len(indicators)} indicators.")
    return indicators

def fetch_indicator_data(ind_id, ind_name, level):
    url = f"{BASE_URL}?r=report%2Fdrgindexreport&id={ind_id}&splevel={level}"
    try:
        r = requests.get(url, verify=False, timeout=10)
        tables = pd.read_html(io.StringIO(r.text))
        if tables:
            df = tables[0]
            # Print columns for debugging if it doesn't match expectation
            # Expecting: Unnamed:0, ชื่อจังหวัด, ระดับ, สถานพยาบาล, Numerator, Denominator, ร้อยละ
            
            # Clean up the dataframe
            # Drop the first column (Unnamed: 0 or the icon column)
            if df.columns[0].startswith('Unnamed'):
                df = df.iloc[:, 1:]
                
            # Now columns should be loosely: จังหวัด, ระดับ, โรงพยาบาล, num, denom, ร้อยละ
            # Sometimes 'ชื่อจังหวัด' might not exist if they changed the view, but usually it's length 6
            if len(df.columns) >= 6:
                df = df.iloc[:, :6] # Take only first 6
                df.columns = ['province', 'level', 'hospital_name', 'numerator', 'denominator', 'percentage']
                df['indicator_id'] = ind_id
                df['indicator_name'] = ind_name
                df['splevel'] = level
                
                # Extract actual codes and names using regex
                # Example: "10713 โรงพยาบาลนครพิงค์" -> extract "10713" and "โรงพยาบาลนครพิงค์"
                df['facility_id'] = df['hospital_name'].str.extract(r'^(\d+)')
                df['hospital_name'] = df['hospital_name'].str.replace(r'^\d+\s+', '', regex=True)
                
                return df
            else:
                print(f"Warning: {ind_id} {level} has unexpected columns: {df.columns.tolist()}")
    except Exception as e:
        print(f"Error fetching {ind_id} level {level}: {e}")
    return None

def run_scraper(limit=None):
    indicators = get_indicators()
    if limit:
        indicators = {k: indicators[k] for k in sorted(list(indicators))[:limit]}
        
    all_data = []
    
    # Sort nicely: A01, A02 ... H99
    sorted_ids = sorted(indicators.keys())
    
    for i, ind_id in enumerate(sorted_ids):
        title = indicators[ind_id][:40].replace('\n', '').strip()
        print(f"[{i+1}/{len(indicators)}] Fetching {ind_id}: {title}...")
        
        df_a = fetch_indicator_data(ind_id, indicators[ind_id], 'A')
        if df_a is not None and not df_a.empty:
            all_data.append(df_a)
            
        df_s = fetch_indicator_data(ind_id, indicators[ind_id], 'S')
        if df_s is not None and not df_s.empty:
            all_data.append(df_s)
            
        time.sleep(0.3)
        
    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
        print(f"\n[DONE] Scraped {len(final_df)} rows of data.")
        
        out_dir = 'C:/HR_blueprint/hr_blueprint_dashboard/API/data'
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(out_dir, 'cmi_performance.csv')
        final_df.to_csv(out_file, index=False, encoding='utf-8-sig')
        print(f"Saved to {out_file}")
    else:
        print("No data scraped!")

if __name__ == '__main__':
    run_scraper()
