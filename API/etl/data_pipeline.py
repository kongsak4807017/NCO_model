import pandas as pd
import os
import json

def run_pipeline(workforce_path, needs_path, cmi_path, output_path):
    print("Running Regional/General Hospital Data Merge Pipeline...")
    
    if os.path.exists(workforce_path):
        workforce = pd.read_csv(workforce_path)
    else:
        print("Workforce data not found!")
        return
        
    if os.path.exists(needs_path):
        needs = pd.read_csv(needs_path)
    else:
        print("Needs data not found!")
        return
        
    if os.path.exists(cmi_path):
        cmi_data = pd.read_csv(cmi_path)
    else:
        print("CMI Performance data not found!")
        return

    # 1. Merge Workforce vs Needs on facility_id
    workforce['facility_id'] = workforce['facility_id'].astype(str)
    needs['facility_id'] = needs['facility_id'].astype(str)
    cmi_data['facility_id'] = cmi_data['facility_id'].astype(str).str.split('.').str[0]
    
    final_df = pd.merge(needs, workforce, on='facility_id', how='left').fillna(0)
    
    HOSP_NAMES = {
        '10713': 'โรงพยาบาลนครพิงค์', 
        '10672': 'โรงพยาบาลลำปาง',
        '10674': 'โรงพยาบาลเชียงรายประชานุเคราะห์',
        '10714': 'โรงพยาบาลลำพูน',
        '10715': 'โรงพยาบาลแพร่',
        '10716': 'โรงพยาบาลน่าน',
        '10717': 'โรงพยาบาลพะเยา',
        '10719': 'โรงพยาบาลเชียงคำ'
    }
    
    final_df = final_df.groupby('facility_id').max().reset_index()
    final_df['unit_name'] = final_df['facility_id'].map(HOSP_NAMES)
    
    # Format Headcounts as Integers
    for col in ['doctor_hc', 'nurse_hc', 'pharmacist_hc', 'hc_total']:
        if col in final_df.columns:
            final_df[col] = final_df[col].fillna(0).astype(int)
    
    for col in ['doctor_fte', 'nurse_fte', 'pharmacist_fte', 'fte_total']:
        if col in final_df.columns:
            final_df[col] = final_df[col].fillna(0.0).round(2)
    
    # 2. Re-calculate WCI separated by profession (Using FTE for capacity)
    final_df['WCI_doc'] = (final_df['doctor_fte'] / (final_df['pop_total'] + 1)) * 10000
    final_df['WCI_nur'] = (final_df['nurse_fte'] / (final_df['pop_total'] + 1)) * 10000
    final_df['WCI_pha'] = (final_df['pharmacist_fte'] / (final_df['pop_total'] + 1)) * 10000
    final_df['WCI_total'] = (final_df['fte_total'] / (final_df['pop_total'] + 1)) * 10000
    
    wci_max = final_df['WCI_total'].max() if final_df['WCI_total'].max() > 0 else 1
    final_df['WCI_norm'] = (final_df['WCI_total'] / wci_max) * 100
    final_df['WCI'] = final_df['WCI_total']
    
    final_df['GI'] = final_df['HNI'] - final_df['WCI_norm']
    final_df['Priority'] = final_df['GI'] * final_df['SGI'] * (1 - final_df['HSI'])
    final_df = final_df.sort_values('Priority', ascending=False)
    
    # 3. Create a JSON representation of CMI Data grouped by facility_id
    # We don't want to wide-pivot 64 columns in the CSV, instead we can nest it into a JSON column or separate file
    # We will nest it as a JSON string inside the final_df
    def aggregate_cmi(fid):
        subset = cmi_data[cmi_data['facility_id'] == fid]
        if subset.empty: return "{}"
        result = {}
        for _, row in subset.iterrows():
            result[row['indicator_id']] = {
                "name": row['indicator_name'],
                "num": row['numerator'],
                "denom": row['denominator'],
                "pct": row['percentage']
            }
        return json.dumps(result, ensure_ascii=False)

    final_df['cmi_performance_json'] = final_df['facility_id'].apply(aggregate_cmi)
    
    final_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"Pipeline complete. Generated final dataset at: {output_path}")

if __name__ == "__main__":
    base_dir = "C:/HR_blueprint/hr_blueprint_dashboard"
    run_pipeline(
        f"{base_dir}/API/etl/fact_workforce_regional.csv",
        f"{base_dir}/API/etl/fact_health_need_regional.csv",
        f"{base_dir}/API/data/cmi_performance.csv",
        f"{base_dir}/API/final_dataset_regional.csv"
    )
