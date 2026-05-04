import sqlite3
import pandas as pd
import os

def extract_all_data(db_path, out_dir):
    print("Starting Regional/General Hospital ETL Pipeline (String Matching fallback)...")
    
    HOSPITAL_MAPPING = {
        'นครพิงค์': '10713', 
        'ลำปาง': '10672',
        'เชียงรายประชานุเคราะห์': '10674',
        'ลำพูน': '10714',
        'แพร่': '10715',
        'น่าน': '10716',
        'พะเยา': '10717',
        'เชียงคำ': '10719',
    }
    
    conn = sqlite3.connect(db_path)
    
    # 1. Extract All Active Workforce
    q_hr = """
    SELECT 
        u.unit_id,
        u.unit_name,
        u.province_code,
        u.amphur_code,
        p.position_name_th,
        a.fte_percentage,
        a.personnel_id
    FROM assignment a
    JOIN organizational_unit u ON a.unit_id = u.unit_id
    JOIN position p ON a.position_id = p.position_id
    WHERE (a.status = 'active' OR a.status IS NULL)
    """
    df_hr = pd.read_sql(q_hr, conn)
    
    df_hr['amphur_code'] = df_hr['amphur_code'].astype(str).str.replace(r'\D', '', regex=True)
    df_hr['unit_name'] = df_hr['unit_name'].fillna('ไม่ทราบชื่อ').str.strip()
    
    # Find matching facility_id based on unit_name exactly
    df_hr['facility_id'] = df_hr['unit_name'].map(HOSPITAL_MAPPING)
    # Filter only matched
    df_hr = df_hr.dropna(subset=['facility_id']).copy()
    
    # Categorize Professions
    df_hr['category'] = 'other'
    df_hr.loc[df_hr['position_name_th'].str.contains('แพทย์', na=False) & ~df_hr['position_name_th'].str.contains('ทันต|สัตว', na=False), 'category'] = 'doctor'
    df_hr.loc[df_hr['position_name_th'].str.contains('พยาบาล', na=False), 'category'] = 'nurse'
    df_hr.loc[df_hr['position_name_th'].str.contains('เภสัช', na=False), 'category'] = 'pharmacist'
    
    df_hr['fte_val'] = df_hr['fte_percentage'].fillna(100.0) / 100.0
    
    pivot_fte = df_hr.groupby(['province_code', 'amphur_code', 'facility_id', 'unit_name', 'category'])['fte_val'].sum().unstack(fill_value=0).reset_index()
    pivot_hc = df_hr.groupby(['province_code', 'amphur_code', 'facility_id', 'unit_name', 'category'])['personnel_id'].nunique().unstack(fill_value=0).reset_index()
    
    for col in ['doctor', 'nurse', 'pharmacist']:
        if col not in pivot_fte.columns: pivot_fte[col] = 0
        if col not in pivot_hc.columns: pivot_hc[col] = 0
        
    pivot_fte = pivot_fte.rename(columns={'doctor': 'doctor_fte', 'nurse': 'nurse_fte', 'pharmacist': 'pharmacist_fte', 'other': 'other_fte'})
    pivot_hc = pivot_hc.rename(columns={'doctor': 'doctor_hc', 'nurse': 'nurse_hc', 'pharmacist': 'pharmacist_hc', 'other': 'other_hc'})
    
    cols_to_merge = ['province_code', 'amphur_code', 'facility_id', 'unit_name']
    pivot = pd.merge(pivot_hc, pivot_fte, on=cols_to_merge)
    
    pivot['fte_total'] = pivot[['doctor_fte', 'nurse_fte', 'pharmacist_fte']].sum(axis=1)
    pivot['hc_total'] = pivot[['doctor_hc', 'nurse_hc', 'pharmacist_hc']].sum(axis=1)
    
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
        
    wf_path = os.path.join(out_dir, "fact_workforce_regional.csv")
    pivot.to_csv(wf_path, index=False, encoding='utf-8-sig')
    
    # 2. Extract Health Needs for Target Hospitals
    q_need = """
    SELECT 
        u.unit_id,
        u.unit_name,
        SUM(p.total_population) as pop_total,
        SUM(p.population_60_plus) as pop_elderly,
        AVG(w.total_workload_score) as cmi_avg,
        SUM(w.mental_health_visits) as mental_visits,
        SUM(db.mortality_count) as mortality_count,
        SUM(db.prevalence_count) as chronic_count
    FROM organizational_unit u
    LEFT JOIN population_data p ON u.unit_id = p.unit_id
    LEFT JOIN workload w ON u.unit_id = w.unit_id
    LEFT JOIN disease_burden db ON u.unit_id = db.unit_id
    GROUP BY u.unit_id, u.unit_name
    """
    df_need = pd.read_sql(q_need, conn)
    conn.close()
    
    df_need['unit_name'] = df_need['unit_name'].fillna('ไม่ทราบ').str.strip()
    df_need['facility_id'] = df_need['unit_name'].map(HOSPITAL_MAPPING)
    df_need = df_need.dropna(subset=['facility_id']).copy()
    
    df_need = df_need[df_need['pop_total'] > 0].copy()
    
    # Calculate health indicators safely
    df_need['elderly_rate'] = (df_need['pop_elderly'] / df_need['pop_total']) * 100
    df_need['chronic_rate'] = (df_need['chronic_count'] / df_need['pop_total']) * 100
    df_need['mental_risk_rate'] = (df_need['mental_visits'] / df_need['pop_total']) * 100
    df_need['mortality_rate'] = (df_need['mortality_count'] / df_need['pop_total']) * 100
    
    for col in ['elderly_rate', 'chronic_rate', 'mental_risk_rate']:
        max_val = df_need[col].max()
        if max_val == 0: max_val = 1
        df_need[col.replace('_rate', '_norm')] = df_need[col] / max_val
        
    if 'mental_risk_norm' not in df_need.columns:
        df_need['mental_risk_norm'] = 0
        
    df_need['risk_norm'] = df_need['mental_risk_norm']
    
    # Ensure columns exist to avoid KeyError if data is fully empty
    for col in ['elderly_norm', 'chronic_norm', 'risk_norm']:
        if col not in df_need.columns:
            df_need[col] = 0
            
    df_need['HNI'] = ((df_need['elderly_norm'] * 0.4) + (df_need['chronic_norm'] * 0.4) + (df_need['risk_norm'] * 0.2)) * 100
    df_need['SGI'] = df_need['cmi_avg'].fillna(1.0)
    df_need['HSI'] = 1 - (df_need['mortality_rate'] / 100)
    
    needs_path = os.path.join(out_dir, "fact_health_need_regional.csv")
    df_need.to_csv(needs_path, index=False, encoding='utf-8-sig')
    
    print(f"Exported Regional Workforce to {wf_path}")
    print(f"Exported Regional Health Needs to {needs_path}")

if __name__ == "__main__":
    extract_all_data(
        "C:/HR_blueprint/hr_blueprint_dashboard/hr_blueprint.db",
        "C:/HR_blueprint/hr_blueprint_dashboard/API/etl"
    )
