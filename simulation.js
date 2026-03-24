// NCO Simulation Engine
// Loads data_inputV1.csv and drives the 7-step wizard

let DATA = [];
let HOSPITALS = {};
let currentStep = 0;
let selectedHospital = null;
const TOTAL_STEPS = 8;

// ========== Hospital Config ==========
const HOSP_CONFIG = {
  'นครพิงค์': { province:'เชียงใหม่', level:'A (รพศ.)', color:'#6366f1' },
  'ลำปาง': { province:'ลำปาง', level:'A (รพท.)', color:'#8b5cf6' },
  'เชียงรายประชานุเคราะห์': { province:'เชียงราย', level:'A (รพศ.)', color:'#a78bfa' },
  'น่าน': { province:'น่าน', level:'S (รพท.)', color:'#10b981' },
  'แพร่': { province:'แพร่', level:'S (รพท.)', color:'#14b8a6' },
  'พะเยา': { province:'พะเยา', level:'S (รพท.)', color:'#f59e0b' },
  'ลำพูน': { province:'ลำพูน', level:'S (รพท.)', color:'#f97316' },
  'เชียงคำ': { province:'เชียงราย', level:'M1 (รพท.)', color:'#ec4899' },
};

// Specialty mapping
const SPECIALTY_MAP = {
  'DH0101': { name:'STEMI Mortality', threshold:12, dir:'low', doc:'อายุรแพทย์หัวใจ Interventional', nurse:'พยาบาล CCU / Cath Lab' },
  'DH0102': { name:'AMI Mortality', threshold:10, dir:'low', doc:'อายุรแพทย์หัวใจ', nurse:'พยาบาล CCU' },
  'DN0101': { name:'Stroke Mortality', threshold:15, dir:'low', doc:'อายุรแพทย์ประสาท', nurse:'พยาบาล Stroke Unit' },
  'DN0142': { name:'Ischemic Stroke ได้ rtPA', threshold:5, dir:'high', doc:'อายุรแพทย์ประสาท + ER', nurse:'พยาบาล ER / Stroke Fast Track' },
  'CI0101': { name:'Sepsis Mortality', threshold:30, dir:'low', doc:'อายุรแพทย์โรคติดเชื้อ', nurse:'พยาบาล ICU' },
  'PE0102': { name:'Pneumonia เด็ก Mortality', threshold:3, dir:'low', doc:'กุมารแพทย์ระบบหายใจ', nurse:'พยาบาล PICU' },
  'CM0203': { name:'Neonatal Mortality', threshold:10, dir:'low', doc:'กุมารแพทย์ทารกแรกเกิด', nurse:'พยาบาล NICU' },
  'CM0101': { name:'Maternal Mortality', threshold:70, dir:'low', doc:'สูตินรีแพทย์', nurse:'พยาบาลห้องคลอด' },
  'DC0401': { name:'มะเร็ง Mortality', threshold:15, dir:'low', doc:'อายุรแพทย์มะเร็ง', nurse:'พยาบาลเคมีบำบัด' },
  'DG0201': { name:'ไส้ติ่งทะลุ', threshold:30, dir:'low', doc:'ศัลยแพทย์ทั่วไป', nurse:'พยาบาล ER / OR' },
  'PS0001': { name:'อัตราฆ่าตัวตาย', threshold:5, dir:'low', doc:'จิตแพทย์', nurse:'พยาบาลจิตเวช' },
  'RH0101': { name:'Stroke ได้กายภาพ', threshold:50, dir:'high', doc:'แพทย์เวชศาสตร์ฟื้นฟู', nurse:'นักกายภาพบำบัด' },
};

// ========== Province Prevalence Data (HDC Reference) ==========
// อัตราป่วยต่อแสนประชากร (per 100,000 population) สำหรับ 8 จังหวัดเขต 1
const PROVINCE_PREVALENCE = {
  'เชียงใหม่': { CVD: 3250, Cancer: 1420, DM: 8500, CKD: 4100 },
  'เชียงราย': { CVD: 3100, Cancer: 1350, DM: 8200, CKD: 3900 },
  'ลำปาง': { CVD: 3800, Cancer: 1550, DM: 9200, CKD: 4600 },
  'ลำพูน': { CVD: 3500, Cancer: 1500, DM: 8900, CKD: 4300 },
  'แพร่': { CVD: 3600, Cancer: 1380, DM: 8700, CKD: 4200 },
  'น่าน': { CVD: 2900, Cancer: 1250, DM: 7800, CKD: 3700 },
  'พะเยา': { CVD: 3400, Cancer: 1300, DM: 8400, CKD: 4000 },
  'แม่ฮ่องสอน': { CVD: 2100, Cancer: 950, DM: 6500, CKD: 2800 },
};

// ========== Data Loading ==========
async function loadData() {
  try {
    const resp = await fetch('data_inputV1.csv');
    const text = await resp.text();
    const parsed = Papa.parse(text, { header:true, skipEmptyLines:true });
    DATA = parsed.data;
    processData();
    document.getElementById('dataStatus').textContent = `${DATA.length} rows loaded`;
    document.getElementById('dataStatus').style.background = 'rgba(16,185,129,0.15)';
    buildStepDots();
    renderStep0();
  } catch(e) {
    document.getElementById('dataStatus').textContent = 'Error loading data';
    document.getElementById('dataStatus').style.background = 'rgba(239,68,68,0.15)';
    document.getElementById('dataStatus').style.color = '#ef4444';
    console.error(e);
  }
}

