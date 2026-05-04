import sqlite3
import pandas as pd
import requests
import uuid
import random

def seed_database(db_path):
    print("1. Fetching Amphoe data from Thailand.js Database (Open Data)...")
    try:
        resp = requests.get('https://raw.githubusercontent.com/earthchie/jquery.Thailand.js/master/jquery.Thailand.js/database/raw_database/raw_database.json')
        data = resp.json()
    except Exception as e:
        print(f"Failed to fetch data: {e}")
        return

    amphoe_map = {}
    for d in data:
        if 'amphoe_code' in d and 'amphoe' in d:
            code = str(d['amphoe_code']).zfill(4)
            amphoe_map[code] = d['amphoe']
            
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # 2. Add amphur_name column safely
    try:
        cur.execute("ALTER TABLE organizational_unit ADD COLUMN amphur_name VARCHAR(100)")
    except sqlite3.OperationalError:
        pass # Column already exists
        
    cur.execute("SELECT unit_id, amphur_code FROM organizational_unit")
    units = cur.fetchall()
    
    print("2. Enhancing organizational_unit with correct Thai Amphur Names...")
    updates = 0
    for uid, ac in units:
        if not ac: continue
        clean_ac = str(ac).replace('_', '').zfill(4)
        aname = amphoe_map.get(clean_ac, None)
        if aname:
            # Optional: normalize prefix
            aname = aname.replace('อำเภอ', '').strip()
            cur.execute("UPDATE organizational_unit SET amphur_name=?, amphur_code=? WHERE unit_id=?", (aname, clean_ac, uid))
            updates += 1
            
    print(f"Updated {updates} units with correct district mapped names.")
    
    # 3. Seed Workload and Population Data
    print("3. Seeding Mock Population Data and Workload...")
    cur.execute("DELETE FROM population_data")
    cur.execute("DELETE FROM workload")
    cur.execute("DELETE FROM disease_burden")
    
    # Instead of random per unit, we should generate realistic data scaled by number of personnel
    cur.execute("""
        SELECT u.unit_id, count(p.personnel_id) 
        FROM organizational_unit u 
        LEFT JOIN assignment a ON u.unit_id = a.unit_id 
        LEFT JOIN personnel p ON a.personnel_id = p.personnel_id 
        GROUP BY u.unit_id
    """)
    unit_stats = cur.fetchall()
    
    inserted_pop = 0
    for uid, p_count in unit_stats:
        if p_count == 0:
            # Minimal mapping for empty units
            p_count = random.randint(5, 50)
            
        # Realistic scale: ~300 pop per 1 personnel as a loose proxy
        base_pop = int(p_count * random.uniform(200, 400))
        if base_pop < 5000: base_pop = random.randint(5000, 30000)
        
        pop_60 = int(base_pop * random.uniform(0.15, 0.35))
        
        pop_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO population_data (
                population_data_id, unit_id, reference_year, 
                total_population, population_60_plus
            ) VALUES (?, ?, ?, ?, ?)
        """, (pop_id, uid, 2026, base_pop, pop_60))
        
        # Workload
        wl_id = str(uuid.uuid4())
        cmi = round(random.uniform(0.8, 2.5), 2)
        mental = int(base_pop * random.uniform(0.05, 0.15))
        cur.execute("""
            INSERT INTO workload (
                workload_id, unit_id, period_year, 
                total_workload_score, mental_health_visits
            ) VALUES (?, ?, ?, ?, ?)
        """, (wl_id, uid, 2026, cmi, mental))
        
        # Disease Burden
        db_id = str(uuid.uuid4())
        mortality = int(base_pop * random.uniform(0.005, 0.015))
        chronic = int(base_pop * random.uniform(0.2, 0.4))
        cur.execute("""
            INSERT INTO disease_burden (
                burden_id, unit_id, reference_year, 
                mortality_count, prevalence_count, disease_category
            ) VALUES (?, ?, ?, ?, ?, 'chronic')
        """, (db_id, uid, 2026, mortality, chronic))
        
        inserted_pop += 1

    conn.commit()
    conn.close()
    print(f"Successfully seeded Population, Workload, and Disease records for {inserted_pop} units!")

if __name__ == "__main__":
    db_path = "C:/HR_blueprint/hr_blueprint_dashboard/hr_blueprint.db"
    seed_database(db_path)