function processData() {
  // Group data by hospital
  HOSPITALS = {};
  const hospNames = Object.keys(HOSP_CONFIG);
  
  DATA.forEach(row => {
    const h = row['โรงพยาบาล'];
    if (!h || !hospNames.includes(h)) return;
    if (!HOSPITALS[h]) HOSPITALS[h] = { population:{}, workforce:{}, hni:{}, cmi:{}, indicators:{} };
    
    const cat = row['หมวดข้อมูล'] || '';
    const indicator = row['ตัวชี้วัด'] || '';
    const val = row['ค่า'];
    
    if (cat.startsWith('ประชากร')) {
      HOSPITALS[h].population[indicator] = parseFloat(val) || 0;
    } else if (cat.startsWith('กำลังคน_แพทย์')) {
      if (!HOSPITALS[h].workforce.doctors) HOSPITALS[h].workforce.doctors = {};
      HOSPITALS[h].workforce.doctors[indicator] = parseFloat(val) || 0;
    } else if (cat.startsWith('กำลังคน_พยาบาล')) {
      if (!HOSPITALS[h].workforce.nurses) HOSPITALS[h].workforce.nurses = {};
      HOSPITALS[h].workforce.nurses[indicator] = parseFloat(val) || 0;
    } else if (cat.startsWith('กำลังคน_เภสัช')) {
      if (!HOSPITALS[h].workforce.pharma) HOSPITALS[h].workforce.pharma = {};
      HOSPITALS[h].workforce.pharma[indicator] = parseFloat(val) || 0;
    } else if (cat.includes('HNI')) {
      HOSPITALS[h].hni[indicator] = parseFloat(val) || 0;
    } else if (cat.startsWith('ค่าจริง_')) {
      // CMI scraped data: indicator format is "A01_ColumnName"
      const parts = indicator.split('_');
      const code = parts[0];
      const colName = parts.slice(1).join('_');
      if (!HOSPITALS[h].indicators[code]) HOSPITALS[h].indicators[code] = {};
      HOSPITALS[h].indicators[code][colName] = val;
    }
  });
}

function getIndicatorValue(hosp, code, colPattern) {
  const ind = HOSPITALS[hosp]?.indicators?.[code];
  if (!ind) return null;
  
  // If specific pattern requested, use it
  if (colPattern) {
    for (const [k,v] of Object.entries(ind)) {
      if (k.includes(colPattern)) return parseFloat(v) || v;
    }
  }
  
  // Priority 1: Look for rate/percentage columns (ร้อยละ, อัตรา, %)
  const rateKeys = ['ร้อยละ', 'อัตรา', 'เปอร์เซ็นต์', 'Rate', 'rate', '%'];
  for (const [k,v] of Object.entries(ind)) {
    if (rateKeys.some(rk => k.includes(rk))) {
      const n = parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  
  // Priority 2: Look for columns that are clearly the main metric
  // Skip metadata columns (ระดับ, สถานพยาบาล, จังหวัด, etc.)
  // Skip count columns (จำนวน)
  const skipKeys = ['ระดับ', 'สถานพยาบาล', 'จังหวัด', 'จำนวน', 'หน่วย', 'col_'];
  const entries = Object.entries(ind).filter(([k,v]) => {
    if (skipKeys.some(sk => k.includes(sk))) return false;
    const n = parseFloat(v);
    return !isNaN(n) && n >= 0;
  });
  
  // If there's exactly one numeric value left after filtering, use it
  if (entries.length === 1) return parseFloat(entries[0][1]);
  
  // Priority 3: Pick the smallest reasonable number (likely a rate, not a count)
  // Rates are typically < 100, counts are typically > 100
  const candidates = entries.map(([k,v]) => ({ key:k, val:parseFloat(v) })).filter(c => !isNaN(c.val) && c.val >= 0);
  if (candidates.length > 0) {
    // Prefer values < 100 (likely percentages)
    const rates = candidates.filter(c => c.val < 100 && c.val > 0);
    if (rates.length > 0) return rates[0].val;
    // Otherwise return smallest value
    candidates.sort((a,b) => a.val - b.val);
    return candidates[0].val;
  }
  
  return null;
}

function sumObj(obj) { return obj ? Object.values(obj).reduce((a,b) => a + (parseFloat(b)||0), 0) : 0; }

// ========== Step Navigation ==========
function buildStepDots() {
  const c = document.getElementById('stepsIndicator');
  c.innerHTML = '';
  const labels = ['รพ.','G','N','C','GAP','A-H','SP','สรุป'];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot' + (i === 0 ? ' active' : '');
    dot.textContent = labels[i];
    dot.onclick = () => { if (i <= currentStep || (i === 0)) goToStep(i); };
    dot.id = 'dot' + i;
    c.appendChild(dot);
  }
}

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const d = document.getElementById('dot' + i);
    if (!d) continue;
    d.className = 'step-dot';
    if (i < n) d.classList.add('done');
    if (i === n) d.classList.add('active');
  }
  
  currentStep = n;
  document.getElementById('progressBar').style.width = (n / (TOTAL_STEPS - 1) * 100) + '%';
  document.getElementById('btnPrev').style.visibility = n > 0 ? 'visible' : 'hidden';
  document.getElementById('btnNext').style.display = n < TOTAL_STEPS - 1 ? 'block' : 'none';
  
  // Render step content
  const renders = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];
  if (renders[n] && selectedHospital) renders[n]();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (currentStep === 0 && !selectedHospital) { alert('กรุณาเลือกโรงพยาบาลก่อน'); return; }
  if (currentStep < TOTAL_STEPS - 1) goToStep(currentStep + 1);
}
function prevStep() { if (currentStep > 0) goToStep(currentStep - 1); }

// ========== Step 0: Hospital Selector ==========
function renderStep0() {
  const grid = document.getElementById('hospitalGrid');
  grid.innerHTML = '';
  
  Object.keys(HOSP_CONFIG).forEach(name => {
    const h = HOSPITALS[name] || {};
    const pop = h.population?.['ประชากรรวม'] || '-';
    const docs = sumObj(h.workforce?.doctors);
    const nurses = sumObj(h.workforce?.nurses);
    const pharma = sumObj(h.workforce?.pharma);
    const cfg = HOSP_CONFIG[name];
    
    const card = document.createElement('div');
    card.className = 'hospital-card' + (selectedHospital === name ? ' selected' : '');
    card.innerHTML = `
      <div class="name" style="color:${cfg.color}">${name}</div>
      <div class="pop">${cfg.province} | ${cfg.level} | ปชก. ${pop.toLocaleString?.()?pop.toLocaleString():pop}</div>
      <div class="staff">
        <span>แพทย์ ${docs}</span>
        <span>พยาบาล ${nurses}</span>
        <span>เภสัช ${pharma}</span>
      </div>
    `;
    card.onclick = () => {
      selectedHospital = name;
      document.querySelectorAll('.hospital-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    };
    grid.appendChild(card);
  });
}

// ========== Step 1: Data Quality ==========
function renderStep1() {
  const h = HOSPITALS[selectedHospital];
  const gCodes = ['G01','G02','G03','G04'];
  const gNames = ['%AdjRW=0','%Pdx Ill-Defined','%Pdx Ill-Defined (ตาย)','%ICD ด้อยคุณภาพ'];
  const gThresholds = [1, 5, 10, 5];
  
  const grid = document.getElementById('dqMetrics');
  grid.innerHTML = '';
  
  let allPass = true;
  gCodes.forEach((code, i) => {
    const val = getIndicatorValue(selectedHospital, code);
    const numVal = parseFloat(val) || 0;
    const pass = numVal <= gThresholds[i];
    if (!pass) allPass = false;
    
    const card = document.createElement('div');
    card.className = `metric-card ${pass ? 'good' : 'bad'}`;
    card.innerHTML = `
      <div class="label">${code}: ${gNames[i]}</div>
      <div class="value" style="color:${pass?'var(--green)':'var(--red)'}">${val !== null ? numVal.toFixed(2)+'%' : 'N/A'}</div>
      <div class="unit">เกณฑ์: < ${gThresholds[i]}% | ${pass ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</div>
    `;
    grid.appendChild(card);
  });
  
  const alert = document.getElementById('dqAlert');
  if (allPass) {
    alert.className = 'alert-box pass';
    alert.innerHTML = '✓ คุณภาพข้อมูลผ่านเกณฑ์ — สามารถวิเคราะห์ต่อได้';
  } else {
    alert.className = 'alert-box fail';
    alert.innerHTML = '⚠ คุณภาพข้อมูลไม่ผ่านเกณฑ์บางรายการ — ควรปรับปรุง ICD Coding ก่อน แต่ยังสามารถดูต่อเพื่อเปรียบเทียบ';
  }
  
  const verdict = document.getElementById('dqVerdict');
  verdict.className = `step-verdict ${allPass ? 'green' : 'yellow'}`;
  verdict.innerHTML = allPass
    ? `<strong>${selectedHospital}</strong>: คุณภาพข้อมูลดี → ข้อมูล Performance เชื่อถือได้`
    : `<strong>${selectedHospital}</strong>: มีบางตัวชี้วัดไม่ผ่าน → ตีความ Performance ด้วยความระวัง`;
}

// ========== Step 2: Health Need ==========
function renderStep2() {
  const h = HOSPITALS[selectedHospital];
  const pop = h.population?.['ประชากรรวม'] || 0;
  const male = h.population?.['ประชากรชาย'] || 0;
  const female = h.population?.['ประชากรหญิง'] || 0;
  const cfg = HOSP_CONFIG[selectedHospital];
  
  document.getElementById('popCard').innerHTML = `
    <h3>ข้อมูลประชากร — ${cfg.province}</h3>
    <div class="metric-card"><div class="label">ประชากรรวม</div><div class="value" style="color:var(--accent2)">${pop.toLocaleString()}</div><div class="unit">คน (HDC ปี 2569)</div></div>
    <div style="display:flex;gap:12px;margin-top:8px;">
      <div class="metric-card" style="flex:1"><div class="label">ชาย</div><div class="value" style="font-size:18px">${male.toLocaleString()}</div></div>
      <div class="metric-card" style="flex:1"><div class="label">หญิง</div><div class="value" style="font-size:18px">${female.toLocaleString()}</div></div>
    </div>
  `;
  
  if (cfg.province && PROVINCE_PREVALENCE[cfg.province]) {
    const p = PROVINCE_PREVALENCE[cfg.province];
    document.getElementById('popCard').innerHTML += `
      <hr style="opacity:0.2;margin:15px 0">
      <h4 style="margin-bottom:10px;font-size:13px;color:var(--text2)">📊 ข้อมูลระบาดวิทยาระดับจังหวัด (จ.${cfg.province})</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px">
        <div style="background:rgba(239,68,68,0.1);padding:8px;border-radius:8px;border:1px solid rgba(239,68,68,0.2)">
          <span style="display:block;color:var(--red);font-weight:600">หัวใจ/หลอดเลือด</span>
          <strong style="font-size:14px">${p.CVD.toLocaleString()}</strong> <span style="font-size:10px;color:var(--text2)">/ แสนคน</span>
        </div>
        <div style="background:rgba(245,158,11,0.1);padding:8px;border-radius:8px;border:1px solid rgba(245,158,11,0.2)">
          <span style="display:block;color:var(--yellow);font-weight:600">มะเร็ง/เนื้องอก</span>
          <strong style="font-size:14px">${p.Cancer.toLocaleString()}</strong> <span style="font-size:10px;color:var(--text2)">/ แสนคน</span>
        </div>
        <div style="background:rgba(16,185,129,0.1);padding:8px;border-radius:8px;border:1px solid rgba(16,185,129,0.2)">
          <span style="display:block;color:var(--green);font-weight:600">โรคเบาหวาน (DM)</span>
          <strong style="font-size:14px">${p.DM.toLocaleString()}</strong> <span style="font-size:10px;color:var(--text2)">/ แสนคน</span>
        </div>
        <div style="background:rgba(139,92,246,0.1);padding:8px;border-radius:8px;border:1px solid rgba(139,92,246,0.2)">
          <span style="display:block;color:#a78bfa;font-weight:600">โรคไตวาย (CKD)</span>
          <strong style="font-size:14px">${p.CKD.toLocaleString()}</strong> <span style="font-size:10px;color:var(--text2)">/ แสนคน</span>
        </div>
      </div>
      <p style="font-size:10px;color:var(--text2);margin-top:8px;text-align:right">อ้างอิง: ข้อมูลรวบรวมระดับเขตสุขภาพที่ 1</p>
    `;
  }
  
  computeHNI();

  // Add event listeners for sliders
  ['sliderElderly', 'sliderChronic', 'sliderMental'].forEach(id => {
    document.getElementById(id).oninput = computeHNI;
  });
}

function computeHNI() {
  const wE = parseInt(document.getElementById('sliderElderly').value);
  const wC = parseInt(document.getElementById('sliderChronic').value);
  const wM = parseInt(document.getElementById('sliderMental').value);
  document.getElementById('wElderly').textContent = wE;
  document.getElementById('wChronic').textContent = wC;
  document.getElementById('wMental').textContent = wM;
  
  const h = HOSPITALS[selectedHospital];
  const cfg = HOSP_CONFIG[selectedHospital];
  
  const elderly = h.hni?.['Elderly_Rate_%'] || h.hni?.['elderly_rate_norm'] || 0;
  
  // Use actual prevalence sum (CVD + Cancer + DM + CKD) for Chronic factor
  let chronic = 0;
  if (cfg && cfg.province && PROVINCE_PREVALENCE[cfg.province]) {
    const p = PROVINCE_PREVALENCE[cfg.province];
    chronic = p.CVD + p.Cancer + p.DM + p.CKD;
  } else {
    chronic = h.hni?.['Chronic_Rate_%'] || h.hni?.['chronic_rate_norm'] || 0;
  }
  
  const mental = h.hni?.['Mental_Risk_Rate_%'] || h.hni?.['mental_rate_norm'] || 0;
  
  // Dynamic Normalization
  const allHospitals = Object.keys(HOSPITALS);
  const maxE = Math.max(...allHospitals.map(name => HOSPITALS[name].hni?.['Elderly_Rate_%'] || 0)) || 1;
  
  // Find max Chronic score based on prevalence map
  const maxC = Math.max(...allHospitals.map(name => {
    const pName = HOSP_CONFIG[name]?.province;
    const pd = pName ? PROVINCE_PREVALENCE[pName] : null;
    return pd ? (pd.CVD + pd.Cancer + pd.DM + pd.CKD) : (HOSPITALS[name].hni?.['Chronic_Rate_%'] || 0);
  })) || 1;
  
  const maxM = Math.max(...allHospitals.map(name => HOSPITALS[name].hni?.['Mental_Risk_Rate_%'] || 0)) || 1;

  const normE = elderly / maxE;
  const normC = chronic / maxC;
  const normM = mental / maxM;
  
  const total = wE + wC + wM || 100;
  const hni = ((normE * wE/total) + (normC * wC/total) + (normM * wM/total)) * 100;
  
  const result = document.getElementById('hniResult');
  const color = hni > 70 ? 'var(--red)' : hni > 50 ? 'var(--yellow)' : 'var(--green)';
  result.innerHTML = `
    <div style="font-size:12px;color:var(--text2)">Health Need Index</div>
    <div class="score" style="color:${color}">${hni.toFixed(1)}</div>
    <div style="font-size:12px;color:var(--text2);margin-top:4px">
      ${hni > 70 ? '🔴 ภาระสูง' : hni > 50 ? '🟡 ปานกลาง' : '🟢 ต่ำ'}
    </div>
  `;
  
  window._hni = hni;
}

// ========== Step 3: Workforce Capacity ==========
function renderStep3() {
  const h = HOSPITALS[selectedHospital];
  const pop = h.population?.['ประชากรรวม'] || 1;
  const docs = sumObj(h.workforce?.doctors);
  const nurses = sumObj(h.workforce?.nurses);
  const pharma = sumObj(h.workforce?.pharma);
  
  const grid = document.getElementById('wfMetrics');
  grid.innerHTML = '';
  
  const items = [
    { label:'แพทย์ทั้งหมด', val:docs, ratio:(docs/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { label:'พยาบาลทั้งหมด', val:nurses, ratio:(nurses/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { label:'เภสัชกรทั้งหมด', val:pharma, ratio:(pharma/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { label:'รวมบุคลากร', val:docs+nurses+pharma, ratio:((docs+nurses+pharma)/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
  ];
  
  items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="label">${it.label}</div>
      <div class="value" style="color:var(--accent2)">${it.val.toLocaleString()}</div>
      <div class="unit">${it.ratio} ${it.unit}</div>
    `;
    grid.appendChild(card);
  });
  
  // Top doctor specialties
  const docList = Object.entries(h.workforce?.doctors || {}).sort((a,b) => b[1]-a[1]).slice(0,5);
  const nurseList = Object.entries(h.workforce?.nurses || {}).sort((a,b) => b[1]-a[1]).slice(0,5);
  
  const wciCard = document.getElementById('wciCard');
  // Simple WCI = weighted score based on ratios vs median
  const medianDocRatio = 3.5, medianNurseRatio = 12, medianPharmaRatio = 1.5;
  const docRatio = docs/pop*10000;
  const nurseRatio = nurses/pop*10000;
  const pharmaRatio = pharma/pop*10000;
  const wci = ((docRatio/medianDocRatio)*40 + (nurseRatio/medianNurseRatio)*40 + (pharmaRatio/medianPharmaRatio)*20);
  window._wci = wci;
  
  const wciColor = wci > 80 ? 'var(--green)' : wci > 60 ? 'var(--yellow)' : 'var(--red)';
  wciCard.innerHTML = `
    <h3>Workforce Capacity Index (WCI)</h3>
    <div style="text-align:center;padding:10px;">
      <div style="font-size:42px;font-weight:800;color:${wciColor}">${wci.toFixed(1)}</div>
      <div style="font-size:13px;color:var(--text2)">${wci>80?'🟢 กำลังคนเพียงพอ':wci>60?'🟡 ต้องเฝ้าระวัง':'🔴 กำลังคนไม่เพียงพอ'}</div>
    </div>
    <div style="display:flex;gap:16px;margin-top:16px;">
      <div style="flex:1"><h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Top 5 แพทย์</h4>${docList.map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
      <div style="flex:1"><h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Top 5 พยาบาล</h4>${nurseList.map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    </div>
  `;
}

// ========== Step 4: Gap Analysis ==========
function renderStep4() {
  const hni = window._hni || 50;
  const wci = window._wci || 50;
  const gap = hni - wci;
  const gapLevel = gap > 20 ? 'red' : gap > 0 ? 'yellow' : 'green';
  
  document.getElementById('gapDisplay').innerHTML = `
    <div class="gap-column"><h4>HNI (ภาระ)</h4><div class="val" style="color:${hni>70?'var(--red)':hni>50?'var(--yellow)':'var(--green)'}">${hni.toFixed(1)}</div></div>
    <div class="gap-arrow">−</div>
    <div class="gap-column"><h4>WCI (กำลังคน)</h4><div class="val" style="color:${wci>80?'var(--green)':wci>60?'var(--yellow)':'var(--red)'}">${wci.toFixed(1)}</div></div>
    <div class="gap-arrow">=</div>
    <div class="gap-column" style="border-color:var(--${gapLevel})"><h4>GAP Score</h4><div class="val" style="color:var(--${gapLevel})">${gap>0?'+':''}${gap.toFixed(1)}</div>
    <div style="font-size:12px;color:var(--text2);margin-top:4px">${gap>20?'🔴 วิกฤติ — ภาระสูง คนน้อย':gap>0?'🟡 ต้องเฝ้าระวัง':'🟢 สมดุล'}</div></div>
  `;
  
  window._gapLevel = gapLevel;
  
  // Decision Matrix
  const isHighGap = gap > 10;
  document.getElementById('decisionMatrix').innerHTML = `
    <h3>Decision Matrix: Gap × Outcome</h3>
    <div class="matrix-grid">
      <div class="matrix-cell matrix-header"></div>
      <div class="matrix-cell matrix-header">Outcome ดี (A01 ต่ำ)</div>
      <div class="matrix-cell matrix-header">Outcome แย่ (A01 สูง)</div>
      <div class="matrix-cell matrix-header">Gap สูง (คนน้อย)</div>
      <div class="matrix-cell matrix-orange ${isHighGap?'':''}">⚡ ระวัง — เพิ่มคนเชิงป้องกัน</div>
      <div class="matrix-cell matrix-red ${isHighGap?'':''}">🔴 วิกฤติ — เพิ่มคนทันที</div>
      <div class="matrix-cell matrix-header">Gap ต่ำ (คนพอ)</div>
      <div class="matrix-cell matrix-green ${!isHighGap?'':''}">🟢 ดี — รักษาระดับ</div>
      <div class="matrix-cell matrix-yellow ${!isHighGap?'':''}">🟡 ปัญหา Process</div>
    </div>
    <p style="font-size:12px;color:var(--text2);margin-top:12px;text-align:center">→ จะยืนยันด้วย Performance A-H ในขั้นถัดไป</p>
  `;
}

// ========== Step 5: Performance A-H ==========
function renderStep5() {
  const grid = document.getElementById('perfMetrics');
  grid.innerHTML = '';
  
  const perfItems = [
    { code:'A01', name:'Crude Death Rate', unit:'%', goodDir:'low', threshold:3.5 },
    { code:'A04', name:'AMI Mortality', unit:'%', goodDir:'low', threshold:8 },
    { code:'A08', name:'Re-Admission 28d', unit:'%', goodDir:'low', threshold:5 },
    { code:'A09', name:'Sepsis Mortality', unit:'%', goodDir:'low', threshold:30 },
    { code:'B01', name:'Maternal Mortality', unit:'/100k', goodDir:'low', threshold:70 },
    { code:'C02', name:'CMI', unit:'AdjRW', goodDir:'high', threshold:1.5 },
  ];
  
  let outcomeGood = true;
  perfItems.forEach(item => {
    const val = getIndicatorValue(selectedHospital, item.code);
    let status = 'good';
    if (val !== null) {
      if (item.goodDir === 'low' && val > item.threshold) { status = 'bad'; outcomeGood = false; }
      if (item.goodDir === 'high' && val < item.threshold) { status = 'warn'; }
    }
    
    const card = document.createElement('div');
    card.className = `metric-card ${val !== null ? status : ''}`;
    card.innerHTML = `
      <div class="label">${item.code}: ${item.name}</div>
      <div class="value" style="color:${status==='bad'?'var(--red)':status==='warn'?'var(--yellow)':'var(--green)'}">${val !== null ? (typeof val==='number'?val.toFixed(2):val) : 'N/A'}</div>
      <div class="unit">${item.unit} | ${item.goodDir==='low'?'น้อย=ดี':'มาก=ดี'} | เกณฑ์: ${item.goodDir==='low'?'<':'>'} ${item.threshold}</div>
    `;
    grid.appendChild(card);
  });
  
  window._outcomeGood = outcomeGood;
  
  // Cross-validate with Gap
  const gapLevel = window._gapLevel || 'green';
  const verdict = document.getElementById('perfVerdict');
  
  if (gapLevel === 'red' && !outcomeGood) {
    verdict.className = 'step-verdict red';
    verdict.innerHTML = '🔴 <strong>วิกฤติ:</strong> Gap สูง + Outcome แย่ → ต้องเพิ่มอัตรากำลังเร่งด่วน + ปรับ Protocol';
  } else if (gapLevel !== 'green' && outcomeGood) {
    verdict.className = 'step-verdict yellow';
    verdict.innerHTML = '⚡ <strong>ระวัง:</strong> Gap สูงแต่ Outcome ยังดี → เพิ่มคนเชิงป้องกันก่อนคุณภาพลด';
  } else if (gapLevel === 'green' && !outcomeGood) {
    verdict.className = 'step-verdict yellow';
    verdict.innerHTML = '🟡 <strong>ปัญหากระบวนการ:</strong> คนพอแต่ Outcome ไม่ดี → ทบทวน Protocol ไม่ใช่เพิ่มคน';
  } else {
    verdict.className = 'step-verdict green';
    verdict.innerHTML = '🟢 <strong>ดี:</strong> กำลังคนเพียงพอ + Outcome ดี → รักษาระดับ + Continuous Improvement';
  }
}

// ========== Step 6: Service Plan ==========
function renderStep6() {
  const container = document.getElementById('spIssues');
  container.innerHTML = '<h3 style="margin-bottom:16px">ตัวชี้วัด Service Plan ที่ต้องเฝ้าระวัง</h3>';
  
  let issueCount = 0;
  Object.entries(SPECIALTY_MAP).forEach(([code, spec]) => {
    const val = getIndicatorValue(selectedHospital, code);
    if (val === null) return;
    
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return;
    
    let isIssue = false;
    if (spec.dir === 'low' && numVal > spec.threshold) isIssue = true;
    if (spec.dir === 'high' && numVal < spec.threshold) isIssue = true;
    
    const div = document.createElement('div');
    div.className = 'sp-issue';
    div.innerHTML = `
      <div class="issue-head">
        <span class="issue-name">${code}: ${spec.name}</span>
        <span class="issue-val ${isIssue?'bad':'warn'}">${numVal.toFixed(2)}${spec.dir==='low'?'%':''}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">
        เกณฑ์: ${spec.dir==='low'?'< '+spec.threshold+'%':'> '+spec.threshold+'%'} | 
        สถานะ: ${isIssue?'<span style="color:var(--red)">ไม่ผ่าน</span>':'<span style="color:var(--green)">ผ่าน</span>'}
      </div>
      ${isIssue ? `<div>
        <span class="specialty-tag">แพทย์: ${spec.doc}</span>
        <span class="specialty-tag">พยาบาล: ${spec.nurse}</span>
      </div>` : ''}
    `;
    container.appendChild(div);
    if (isIssue) issueCount++;
  });
  
  if (issueCount === 0) {
    container.innerHTML += '<div class="step-verdict green" style="margin-top:12px">🟢 ไม่พบตัวชี้วัด Service Plan ที่เกินเกณฑ์สำหรับ รพ. นี้ (จากข้อมูลที่มี)</div>';
  }
  
  window._issueCount = issueCount;
}

// ========== Step 7: Recommendations ==========
function renderStep7() {
  const container = document.getElementById('recommendations');
  container.innerHTML = `<div class="card"><h3>สรุปข้อเสนอ: ${selectedHospital}</h3></div>`;
  
  const gapLevel = window._gapLevel || 'green';
  const outcomeGood = window._outcomeGood !== false;
  const issueCount = window._issueCount || 0;
  const h = HOSPITALS[selectedHospital];
  const pop = h.population?.['ประชากรรวม'] || 0;
  const docs = sumObj(h.workforce?.doctors);
  const nurses = sumObj(h.workforce?.nurses);
  
  // Main recommendation
  let mainType, mainTitle, mainDesc;
  if (gapLevel === 'red' && !outcomeGood) {
    mainType = 'urgent'; mainTitle = '🔴 เพิ่มอัตรากำลัง + ปรับกระบวนการ (เร่งด่วน)';
    mainDesc = `${selectedHospital} มี Gap สูง (ภาระมาก คนน้อย) และ Outcome ไม่ดี → ต้องดำเนินการทั้งเพิ่มบุคลากรและทบทวน Protocol`;
  } else if (gapLevel !== 'green' && outcomeGood) {
    mainType = 'process'; mainTitle = '⚡ เพิ่มคนเชิงป้องกัน';
    mainDesc = `${selectedHospital} มี Gap สูงแต่ Outcome ยังดี → ควรเพิ่มบุคลากรก่อนที่คุณภาพจะลดลง`;
  } else if (gapLevel === 'green' && !outcomeGood) {
    mainType = 'process'; mainTitle = '🟡 พัฒนากระบวนการ (ไม่ใช่เพิ่มคน)';
    mainDesc = `${selectedHospital} มีกำลังคนเพียงพอแต่ Outcome ไม่ดี → ปัญหาอยู่ที่ Process/Protocol ไม่ใช่จำนวนคน`;
  } else {
    mainType = 'maintain'; mainTitle = '🟢 รักษาระดับ + Benchmark';
    mainDesc = `${selectedHospital} มีกำลังคนเพียงพอและ Outcome ดี → ใช้เป็น Best Practice ถ่ายทอดให้ รพ. อื่น`;
  }
  
  container.innerHTML += `<div class="rec-card ${mainType}"><h4>${mainTitle}</h4><p>${mainDesc}</p>
    <div class="rec-tags"><span class="rec-tag">ประชากร ${pop.toLocaleString()}</span><span class="rec-tag">แพทย์ ${docs}</span><span class="rec-tag">พยาบาล ${nurses}</span></div></div>`;
  
  // Specialty recommendations
  if (issueCount > 0) {
    container.innerHTML += '<div class="card"><h3>ข้อเสนอเฉพาะทาง (จาก Service Plan)</h3></div>';
    Object.entries(SPECIALTY_MAP).forEach(([code, spec]) => {
      const val = getIndicatorValue(selectedHospital, code);
      if (val === null) return;
      const numVal = parseFloat(val);
      if (isNaN(numVal)) return;
      let isIssue = (spec.dir === 'low' && numVal > spec.threshold) || (spec.dir === 'high' && numVal < spec.threshold);
      if (!isIssue) return;
      
      container.innerHTML += `<div class="rec-card urgent"><h4>${code}: ${spec.name} = ${numVal.toFixed(2)}</h4>
        <p>เกินเกณฑ์ (${spec.dir==='low'?'< '+spec.threshold:'> '+spec.threshold}) → ต้องการ:</p>
        <div class="rec-tags"><span class="rec-tag">${spec.doc}</span><span class="rec-tag">${spec.nurse}</span></div></div>`;
    });
  }
  
  // Data quality note
  container.innerHTML += `<div class="rec-card"><h4>ข้อควรระวัง</h4><p>• HNI ใช้ Mock Data สำหรับ Chronic/Mental → ค่าเป็นเพียงตัวอย่าง<br>• ข้อมูล CMI เป็นปีงบประมาณ 2569 จาก CMI Web เขตสุขภาพที่ 1<br>• ข้อมูลเฉพาะทางแพทย์ยังไม่มี → ต้องนำเข้าจากแพทยสภา</p></div>`;
}

// ========== Event Listeners ==========
document.getElementById('sliderElderly').addEventListener('input', () => { if(selectedHospital) computeHNI(); });
document.getElementById('sliderChronic').addEventListener('input', () => { if(selectedHospital) computeHNI(); });
document.getElementById('sliderMental').addEventListener('input', () => { if(selectedHospital) computeHNI(); });

// ========== Init ==========
loadData();
// ========== Modal Controls ==========
function showHniHelp() {
  document.getElementById('hniHelpModal').classList.add('active');
}
function closeHniHelp() {
  document.getElementById('hniHelpModal').classList.remove('active');
}

// ========== DALY Reference Data (Thailand 2019) ==========
const DALY_DATA = {
  '0-14 ปี': {
    totalMale: 641, totalFemale: 480,
    male: [
      { rank:1, disease:'ความพิการแต่กำเนิด', dalys:92, pct:14.3 },
      { rank:2, disease:'การบาดเจ็บทางถนน', dalys:78, pct:12.2 },
      { rank:3, disease:'การคลอดก่อนกำหนดของทารกแรกเกิด', dalys:57, pct:8.8 },
      { rank:4, disease:'การติดเชื้อทางเดินหายใจส่วนล่าง', dalys:32, pct:4.9 },
      { rank:5, disease:'โรคฟันผุ', dalys:19, pct:3.0 },
      { rank:6, disease:'ความรุนแรงระหว่างบุคคล', dalys:17, pct:2.7 },
      { rank:7, disease:'การจมน้ำ', dalys:17, pct:2.7 },
      { rank:8, disease:'โรคสมองจากทารกแรกเกิด (หายใจไม่ออก)', dalys:16, pct:2.5 },
      { rank:9, disease:'การติดเชื้อในทารกแรกเกิด', dalys:15, pct:2.4 },
      { rank:10, disease:'โรคอุจจาระร่วง', dalys:15, pct:2.3 },
    ],
    female: [
      { rank:1, disease:'ความพิการแต่กำเนิด', dalys:62, pct:13.0 },
      { rank:2, disease:'การบาดเจ็บทางถนน', dalys:57, pct:12.0 },
      { rank:3, disease:'การคลอดก่อนกำหนดของทารกแรกเกิด', dalys:32, pct:6.6 },
      { rank:4, disease:'การติดเชื้อทางเดินหายใจส่วนล่าง', dalys:26, pct:5.3 },
      { rank:5, disease:'โรคฟันผุ', dalys:19, pct:3.9 },
      { rank:6, disease:'ความรุนแรงระหว่างบุคคล', dalys:17, pct:3.6 },
      { rank:7, disease:'โรคอุจจาระร่วง', dalys:16, pct:3.4 },
      { rank:8, disease:'โรคสมองจากทารกแรกเกิด (หายใจไม่ออก)', dalys:15, pct:3.2 },
      { rank:9, disease:'การจมน้ำ', dalys:15, pct:3.0 },
      { rank:10, disease:'การติดเชื้อในทารกแรกเกิด', dalys:12, pct:2.5 },
    ]
  },
  '15-29 ปี': {
    totalMale: 1164, totalFemale: 535,
    male: [
      { rank:1, disease:'การบาดเจ็บทางถนน', dalys:488, pct:41.9 },
      { rank:2, disease:'ทำร้ายตัวเอง', dalys:81, pct:7.0 },
      { rank:3, disease:'การติดเชื้อเอชไอวี/เอดส์', dalys:65, pct:5.6 },
      { rank:4, disease:'การติดสารเสพติด', dalys:33, pct:2.9 },
      { rank:5, disease:'ความผิดปกติในช่องปาก', dalys:28, pct:2.4 },
      { rank:6, disease:'การเสพติดเครื่องดื่มที่มีแอลกอฮอล์', dalys:26, pct:2.2 },
      { rank:7, disease:'ความรุนแรงระหว่างบุคคล', dalys:26, pct:2.2 },
      { rank:8, disease:'การจมน้ำ', dalys:23, pct:2.0 },
      { rank:9, disease:'โรคซึมเศร้า', dalys:15, pct:1.3 },
      { rank:10, disease:'โรคจิตเภท', dalys:15, pct:1.3 },
    ],
    female: [
      { rank:1, disease:'การบาดเจ็บทางถนน', dalys:114, pct:21.3 },
      { rank:2, disease:'การติดเชื้อเอชไอวี/เอดส์', dalys:31, pct:5.8 },
      { rank:3, disease:'โรคซึมเศร้า', dalys:29, pct:5.5 },
      { rank:4, disease:'การติดสารเสพติด', dalys:27, pct:5.1 },
      { rank:5, disease:'ความผิดปกติในช่องปาก', dalys:27, pct:5.0 },
      { rank:6, disease:'ความผิดปกติของมารดา', dalys:22, pct:4.1 },
      { rank:7, disease:'การเสพติดเครื่องดื่มที่มีแอลกอฮอล์', dalys:16, pct:2.9 },
      { rank:8, disease:'ทำร้ายตัวเอง', dalys:14, pct:2.6 },
      { rank:9, disease:'โรคจิตเภท', dalys:11, pct:2.1 },
      { rank:10, disease:'โรคเบาหวาน', dalys:9, pct:1.7 },
    ]
  },
  '30-59 ปี': {
    totalMale: 5216, totalFemale: 2711,
    male: [
      { rank:1, disease:'การบาดเจ็บทางถนน', dalys:575, pct:11.0 },
      { rank:2, disease:'โรคหัวใจขาดเลือด', dalys:393, pct:7.5 },
      { rank:3, disease:'โรคหลอดเลือดสมอง', dalys:384, pct:7.4 },
      { rank:4, disease:'โรคตับแข็งและโรคตับเรื้อรังอื่นๆ', dalys:377, pct:7.2 },
      { rank:5, disease:'โรคเบาหวาน', dalys:354, pct:6.8 },
      { rank:6, disease:'การติดเชื้อเอชไอวี/เอดส์', dalys:256, pct:4.9 },
      { rank:7, disease:'โรคมะเร็งตับ', dalys:244, pct:4.7 },
      { rank:8, disease:'ทำร้ายตัวเอง', dalys:182, pct:3.5 },
      { rank:9, disease:'วัณโรค', dalys:166, pct:3.2 },
      { rank:10, disease:'การเสพติดเครื่องดื่มที่มีแอลกอฮอล์', dalys:163, pct:3.1 },
    ],
    female: [
      { rank:1, disease:'โรคเบาหวาน', dalys:270, pct:10.0 },
      { rank:2, disease:'การบาดเจ็บทางถนน', dalys:232, pct:8.6 },
      { rank:3, disease:'โรคมะเร็งเต้านม', dalys:169, pct:6.2 },
      { rank:4, disease:'การติดเชื้อเอชไอวี/เอดส์', dalys:135, pct:5.0 },
      { rank:5, disease:'โรคหลอดเลือดสมอง', dalys:128, pct:4.7 },
      { rank:6, disease:'ความผิดปกติในช่องปาก', dalys:105, pct:3.9 },
      { rank:7, disease:'โรคหัวใจขาดเลือด', dalys:81, pct:3.0 },
      { rank:8, disease:'โรคตับแข็งและโรคตับเรื้อรังอื่นๆ', dalys:76, pct:2.8 },
      { rank:9, disease:'โรคมะเร็งปากมดลูก', dalys:68, pct:2.5 },
      { rank:10, disease:'โรคมะเร็งหลอดลมและปอด', dalys:63, pct:2.3 },
    ]
  },
  '60 ปีขึ้นไป': {
    totalMale: 4121, totalFemale: 3677,
    male: [
      { rank:1, disease:'โรคหลอดเลือดสมอง', dalys:485, pct:11.8 },
      { rank:2, disease:'โรคเบาหวาน', dalys:446, pct:10.8 },
      { rank:3, disease:'โรคหัวใจขาดเลือด', dalys:321, pct:7.8 },
      { rank:4, disease:'โรคมะเร็งตับ', dalys:222, pct:5.4 },
      { rank:5, disease:'โรคปอดอุดกั้นเรื้อรัง', dalys:214, pct:5.2 },
      { rank:6, disease:'การบาดเจ็บทางถนน', dalys:195, pct:4.7 },
      { rank:7, disease:'โรคมะเร็งหลอดลมและปอด', dalys:176, pct:4.3 },
      { rank:8, disease:'โรคไตเรื้อรัง', dalys:135, pct:3.3 },
      { rank:9, disease:'การพลัดตกหรือล้ม', dalys:107, pct:2.6 },
      { rank:10, disease:'โรคมะเร็งลำไส้และทวารหนัก', dalys:103, pct:2.5 },
    ],
    female: [
      { rank:1, disease:'โรคเบาหวาน', dalys:555, pct:15.1 },
      { rank:2, disease:'โรคหลอดเลือดสมอง', dalys:474, pct:12.9 },
      { rank:3, disease:'โรคหัวใจขาดเลือด', dalys:215, pct:5.8 },
      { rank:4, disease:'โรคไตเรื้อรัง', dalys:160, pct:4.3 },
      { rank:5, disease:'โรคอัลไซเมอร์และภาวะสมองเสื่อมอื่นๆ', dalys:158, pct:4.3 },
      { rank:6, disease:'โรคมะเร็งตับ', dalys:105, pct:2.9 },
      { rank:7, disease:'โรคมะเร็งหลอดลมและปอด', dalys:101, pct:2.7 },
      { rank:8, disease:'การพลัดตกหรือล้ม', dalys:86, pct:2.3 },
      { rank:9, disease:'การบาดเจ็บทางถนน', dalys:85, pct:2.3 },
      { rank:10, disease:'โรคข้อเสื่อม', dalys:79, pct:2.1 },
    ]
  }
};

let currentDalyTab = '60 ปีขึ้นไป';

function showDalyRef() {
  document.getElementById('dalyRefModal').classList.add('active');
  renderDalyTabs();
  renderDalyTable(currentDalyTab);
}
function closeDalyRef() {
  document.getElementById('dalyRefModal').classList.remove('active');
}

function renderDalyTabs() {
  const container = document.getElementById('dalyTabs');
  container.innerHTML = '';
  Object.keys(DALY_DATA).forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'daly-tab' + (key === currentDalyTab ? ' active' : '');
    btn.textContent = key;
    btn.onclick = () => {
      currentDalyTab = key;
      renderDalyTabs();
      renderDalyTable(key);
    };
    container.appendChild(btn);
  });
}

function renderDalyTable(ageGroup) {
  const data = DALY_DATA[ageGroup];
  const container = document.getElementById('dalyTableContainer');
  
  let html = `<div class="daly-summary">
    <div class="daly-stat male"><span class="gender-icon">♂</span> ชาย: <strong>${data.totalMale.toLocaleString()}</strong> พัน DALYs</div>
    <div class="daly-stat female"><span class="gender-icon">♀</span> หญิง: <strong>${data.totalFemale.toLocaleString()}</strong> พัน DALYs</div>
  </div>`;

  html += `<div class="daly-dual-table"><div class="daly-col">
    <h4><span class="gender-icon">♂</span> ชาย</h4>
    <table class="daly-tbl"><thead><tr><th>#</th><th>โรค</th><th>DALYs ('000)</th><th>%</th></tr></thead><tbody>`;
  data.male.forEach(r => {
    const barW = (r.pct / Math.max(...data.male.map(x=>x.pct))) * 100;
    html += `<tr><td>${r.rank}</td><td>${r.disease}</td><td>${r.dalys.toLocaleString()}</td>
      <td><div class="pct-bar"><div class="pct-fill male" style="width:${barW}%"></div><span>${r.pct}%</span></div></td></tr>`;
  });
  html += `</tbody></table></div>`;
  
  html += `<div class="daly-col"><h4><span class="gender-icon">♀</span> หญิง</h4>
    <table class="daly-tbl"><thead><tr><th>#</th><th>โรค</th><th>DALYs ('000)</th><th>%</th></tr></thead><tbody>`;
  data.female.forEach(r => {
    const barW = (r.pct / Math.max(...data.female.map(x=>x.pct))) * 100;
    html += `<tr><td>${r.rank}</td><td>${r.disease}</td><td>${r.dalys.toLocaleString()}</td>
      <td><div class="pct-bar"><div class="pct-fill female" style="width:${barW}%"></div><span>${r.pct}%</span></div></td></tr>`;
  });
  html += `</tbody></table></div></div>`;
  
  html += `<p class="daly-note">แหล่งข้อมูล: รายงานภาระโรคจากปัจจัยเสี่ยงของประชากรไทย พ.ศ. 2562 (BOD Thailand 2019)</p>`;
  
  container.innerHTML = html;
}

// ========== Init ==========
loadData();
