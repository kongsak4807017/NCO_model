// NCO Simulation Engine
// Loads data_inputV1.csv and drives the 7-step wizard

let DATA = [];
let HOSPITALS = {};
let currentStep = 0;
let selectedHospital = null;
const TOTAL_STEPS = 8;
let MOCK_API_BASE = '/api/mock';
let ppSummaryCache = {};
let ppDistrictCache = {};
let ppUnitCapacityCache = {};
let ppHospitalSummaryCache = {};
let ppAmphurOutcomeCache = {};
let ppIndicatorWorkforceMapCache = null;
let amphurPopulationCache = {};
let hrUnitWorkforceCache = {};
let districtBaselineProfileCache = {};
let needFtePreviewCache = {};
let workloadReferenceCache = null;
let analysisRunHistoryCache = {};
let activeRunReplay = null;
let auditPayloadRegistry = {};
let workforceDictionaryRegistry = { hr: {}, pp: {} };
let hospitalScopeCache = {};
let analysisConfigCache = null;
const MOCK_STORAGE_KEY = 'nco_mock_session_v2';
const MOCK_INPUT_DEBOUNCE_MS = 600;
let mockCatalog = [];
let mockSaveTimer = null;
let mockPendingValues = {};
let mockSession = {
  hospitalId: null,
  scenarioId: null,
  inputs: {},
  loaded: false,
  saveState: 'idle',
  lastRunSignature: null,
};

// ========== Hospital Config ==========
const HOSP_CONFIG = {
  'สร้าง Mocking Hospital': { province:'Sandbox', level:'Mocking', color:'#22d3ee' },
  'นครพิงค์': { province:'เชียงใหม่', level:'รพศ.', color:'#6366f1' },
  'ลำปาง': { province:'ลำปาง', level:'รพท.', color:'#8b5cf6' },
  'เชียงรายประชานุเคราะห์': { province:'เชียงราย', level:'รพศ.', color:'#a78bfa' },
  'น่าน': { province:'น่าน', level:'รพท.', color:'#10b981' },
  'แพร่': { province:'แพร่', level:'รพท.', color:'#14b8a6' },
  'พะเยา': { province:'พะเยา', level:'รพท.', color:'#f59e0b' },
  'ลำพูน': { province:'ลำพูน', level:'รพท.', color:'#f97316' },
  'เชียงคำ': { province:'พะเยา', level:'รพท.', color:'#ec4899' },
};
const PROVINCE_CODE_MAP = {
  'เชียงใหม่': '50',
  'ลำพูน': '51',
  'ลำปาง': '52',
  'แพร่': '54',
  'น่าน': '55',
  'พะเยา': '56',
  'เชียงราย': '57',
  'แม่ฮ่องสอน': '58',
};
const PROVINCE_NAME_BY_CODE = Object.fromEntries(
  Object.entries(PROVINCE_CODE_MAP).map(([name, code]) => [code, name]),
);
const MOCK_HOSPITAL_NAME = 'สร้าง Mocking Hospital';
const MOCK_DEFAULT_HOSPITAL_LEVEL = 'รพช.';
const HOSPITAL_LEVEL_LABEL_MAP = {
  'A (รพศ.)': 'รพศ.',
  'A (รพท.)': 'รพท.',
  'S (รพท.)': 'รพท.',
  'M1 (รพท.)': 'รพท.',
  Mocking: MOCK_DEFAULT_HOSPITAL_LEVEL,
  'รพศ.': 'รพศ.',
  'รพท.': 'รพท.',
  'รพช.': 'รพช.',
};

// Specialty mapping
const SPECIALTY_MAP = {
  'DH0101': { name:'STEMI Mortality', threshold:12, dir:'low', unit:'%', doc:'อายุรแพทย์หัวใจ Interventional', nurse:'พยาบาล CCU / Cath Lab', baseDoc:1, baseNurse:2, process:'ทบทวน Door-to-Needle / Door-to-Balloon time' },
  'DH0102': { name:'AMI Mortality', threshold:10, dir:'low', unit:'%', doc:'อายุรแพทย์หัวใจ', nurse:'พยาบาล CCU', baseDoc:1, baseNurse:2, process:'จัดทำ STEMI fast track 24/7' },
  'DN0101': { name:'Stroke Mortality', threshold:15, dir:'low', unit:'%', doc:'อายุรแพทย์ประสาท', nurse:'พยาบาล Stroke Unit', baseDoc:1, baseNurse:2, process:'ลด Door-to-CT / Door-to-Needle' },
  'DN0142D': { name:'Ischemic Stroke Death with rtPA', threshold:1, dir:'low', unit:'%', doc:'อายุรแพทย์ประสาท + ER', nurse:'พยาบาล ER / Stroke Fast Track', baseDoc:1, baseNurse:2, process:'ปรับ stroke fast track, rtPA safety review, และ post-thrombolysis monitoring' },
  'CI0101': { name:'Sepsis Mortality', threshold:20, dir:'low', unit:'%', doc:'อายุรแพทย์โรคติดเชื้อ', nurse:'พยาบาล ICU', baseDoc:1, baseNurse:3, process:'ใช้ Sepsis 1-hour bundle และ early warning score' },
  'PE0102': { name:'Pneumonia เด็ก Mortality', threshold:3, dir:'low', unit:'%', doc:'กุมารแพทย์ระบบหายใจ', nurse:'พยาบาล PICU', baseDoc:1, baseNurse:2, process:'ปรับ pediatric sepsis/pneumonia pathway' },
  'CM0203': { name:'Neonatal Mortality', threshold:10, dir:'low', unit:'/1000', doc:'กุมารแพทย์ทารกแรกเกิด', nurse:'พยาบาล NICU', baseDoc:1, baseNurse:3, process:'เพิ่มคุณภาพการดูแลทารกวิกฤติและ refer-in protocol' },
  'CM0101': { name:'Maternal Mortality', threshold:70, dir:'low', unit:'/100k', doc:'สูตินรีแพทย์', nurse:'พยาบาลห้องคลอด', baseDoc:1, baseNurse:2, process:'ทบทวน high-risk ANC และ obstetric emergency drill' },
  'DC0401': { name:'มะเร็ง Mortality', threshold:15, dir:'low', unit:'%', doc:'อายุรแพทย์มะเร็ง', nurse:'พยาบาลเคมีบำบัด', baseDoc:1, baseNurse:2, process:'ลด delay ใน diagnosis-to-treatment interval' },
  'DG0201': { name:'ไส้ติ่งทะลุ', threshold:30, dir:'low', unit:'%', doc:'ศัลยแพทย์ทั่วไป', nurse:'พยาบาล ER / OR', baseDoc:1, baseNurse:2, process:'ทบทวน triage และเวลารอผ่าตัด' },
  'PS0001': { name:'อัตราฆ่าตัวตาย', threshold:5, dir:'low', unit:'/100k', doc:'จิตแพทย์', nurse:'พยาบาลจิตเวช', baseDoc:1, baseNurse:2, process:'ขยายระบบคัดกรองซึมเศร้า/ฆ่าตัวตายเชิงรุก' },
  'RH0101': { name:'Stroke ได้กายภาพ', threshold:50, dir:'high', unit:'%', doc:'แพทย์เวชศาสตร์ฟื้นฟู', nurse:'พยาบาลเวชศาสตร์ฟื้นฟู / Stroke Ward', baseDoc:1, baseNurse:2, process:'เพิ่ม early rehab protocol ใน ward/ICU' },
};

const PROFESSION_FIELDS = [
  { code:'doctor_total', label:'นายแพทย์', unit:'คน', step:'1', professionCode:'MD' },
  { code:'nurse_total', label:'พยาบาลวิชาชีพ', unit:'คน', step:'1', professionCode:'RN' },
  { code:'pharmacist_total', label:'เภสัชกร', unit:'คน', step:'1', professionCode:'PHARM' },
  { code:'physical_therapist_total', label:'นักกายภาพบำบัด', unit:'คน', step:'1', professionCode:'PT' },
  { code:'psychologist_total', label:'นักจิตวิทยา', unit:'คน', step:'1', professionCode:'PSY' },
  { code:'clinical_psychologist_total', label:'นักจิตวิทยาคลินิก', unit:'คน', step:'1', professionCode:'CPSY' },
];

const PROFESSION_SUPPORT_MAP = {
  'RH0101': [
    { code:'physical_therapist_total', label:'นักกายภาพบำบัด', totalCode:'physical_therapist_total', roleCode:'pt', minRequired:{ green:1, yellow:1, red:2 } },
  ],
  'PS0001': [
    { code:'psychologist_total', label:'นักจิตวิทยา', totalCode:'psychologist_total', roleCode:'psychologist', minRequired:{ green:1, yellow:1, red:2 } },
    { code:'clinical_psychologist_total', label:'นักจิตวิทยาคลินิก', totalCode:'clinical_psychologist_total', roleCode:'clinical_psychologist', minRequired:{ green:1, yellow:1, red:1 } },
  ],
};

const PROFESSION_SPECIALTY_SUPPORT_CONFIG = {
  'RH0101': [
    { roleCode:'pt', label:'นักกายภาพบำบัด', hint:'Stroke Rehab / Early Mobilization', totalCode:'physical_therapist_total' },
  ],
  'PS0001': [
    { roleCode:'psychologist', label:'นักจิตวิทยา', hint:'Suicide / Depression Clinic', totalCode:'psychologist_total' },
    { roleCode:'clinical_psychologist', label:'นักจิตวิทยาคลินิก', hint:'High-risk Case / Crisis Intervention', totalCode:'clinical_psychologist_total' },
  ],
};

const DQ_FIELDS = [
  { code:'G01', label:'%AdjRW = 0', threshold:1, unit:'%' },
  { code:'G02', label:'%Pdx Ill-defined', threshold:5, unit:'%' },
  { code:'G03', label:'%Pdx Ill-defined (Death)', threshold:10, unit:'%' },
  { code:'G04', label:'%ICD Low Quality', threshold:5, unit:'%' },
];

const NEED_INPUT_FIELDS = [
  { code:'population_total', label:'ประชากรรวม', unit:'คน', step:'1' },
  { code:'population_male', label:'ประชากรชาย', unit:'คน', step:'1' },
  { code:'population_female', label:'ประชากรหญิง', unit:'คน', step:'1' },
  { code:'elderly_pct', label:'ผู้สูงอายุ 60+', unit:'%', step:'0.1' },
  { code:'prevalence_cvd', label:'CVD prevalence', unit:'/100k', step:'1' },
  { code:'prevalence_cancer', label:'Cancer prevalence', unit:'/100k', step:'1' },
  { code:'prevalence_dm', label:'DM prevalence', unit:'/100k', step:'1' },
  { code:'prevalence_ckd', label:'CKD prevalence', unit:'/100k', step:'1' },
  { code:'mental_risk_rate', label:'Mental risk rate', unit:'/100k', step:'1' },
];

const CAPACITY_FIELDS = PROFESSION_FIELDS;

const OUTCOME_FIELDS = [
  { code:'A01', name:'Crude Death Rate', unit:'%', goodDir:'low', threshold:3.5 },
  { code:'A04', name:'AMI Mortality', unit:'%', goodDir:'low', threshold:8 },
  { code:'A09', name:'Sepsis Mortality', unit:'%', goodDir:'low', threshold:20 },
  { code:'B01', name:'Maternal Mortality', unit:'/100k', goodDir:'low', threshold:70 },
  { code:'C02', name:'CMI', unit:'AdjRW', goodDir:'high', threshold:1.5 },
  { code:'D01', name:'Bed Occupancy Rate', unit:'%', goodDir:'range', threshold:[80,85] },
  { code:'F10', name:'Referral Leakage to Tertiary', unit:'%', goodDir:'low', threshold:15 },
];

const SERVICE_PLAN_FIELDS = Object.entries(SPECIALTY_MAP).map(([code, spec]) => ({
  code,
  label: spec.name,
  unit: spec.unit,
  step:'0.1',
}));

const SPECIALTY_CAPACITY_FIELDS = Object.entries(SPECIALTY_MAP).flatMap(([code, spec]) => ([
  { code:`${code}_doc_headcount`, label:'แพทย์', unit:'คน', step:'1', serviceCode:code, fieldType:'doc' },
  { code:`${code}_nurse_headcount`, label:'พยาบาล', unit:'คน', step:'1', serviceCode:code, fieldType:'nurse' },
  { code:`${code}_fte_factor`, label:'FTE factor', unit:'ratio', step:'0.1', serviceCode:code, fieldType:'fte' },
  { code:`${code}_coverage_pct`, label:'Coverage 24x7', unit:'%', step:'1', serviceCode:code, fieldType:'coverage' },
]));

const PROFESSION_SPECIALTY_SUPPORT_FIELDS = Object.entries(PROFESSION_SPECIALTY_SUPPORT_CONFIG).flatMap(([serviceCode, roles]) =>
  roles.flatMap((role) => ([
    {
      code:`${serviceCode}_${role.roleCode}_headcount`,
      label:role.label,
      unit:'คน',
      step:'1',
      serviceCode,
      roleCode:role.roleCode,
      supportHint:role.hint,
      totalCode:role.totalCode,
      fieldType:'support_headcount',
    },
    {
      code:`${serviceCode}_${role.roleCode}_fte_factor`,
      label:'FTE factor',
      unit:'ratio',
      step:'0.1',
      serviceCode,
      roleCode:role.roleCode,
      supportHint:role.hint,
      totalCode:role.totalCode,
      fieldType:'support_fte',
    },
  ]))
);

const MOCK_HOSPITAL_LEVEL_OPTIONS = ['รพศ.', 'รพท.', 'รพช.'];

const PP_CAPACITY_FIELD_FALLBACK = [
  { ppFunctionCode:'PP_COMMUNICABLE_CONTROL', functionNameTh:'ควบคุมโรคติดต่อ', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_COMMUNICABLE_CONTROL', functionNameTh:'ควบคุมโรคติดต่อ', professionCode:'PH_OFFICER', professionNameTh:'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข' },
  { ppFunctionCode:'PP_COMMUNITY_NURSING', functionNameTh:'การพยาบาลชุมชน', professionCode:'RN', professionNameTh:'พยาบาลวิชาชีพ' },
  { ppFunctionCode:'PP_FAMILY_MEDICINE', functionNameTh:'เวชปฏิบัติครอบครัว', professionCode:'FAM_MD', professionNameTh:'แพทย์เวชศาสตร์ครอบครัว' },
  { ppFunctionCode:'PP_FAMILY_MEDICINE', functionNameTh:'เวชปฏิบัติครอบครัว', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_FAMILY_MEDICINE', functionNameTh:'เวชปฏิบัติครอบครัว', professionCode:'RN', professionNameTh:'พยาบาลวิชาชีพ' },
  { ppFunctionCode:'PP_HEALTH_EDUCATION', functionNameTh:'สุขศึกษา', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_HEALTH_PROMOTION', functionNameTh:'ส่งเสริมสุขภาพ', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_HEALTH_PROMOTION_PREVENTION', functionNameTh:'ส่งเสริมและป้องกันโรค', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_HEALTH_PROMOTION_PREVENTION', functionNameTh:'ส่งเสริมและป้องกันโรค', professionCode:'RN', professionNameTh:'พยาบาลวิชาชีพ' },
  { ppFunctionCode:'PP_NCD_MENTAL_SUBSTANCE', functionNameTh:'NCD สุขภาพจิต และสารเสพติด', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_NCD_MENTAL_SUBSTANCE', functionNameTh:'NCD สุขภาพจิต และสารเสพติด', professionCode:'PH_OFFICER', professionNameTh:'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข' },
  { ppFunctionCode:'PP_NCD_MENTAL_SUBSTANCE', functionNameTh:'NCD สุขภาพจิต และสารเสพติด', professionCode:'RN', professionNameTh:'พยาบาลวิชาชีพ' },
  { ppFunctionCode:'PP_PRIMARY_CARE_HOLISTIC', functionNameTh:'ปฐมภูมิแบบองค์รวม', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_PRIMARY_CARE_HOLISTIC', functionNameTh:'ปฐมภูมิแบบองค์รวม', professionCode:'PH_OFFICER', professionNameTh:'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข' },
  { ppFunctionCode:'PP_PRIMARY_CARE_HOLISTIC', functionNameTh:'ปฐมภูมิแบบองค์รวม', professionCode:'RN', professionNameTh:'พยาบาลวิชาชีพ' },
  { ppFunctionCode:'PP_PROMO_PREVENT_CONTROL', functionNameTh:'ส่งเสริม ป้องกัน ควบคุม', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_PROMO_PREVENT_CONTROL', functionNameTh:'ส่งเสริม ป้องกัน ควบคุม', professionCode:'PH_OFFICER', professionNameTh:'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข' },
  { ppFunctionCode:'PP_PUBLIC_HEALTH_ADMIN', functionNameTh:'บริหารสาธารณสุข', professionCode:'PH_ACAD', professionNameTh:'นักวิชาการสาธารณสุข' },
  { ppFunctionCode:'PP_SOCIAL_MEDICINE', functionNameTh:'เวชกรรมสังคม', professionCode:'FAM_MD', professionNameTh:'แพทย์เวชศาสตร์ครอบครัว' },
];

const MOCK_STEP_GUIDES = {
  0: {
    title:'Guide: เริ่มต้น Mocking Hospital',
    intro:'โหมดนี้ใช้สร้างโรงพยาบาลจำลองเพื่อทดลองกรอกข้อมูลเองทั้งหมด โดยข้อมูลจะถูกบันทึกแยกจากฐานข้อมูลจริง',
    bullets:[
      'กดการ์ด "สร้าง Mocking Hospital" เพื่อสร้าง draft scenario สำหรับทดลอง',
      'ระบบจะ autosave ค่าแต่ละ step ลง SQLite mock database โดยไม่ทับข้อมูลจริง',
      'เหมาะสำหรับ workshop, what-if analysis และทดลองแผนอัตรากำลัง'
    ],
    tip:'หลังจากเลือกแล้ว ให้กรอกข้อมูลตามลำดับ Step 1-7 เพื่อให้คำแนะนำครบ'
  },
  1: {
    title:'Guide: Data Quality Gate',
    intro:'ขั้นนี้ใช้ประเมินว่าข้อมูลมีคุณภาพพอสำหรับเชื่อผลการแนะนำหรือไม่',
    bullets:[
      'G01-G04 เป็น gate ขั้นต้น ถ้าค่าเกินเกณฑ์ ระบบยังคำนวณต่อได้แต่จะถือผลเป็น provisional',
      'พยายามกรอกตามข้อมูลจริงของ coding/data quality มากที่สุด',
      'ถ้ายังไม่มีข้อมูล ให้รู้ว่าความเชื่อมั่นของ recommendation จะลดลง'
    ],
    tip:'ค่าแต่ละตัวควรต่ำกว่า threshold ยิ่งต่ำยิ่งดี'
  },
  2: {
    title:'Guide: Need / HNI',
    intro:'ขั้นนี้สะท้อนภาระสุขภาพของประชากรที่โรงพยาบาลต้องรับผิดชอบ',
    bullets:[
      'กรอกประชากร, ผู้สูงอายุ, prevalence ของ CVD/Cancer/DM/CKD และ mental risk',
      'ปรับน้ำหนัก HNI เพื่อกำหนดว่าอยากให้องค์ประกอบใดมีผลมากกว่า',
      'ถ้าข้อมูล prevalence เป็นค่าระดับจังหวัดหรือพื้นที่รับผิดชอบ ให้กรอกตามค่าที่ใช้วางแผนจริง'
    ],
    tip:'น้ำหนักที่ใช้บ่อยคือ 40:40:20 แต่สามารถปรับตามโจทย์ workshop ได้'
  },
  3: {
    title:'Guide: Capacity / Specialty Staffing',
    intro:'ขั้นนี้มีทั้งกำลังคนรวม กำลังคนข้ามวิชาชีพ และกำลังคนเฉพาะทางที่ใช้รองรับ service plan',
    bullets:[
      'กรอกวิชาชีพหลักที่มีผลต่อ need, DALY และ outcome เช่น นายแพทย์ พยาบาลวิชาชีพ นักกายภาพบำบัด นักจิตวิทยา นักจิตวิทยาคลินิก',
      'Headcount คือจำนวนคนจริงที่มีอยู่ในทีมสาขานั้น',
      'FTE factor = สัดส่วนเวลาทำงานจริงใน service นั้น เช่น 1.0 = เต็มเวลา, 0.5 = ครึ่งเวลา',
      'Coverage 24x7 = ความพร้อมให้บริการตลอด 24 ชั่วโมง 7 วัน เช่น 100 = พร้อมครบทุกเวร, 50 = พร้อมเพียงบางช่วง'
    ],
    tip:'ถ้ามีคนอยู่จริงแต่ใช้กับ service นี้เพียงบางส่วน อย่าใส่ FTE factor เป็น 1 โดยอัตโนมัติ'
  },
  4: {
    title:'Guide: Gap',
    intro:'ขั้นนี้เปรียบเทียบภาระสุขภาพกับกำลังคนที่มีอยู่',
    bullets:[
      'Gap สูง แปลว่าภาระมากกว่าศักยภาพกำลังคน',
      'Gap ต่ำหรือเป็นลบ แปลว่ากำลังคนโดยรวมพอหรือเกินกว่าภาระ',
      'ขั้นนี้ยังไม่สรุปเพิ่มคนทันที ต้องดู Outcome และ Service Plan ประกอบ'
    ],
    tip:'ใช้ Step 4 เป็นภาพรวมก่อน แล้วค่อยตัดสินใน Step 5-7'
  },
  5: {
    title:'Guide: Outcome Validation',
    intro:'ขั้นนี้ใช้ outcome จริงเพื่อยืนยันว่า gap ที่เห็นสะท้อนปัญหาผลลัพธ์หรือไม่',
    bullets:[
      'กรอกตัวชี้วัด outcome หลัก A-H ที่ระบบใช้ เช่น A01, A04, A09, B01, C02, D01, F10',
      'ถ้า Gap สูงและ Outcome แย่พร้อมกัน จะหนุนเหตุผลให้เพิ่มคนมากขึ้น',
      'ถ้า Gap ต่ำแต่ Outcome แย่ มักชี้ไปที่ process หรือ protocol มากกว่าการขาดคน'
    ],
    tip:'พยายามกรอกชุด outcome ให้ครบเพื่อให้ confidence ของคำแนะนำสูงขึ้น'
  },
  6: {
    title:'Guide: Service Plan Deep Dive',
    intro:'ขั้นนี้ใช้ตัวชี้วัดรายโรคเพื่อ map ไปยังแพทย์และพยาบาลเฉพาะทางที่เกี่ยวข้อง',
    bullets:[
      'กรอก service plan indicator เช่น STEMI, Stroke, Sepsis, NICU, Maternal',
      'ระบบจะอ่านค่า indicator คู่กับ specialty capacity ที่กรอกใน Step 3',
      'ถ้าตัวชี้วัดแย่แต่ทีม specialty ปัจจุบันต่ำ ระบบจะเสนอการเพิ่มกำลังคนเฉพาะทางได้ชัดขึ้น'
    ],
    tip:'Step 6 คือจุดที่เชื่อม disease-specific burden เข้ากับ specialty staffing โดยตรง'
  },
  7: {
    title:'Guide: Recommendation',
    intro:'ขั้นนี้สรุปผลเชิงนโยบายจาก Need + Capacity + Outcome',
    bullets:[
      'ระบบจะสรุปว่าเพิ่มคน, คงอัตรา, หรือควรปรับ process ก่อน',
      'ในโหมด mock ระบบจะบันทึก run snapshot ของ scenario ไว้เพื่อเทียบรอบทดลอง',
      'ให้อ่านทั้งจำนวนที่แนะนำและ current specialty capacity ประกอบกัน'
    ],
    tip:'ถ้าจะใช้เพื่ออนุมัติจริง ควรมี workload/FTE จริงและ specialty registry ครบก่อน'
  }
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

function isMockHospital(name = selectedHospital) {
  return name === MOCK_HOSPITAL_NAME;
}

function getProvinceNameByCode(code) {
  return PROVINCE_NAME_BY_CODE[String(code || '').trim()] || null;
}

function normalizeHospitalLevel(level, fallback = '') {
  const normalized = HOSPITAL_LEVEL_LABEL_MAP[String(level || '').trim()] || String(level || '').trim();
  return normalized || fallback;
}

function getMockProfileText(code, fallback = '') {
  const entry = getMockEntry(code, 'pp_profile');
  if (!entry) return fallback;
  const textValue = String(entry.value_text ?? '').trim();
  if (textValue) return textValue;
  if (entry.value_json && typeof entry.value_json === 'string') return entry.value_json;
  if (entry.value_num !== null && entry.value_num !== undefined && !Number.isNaN(Number(entry.value_num))) {
    return String(entry.value_num);
  }
  return fallback;
}

function getMockProfileNumeric(code, fallback = 0) {
  const entry = getMockEntry(code, 'pp_profile');
  if (!entry) return fallback;
  const value = parseFloat(entry.value_num);
  return Number.isNaN(value) ? fallback : value;
}

function getMockProfileConfig() {
  const provinceCode = getMockProfileText('province_code', '');
  const provinceName = getMockProfileText('province_name', getProvinceNameByCode(provinceCode) || 'Sandbox');
  const hospitalLevel = normalizeHospitalLevel(
    getMockProfileText('hospital_level', MOCK_DEFAULT_HOSPITAL_LEVEL),
    MOCK_DEFAULT_HOSPITAL_LEVEL,
  );
  const amphurCode = getMockProfileText('amphur_code', '');
  const amphurName = getMockProfileText('amphur_name', '');
  const populationSource = getMockProfileText('population_source', '');
  const loaded = getMockProfileNumeric('profile_loaded', 0) === 1;
  return {
    hospitalLevel,
    provinceCode,
    provinceName,
    amphurCode,
    amphurName,
    populationTotal: Math.max(0, Math.round(getMockProfileNumeric('population_total', 0))),
    populationMale: Math.max(0, Math.round(getMockProfileNumeric('population_male', 0))),
    populationFemale: Math.max(0, Math.round(getMockProfileNumeric('population_female', 0))),
    populationReferenceYear: getMockProfileText('population_reference_year', ''),
    populationSource,
    loaded,
  };
}

function getHospitalDisplayProvince(name = selectedHospital) {
  if (!isMockHospital(name)) return HOSP_CONFIG[name]?.province || '-';
  const profile = getMockProfileConfig();
  if (profile.amphurName && profile.provinceName && profile.loaded) {
    return `${profile.provinceName} | อำเภอ${profile.amphurName}`;
  }
  if (profile.provinceName && profile.provinceName !== 'Sandbox') return profile.provinceName;
  return HOSP_CONFIG[name]?.province || 'Sandbox';
}

function getHospitalDisplayLevel(name = selectedHospital) {
  if (!isMockHospital(name)) return normalizeHospitalLevel(HOSP_CONFIG[name]?.level, HOSP_CONFIG[name]?.level || '-');
  const profile = getMockProfileConfig();
  return normalizeHospitalLevel(profile.hospitalLevel, MOCK_DEFAULT_HOSPITAL_LEVEL);
}

function getMockTemplateHospitalOptions(profile = getMockProfileConfig()) {
  return Object.keys(HOSP_CONFIG)
    .filter((name) => !isMockHospital(name))
    .sort((a, b) => {
      const score = (name) => {
        let value = 0;
        if (normalizeHospitalLevel(HOSP_CONFIG[name]?.level) === normalizeHospitalLevel(profile.hospitalLevel)) value += 2;
        if (HOSP_CONFIG[name]?.province === profile.provinceName) value += 1;
        return value;
      };
      return score(b) - score(a) || a.localeCompare(b);
    });
}

function getDefaultTemplateHospital(profile = getMockProfileConfig()) {
  const options = getMockTemplateHospitalOptions(profile);
  return options[0] || '';
}

function getSelectedTemplateHospital(profile = getMockProfileConfig(), allowDefault = false) {
  const stored = getMockProfileText('template_hospital', '');
  const options = getMockTemplateHospitalOptions(profile);
  if (stored && options.includes(stored)) return stored;
  return allowDefault ? getDefaultTemplateHospital(profile) : '';
}

function getMockClinicalBaselineSummary(profile = getMockProfileConfig()) {
  const label = getMockProfileText('clinical_baseline_label', '');
  const note = getMockProfileText('clinical_baseline_note', '');
  const templateHospital = getMockProfileText('template_hospital', '');
  const capacitySource = getMockProfileText('clinical_capacity_source', '');
  const outcomeSource = getMockProfileText('clinical_outcome_source', '');
  const servicePlanSource = getMockProfileText('clinical_service_plan_source', '');
  const ppSource = getMockProfileText('pp_baseline_source', 'district_baseline');
  return {
    label: label || 'Clinical baseline จะ preload จาก district profile ตามอำเภอและระดับโรงพยาบาล',
    note,
    templateHospital,
    capacitySource,
    outcomeSource,
    servicePlanSource,
    ppSource,
  };
}

function getMockInputKey(code, scope = 'global') {
  return `${scope}::${code}`;
}

function normalizeMockComparableValue(entry) {
  if (!entry) return null;
  if (entry.value_num !== null && entry.value_num !== undefined && !Number.isNaN(Number(entry.value_num))) {
    return Number(entry.value_num);
  }
  if (entry.value_text !== null && entry.value_text !== undefined) {
    return String(entry.value_text);
  }
  if (entry.value_json !== null && entry.value_json !== undefined) {
    if (typeof entry.value_json === 'string') return entry.value_json;
    return JSON.stringify(entry.value_json);
  }
  return null;
}

function getMockFieldBaselineState(code, scope = 'global', baselineScope = null) {
  if (isMockHospital() && !getMockProfileConfig().loaded) return null;
  if (!baselineScope) return null;
  const currentEntry = getMockEntry(code, scope);
  const baselineEntry = getMockEntry(code, baselineScope);
  if (!baselineEntry) return null;
  const currentValue = normalizeMockComparableValue(currentEntry);
  const baselineValue = normalizeMockComparableValue(baselineEntry);
  if (typeof currentValue === 'number' && typeof baselineValue === 'number') {
    return Math.abs(currentValue - baselineValue) < 0.0001 ? 'preloaded' : 'edited';
  }
  return currentValue === baselineValue ? 'preloaded' : 'edited';
}

function hasBaselineScopeValues(baselineScope) {
  if (isMockHospital() && !getMockProfileConfig().loaded) return false;
  return Object.values(mockSession.inputs || {}).some((entry) => entry.scope === baselineScope);
}

function persistMockSessionState() {
  localStorage.setItem(
    MOCK_STORAGE_KEY,
    JSON.stringify({
      hospitalId: mockSession.hospitalId,
      scenarioId: mockSession.scenarioId,
      lastRunSignature: mockSession.lastRunSignature,
    }),
  );
}

function restoreMockSessionState() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    mockSession.hospitalId = saved.hospitalId || null;
    mockSession.scenarioId = saved.scenarioId || null;
    mockSession.lastRunSignature = saved.lastRunSignature || null;
  } catch (error) {
    console.warn('Unable to restore mock session', error);
  }
}

function updateMockStatus(state, text) {
  const badge = document.getElementById('mockStatus');
  if (!badge) return;
  badge.className = 'badge';
  if (state === 'inactive') badge.classList.add('badge-muted');
  if (state === 'loading' || state === 'saving' || state === 'ready') badge.classList.add('badge-info');
  if (state === 'warn') badge.classList.add('badge-warn');
  if (state === 'error') badge.classList.add('badge-error');
  badge.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function registerAuditPayload(prefix, metricCode, payload) {
  const key = `${prefix}-${metricCode}`;
  auditPayloadRegistry[key] = {
    label: payload?.label || metricCode,
    sql: payload?.sql || '',
    source_rows: Array.isArray(payload?.source_rows) ? payload.source_rows : [],
  };
  return key;
}

function buildAuditSourceRowText(source) {
  const parts = [
    source?.position_name_th || '',
    source?.position_group_name || '',
    source?.specialist_name || '',
  ].filter(Boolean);
  if (Array.isArray(source?.matched_functions) && source.matched_functions.length) {
    parts.push(source.matched_functions.join(', '));
  }
  return parts.join(' | ');
}

function cacheDictionary(domain, dictionary) {
  if (!dictionary || typeof dictionary !== 'object') return;
  workforceDictionaryRegistry[domain] = {
    ...(workforceDictionaryRegistry[domain] || {}),
    ...dictionary,
  };
}

function getDictionaryEntry(domain, code) {
  return workforceDictionaryRegistry[domain]?.[code] || null;
}

function buildDictionaryButtonHtml(domain, code, label = 'ดูนิยาม Data Dictionary') {
  return `<button type="button" class="dictionary-link-button" data-dictionary-domain="${domain}" data-dictionary-code="${code}">${label}</button>`;
}

function openDictionaryModal(domain, code) {
  const entry = getDictionaryEntry(domain, code);
  if (!entry) {
    updateMockStatus('warn', `ยังไม่พบ Data Dictionary: ${code}`);
    return;
  }
  const modal = document.getElementById('dictionaryModal');
  const title = document.getElementById('dictionaryModalTitle');
  const body = document.getElementById('dictionaryModalBody');
  if (!modal || !title || !body) return;
  const extraItems = [];
  if (entry.rate_unit_th) extraItems.push(`<div class="mini-row"><span>หน่วยอัตรา</span><strong>${escapeHtml(entry.rate_unit_th)}</strong></div>`);
  if (Array.isArray(entry.exact_position_names) && entry.exact_position_names.length) {
    extraItems.push(`<div class="mini-row"><span>ตำแหน่งที่นับ</span><strong>${escapeHtml(entry.exact_position_names.join(', '))}</strong></div>`);
  }
  title.textContent = entry.label_th || entry.label || code;
  body.innerHTML = `
    <p style="font-size:14px;line-height:1.7;color:var(--text1)">${escapeHtml(entry.note_th || entry.note || 'ไม่มีคำอธิบาย')}</p>
    <div class="split-inner-columns" style="margin-top:16px">
      <div class="card split-inner-card">
        <h4>Dictionary Key</h4>
        <div class="mini-row"><span>domain</span><strong>${escapeHtml(domain)}</strong></div>
        <div class="mini-row"><span>code</span><strong>${escapeHtml(code)}</strong></div>
      </div>
      <div class="card split-inner-card">
        <h4>Definition</h4>
        ${extraItems.join('') || '<p class="mini-empty">ไม่มี metadata เพิ่มเติม</p>'}
      </div>
    </div>
  `;
  modal.classList.add('active');
}

function closeDictionaryModal() {
  document.getElementById('dictionaryModal')?.classList.remove('active');
}

function buildAuditDisclosureHtml(prefix, metricCode, item) {
  const payloadKey = registerAuditPayload(prefix, metricCode, item);
  return `
    <details class="audit-disclosure">
      <summary class="audit-toggle">ดู SQL / source rows</summary>
      <div class="audit-body">
        <div class="audit-action-row">
          <button type="button" class="audit-action-button" data-audit-action="copy-sql" data-audit-key="${payloadKey}">copy SQL</button>
          <button type="button" class="audit-action-button" data-audit-action="export-rows" data-audit-key="${payloadKey}">export source rows</button>
        </div>
        <div class="audit-sql-label">SQL</div>
        <pre class="audit-sql">${escapeHtml(item?.sql || '-- no sql --')}</pre>
        <div class="audit-sql-label">Source Rows</div>
        ${item?.source_rows?.length ? item.source_rows.map((source) => `
          <div class="mini-row audit-source-row">
            <span>${escapeHtml(buildAuditSourceRowText(source))}</span>
            <strong>${escapeHtml(source.count)}</strong>
          </div>
        `).join('') : '<p class="mini-empty">ไม่พบ source rows ตามนิยามนี้</p>'}
      </div>
    </details>
  `;
}

function buildAuditPanelHtml(title, prefix, entries, emptyText = 'ไม่พบข้อมูล audit trail') {
  const validEntries = (entries || []).filter((entry) => entry?.item);
  if (!validEntries.length) return '';
  return `
    <details class="card split-inner-card audit-panel">
      <summary class="audit-panel-summary">
        <span>${escapeHtml(title)}</span>
        <strong>${validEntries.length} metrics</strong>
      </summary>
      <div class="audit-panel-body">
        ${validEntries.map(({ metricCode, item }) => {
          const auditCount = Number.isInteger(item.count)
            ? item.count.toLocaleString()
            : Number(item.count || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
          return `
            <div class="mini-row"><span>${escapeHtml(item.label)}</span><strong>${auditCount}</strong></div>
            <div class="mini-row" style="padding-left:12px"><span>${escapeHtml(item.note || '')}</span><strong></strong></div>
            ${buildAuditDisclosureHtml(prefix, metricCode, item)}
          `;
        }).join('') || `<p class="mini-empty">${escapeHtml(emptyText)}</p>`}
      </div>
    </details>
  `;
}

function formatPopulationSourceBadge(source, year) {
  const refYear = year ? String(year) : '';
  if (source === 'verified_amphur_population_hdc') {
    return `Population source: HDC ${refYear || 'verified'}`;
  }
  if (source === 'verified_amphur_population_dopa') {
    return `Population source: DOPA ${refYear || 'fallback'} fallback`;
  }
  if (source === 'unit_population_proxy') {
    return 'Population source: unit proxy';
  }
  if (source === 'district_office_proxy') {
    return 'Population source: district office proxy';
  }
  return 'Population source: pending verification';
}

function getClinicalDenominatorMeta(preview) {
  const denominator = preview?.denominator || {};
  const population = parseFloat(denominator.denominator_population_total || preview?.population_total || 0) || 0;
  const scopeType = denominator.scope_type || preview?.clinical_scope_type || '';
  const scopeName = denominator.scope_name || preview?.clinical_scope_name || '-';
  const method = denominator.denominator_method || 'frontend_population_fallback';
  const workloadShare = Number(denominator.workload_share || 0);
  let methodLabel = 'frontend fallback';
  if (method === 'amphur_population') methodLabel = 'อำเภอ';
  if (method === 'province_workload_blend') methodLabel = 'จังหวัดปรับตาม workload';
  if (method === 'network_zone_workload_adjusted') methodLabel = 'network zone ปรับตาม workload';
  if (method === 'workload_population_proxy') methodLabel = 'workload proxy';
  const scopeLabel = scopeType === 'province'
    ? `จังหวัด${scopeName}`
    : scopeType === 'network_zone'
      ? `network ${scopeName}`
      : scopeType === 'amphur'
        ? `อำเภอ${scopeName}`
        : scopeName;
  const shareText = workloadShare > 0 ? ` | workload share ${(workloadShare * 100).toFixed(1)}%` : '';
  return {
    population,
    label: `Clinical denominator: ${scopeLabel} | ${methodLabel}${shareText}`,
  };
}

function buildServiceMatrixPanelHtml(preview, workloadReferenceLookup = {}) {
  const matrix = preview?.serviceDenominatorMatrix || [];
  const denominatorMeta = getClinicalDenominatorMeta(preview);
  if (!matrix.length) {
    return `
      <div class="service-matrix-header">
        <div>
          <h3>Clinical Service Matrix</h3>
          <p>${escapeHtml(denominatorMeta.label)}</p>
        </div>
      </div>
      <p class="run-history-empty">ยังไม่พบ service-level denominator matrix จาก backend</p>
    `;
  }
  const cards = matrix.map((item) => {
    const reference = workloadReferenceLookup[item.metric_code] || {};
    const strategy = reference.source_strategy || item.source_strategy || '';
    const sourceDetail = reference.source_detail || item.source_detail || {};
    const datasets = Array.isArray(sourceDetail.public_datasets) ? sourceDetail.public_datasets : [];
    const manualCodes = Array.isArray(sourceDetail.manual_activity_codes) ? sourceDetail.manual_activity_codes : [];
    const note = sourceDetail.notes || reference.metric_note_th || '';
    const actualRate = Number.isFinite(item.actualRatePer10k) ? item.actualRatePer10k.toFixed(1) : '-';
    const referenceRate = Number.isFinite(item.referenceRatePer10k) ? item.referenceRatePer10k.toFixed(1) : '-';
    const professions = (item.mappedProfessions || []).map((code) => getProfessionLabel(code)).filter(Boolean);
    const safeStatus = escapeHtml(item.availabilityStatus || 'missing');
    return `
      <div class="service-matrix-card">
        <h4>${escapeHtml(item.metricNameTh || item.metric_code)}</h4>
        <div class="service-matrix-subtitle">${escapeHtml(item.serviceFunction || item.metric_code)}</div>
        <div class="service-status-row">
          <span class="service-chip status-${safeStatus}">${escapeHtml(formatServiceStatusLabel(item.availabilityStatus))}</span>
          <span class="service-chip">${escapeHtml(formatServiceStrategyLabel(strategy))}</span>
          <span class="service-chip">sample ${Number(item.sampleCount || 0)}</span>
          <span class="service-chip">coverage ${escapeHtml(formatCoverageRatio(item.coverageRatio))}</span>
        </div>
        <div class="service-metric-row"><span>actual rate</span><strong>${actualRate} / 10k</strong></div>
        <div class="service-metric-row"><span>observed reference</span><strong>${referenceRate} / 10k</strong></div>
        <div class="service-metric-row"><span>denominator</span><strong>${Number(item.denominatorPopulationTotal || 0).toLocaleString()}</strong></div>
        ${datasets.length ? `<div class="service-tag-list">${datasets.map((dataset) => `<span class="service-tag">${escapeHtml(dataset)}</span>`).join('')}</div>` : ''}
        ${manualCodes.length ? `<div class="service-tag-list">${manualCodes.map((code) => `<span class="service-tag">${escapeHtml(code)}</span>`).join('')}</div>` : ''}
        ${professions.length ? `<div class="service-tag-list">${professions.map((label) => `<span class="service-tag">${escapeHtml(label)}</span>`).join('')}</div>` : ''}
        ${note ? `<div class="service-source-note">${escapeHtml(note)}</div>` : ''}
      </div>
    `;
  }).join('');
  return `
    <div class="service-matrix-header">
      <div>
        <h3>Clinical Service Matrix</h3>
        <p>${escapeHtml(denominatorMeta.label)} | แสดง actual rate, observed reference, source strategy และสถานะข้อมูลราย function</p>
      </div>
    </div>
    <div class="service-matrix-grid">${cards}</div>
  `;
}

function setHniSliderValue(sliderId, labelId, value) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  if (!slider || value === undefined || value === null || Number.isNaN(Number(value))) return;
  const safe = Math.max(0, Math.min(100, Number(value)));
  slider.value = safe;
  if (label) label.textContent = String(Math.round(safe));
}

function activateRunReplay(run) {
  if (!run || !run.result_json) return;
  const request = run.request_json || {};
  const preview = normalizeNeedFtePreview(run.result_json || {});
  activeRunReplay = {
    runId: run.run_id,
    hospitalName: run.hospital_name,
    createdAt: run.created_at,
    engineVersion: run.engine_version,
    persistedFromStep: run.persisted_from_step,
    scopeType: run.scope_type,
    scopeName: run.scope_name,
    denominatorMethod: run.denominator_method,
    request,
    preview,
    activatedAt: new Date().toISOString(),
  };
  setHniSliderValue('sliderElderly', 'wElderly', request.weight_elderly);
  setHniSliderValue('sliderChronic', 'wChronic', request.weight_chronic);
  setHniSliderValue('sliderMental', 'wMental', request.weight_mental);
  window._needFtePreview = preview;
  window._hni = Number(preview.hni_score || 0);
  window._professionMix = preview.profession_mix || preview.professionMix || {};
  const professionWci = computeMultiProfessionWCI(run.hospital_name || selectedHospital, preview);
  window._wci = professionWci.wci;
  window._professionMix = professionWci.mix;
  updateMockStatus('ready', `Replay run: ${run.run_id}`);
}

function clearRunReplay() {
  if (!activeRunReplay) return;
  activeRunReplay = null;
  updateMockStatus('ready', 'กลับสู่ผลคำนวณปัจจุบัน');
}

async function rerenderReplayDependentStep() {
  if (currentStep === 3) {
    await renderStep3();
    return;
  }
  if (currentStep === 4) {
    await renderStep4();
    return;
  }
  if (currentStep === 7) {
    await renderStep7();
  }
}

async function handleHniSliderInput() {
  const replayWasActive = !!activeRunReplay;
  if (replayWasActive) {
    clearRunReplay();
  }
  if (selectedHospital) {
    computeHNI();
  }
  if (replayWasActive) {
    await rerenderReplayDependentStep();
  }
}

function buildReplayProvenanceHtml() {
  if (!activeRunReplay) return '';
  const scopeLabel = [activeRunReplay.scopeType, activeRunReplay.scopeName].filter(Boolean).join(' ');
  return `
    <div class="replay-provenance-card">
      <div class="replay-provenance-header">
        <div>
          <span class="replay-provenance-kicker">Replay Mode</span>
          <h4>กำลังดู persisted result จาก backend</h4>
          <p>ค่าที่แสดงใน panel นี้มาจาก run ที่บันทึกไว้ ไม่ใช่ current recompute ของค่าปัจจุบัน</p>
        </div>
        <button type="button" class="run-history-action-button secondary" data-run-action="clear-replay">กลับสู่ค่าปัจจุบัน</button>
      </div>
      <div class="replay-provenance-meta">
        <span class="run-history-chip replay-chip-active">persisted replay</span>
        <span class="run-history-chip">run_id ${escapeHtml(activeRunReplay.runId || '-')}</span>
        <span class="run-history-chip">created ${escapeHtml(formatAuditTimestamp(activeRunReplay.createdAt || activeRunReplay.activatedAt))}</span>
        <span class="run-history-chip">engine ${escapeHtml(activeRunReplay.engineVersion || '-')}</span>
        ${activeRunReplay.persistedFromStep ? `<span class="run-history-chip">from ${escapeHtml(activeRunReplay.persistedFromStep)}</span>` : ''}
        ${scopeLabel ? `<span class="run-history-chip">${escapeHtml(scopeLabel)}</span>` : ''}
        ${activeRunReplay.denominatorMethod ? `<span class="run-history-chip">${escapeHtml(activeRunReplay.denominatorMethod)}</span>` : ''}
      </div>
    </div>
  `;
}

function buildRunHistoryCardHtml(runs = []) {
  const activeRunId = activeRunReplay?.runId;
  if (!runs.length) {
    return `
      <div class="run-history-header">
        <div>
          <h3>Analysis Run History</h3>
          <p>เก็บประวัติ preview ที่ถูก persist จาก backend เพื่อใช้ audit และ replay การคำนวณ</p>
        </div>
      </div>
      <p class="run-history-empty">ยังไม่พบ run history สำหรับโรงพยาบาลนี้</p>
    `;
  }
  const items = runs.map((run) => {
    const result = normalizeNeedFtePreview(run.result_json || {});
    const topRows = (result.rows || []).filter((item) => item.gapFte > 0.05).slice(0, 3);
    const isActive = activeRunId === run.run_id;
    return `
      <div class="run-history-item ${isActive ? 'active' : ''}">
        <h4>${escapeHtml(formatAuditTimestamp(run.created_at))}</h4>
        <div class="run-history-meta">
          <span class="run-history-chip">${escapeHtml(run.engine_version || '-')}</span>
          <span class="run-history-chip">${escapeHtml(run.scope_type || '-')} ${escapeHtml(run.scope_name || '')}</span>
          <span class="run-history-chip">${escapeHtml(run.denominator_method || '-')}</span>
          <span class="run-history-chip">ฐาน ${Number(run.denominator_population_total || 0).toLocaleString()}</span>
          <span class="run-history-chip">${escapeHtml(run.persisted_from_step || '-')}</span>
        </div>
        <div class="mini-row"><span>HNI</span><strong>${Number(result.hni_score || 0).toFixed(1)}</strong></div>
        <div class="mini-row"><span>burden multiplier</span><strong>${Number(result.burdenMultiplier || 0).toFixed(2)}</strong></div>
        ${topRows.length ? topRows.map((item) => `<div class="mini-row"><span>${escapeHtml(item.label)}</span><strong>${item.gapFte.toFixed(1)} FTE → +${item.suggestedAdd}</strong></div>`).join('') : '<p class="run-history-empty">run นี้ไม่พบ gap เพิ่มเติม</p>'}
        <div class="run-history-action-row">
          <button type="button" class="run-history-action-button" data-run-action="replay" data-run-id="${run.run_id}">replay run นี้</button>
          ${isActive ? '<button type="button" class="run-history-action-button secondary" data-run-action="clear-replay">กลับสู่ค่าปัจจุบัน</button>' : ''}
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="run-history-header">
      <div>
        <h3>Analysis Run History</h3>
        <p>ใช้ตรวจย้อนกลับ denominator, engine version, และ replay ผล Need_FTE จาก backend โดยไม่ต้องคำนวณใหม่ทันที</p>
      </div>
      ${activeRunReplay ? '<button type="button" class="run-history-action-button secondary" data-run-action="clear-replay">ล้าง replay</button>' : ''}
    </div>
    <div class="run-history-list">${items}</div>
  `;
}

async function copyAuditSql(auditKey) {
  const payload = auditPayloadRegistry[auditKey];
  if (!payload) return;
  const text = payload.sql || '-- no sql --';
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    updateMockStatus('ready', `Copied SQL: ${payload.label}`);
  } catch (error) {
    console.warn('Unable to copy audit SQL', error);
    updateMockStatus('warn', `Copy SQL ไม่สำเร็จ: ${payload.label}`);
  }
}

function exportAuditSourceRows(auditKey) {
  const payload = auditPayloadRegistry[auditKey];
  if (!payload) return;
  const rows = payload.source_rows || [];
  const headers = ['position_name_th', 'position_group_name', 'specialist_name', 'count', 'fte', 'matched_functions'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => {
      const value = header === 'matched_functions'
        ? (Array.isArray(row[header]) ? row[header].join('; ') : '')
        : (row[header] ?? '');
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${auditKey}-source-rows.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  updateMockStatus('ready', `Exported source rows: ${payload.label}`);
}

function getPpProfessionDictionary(summary) {
  return summary?.dictionary || {};
}

function getPpProfessionLabel(summary, professionCode, fallback = null) {
  return getPpProfessionDictionary(summary)?.[professionCode]?.label_th || fallback || professionCode;
}

function getPpProfessionNote(summary, professionCode) {
  return getPpProfessionDictionary(summary)?.[professionCode]?.note_th || '';
}

function createApiError(response, fallback) {
  return response.text().then((body) => {
    throw new Error(body || fallback);
  });
}

async function resolveMockApiBase() {
  const sameOrigin = `${window.location.origin}/api/mock`;
  const devCandidates = ['http://127.0.0.1:8765/api/mock', 'http://127.0.0.1:8000/api/mock'];
  const prefersSameOrigin = ['8765', ''].includes(window.location.port);
  const candidates = (prefersSameOrigin
    ? [sameOrigin, '/api/mock', ...devCandidates]
    : [...devCandidates, sameOrigin, '/api/mock']
  ).filter((value, index, array) => value && array.indexOf(value) === index);

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/catalog`, { method:'GET' });
      if (response.ok) {
        MOCK_API_BASE = candidate;
        return;
      }
    } catch (error) {
      console.warn('Mock API candidate unavailable', candidate, error);
    }
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${MOCK_API_BASE}${path}`, {
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    await createApiError(response, `Request failed: ${path}`);
  }
  return response.json();
}

function getPpApiBase() {
  return MOCK_API_BASE.replace(/\/mock$/, '/pp');
}

function getAnalysisApiBase() {
  return MOCK_API_BASE.replace(/\/mock$/, '/analysis');
}

async function fetchAnalysisConfig(force = false) {
  if (analysisConfigCache && !force) return analysisConfigCache;
  try {
    const response = await fetch(`${getAnalysisApiBase()}/config`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, 'Unable to load analysis config');
    }
    analysisConfigCache = await response.json();
    return analysisConfigCache;
  } catch (error) {
    console.warn('Unable to load analysis config', error);
    analysisConfigCache = analysisConfigCache || { benchmarks:{}, indicator_policies:{}, phase1_indicator_count:12 };
    return analysisConfigCache;
  }
}

function getBenchmarkLookup(domain) {
  return analysisConfigCache?.benchmarks?.[domain] || {};
}

function getPhase1IndicatorCount() {
  return parseInt(analysisConfigCache?.phase1_indicator_count || 12, 10) || 12;
}

async function fetchWorkloadReferences(force = false) {
  if (workloadReferenceCache && !force) return workloadReferenceCache;
  try {
    const response = await fetch(`${getAnalysisApiBase()}/workload-references`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, 'Unable to load workload references');
    }
    const data = await response.json();
    workloadReferenceCache = (data.workload_references || []).reduce((acc, item) => {
      acc[item.metric_code] = item;
      return acc;
    }, {});
    return workloadReferenceCache;
  } catch (error) {
    console.warn('Unable to load workload references', error);
    workloadReferenceCache = workloadReferenceCache || {};
    return workloadReferenceCache;
  }
}

async function fetchAnalysisRunHistory(hospitalName = selectedHospital, force = false) {
  if (!hospitalName || isMockHospital(hospitalName)) return [];
  if (analysisRunHistoryCache[hospitalName] && !force) return analysisRunHistoryCache[hospitalName];
  try {
    const params = new URLSearchParams({ hospital_name: hospitalName, limit: '12' });
    const response = await fetch(`${getAnalysisApiBase()}/run-history?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load run history for ${hospitalName}`);
    }
    const data = await response.json();
    analysisRunHistoryCache[hospitalName] = data.runs || [];
    return analysisRunHistoryCache[hospitalName];
  } catch (error) {
    console.warn('Unable to load analysis run history', hospitalName, error);
    analysisRunHistoryCache[hospitalName] = [];
    return [];
  }
}

function formatAuditTimestamp(value) {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function formatServiceStatusLabel(status) {
  const safe = (status || 'missing').toLowerCase();
  if (safe === 'available' || safe === 'observed') return 'observed';
  if (safe === 'sparse') return 'sparse';
  if (safe === 'manual_source_required') return 'manual required';
  if (safe === 'manual_required') return 'manual required';
  if (safe === 'manual_preferred') return 'manual preferred';
  return safe.replace(/_/g, ' ');
}

function formatServiceStrategyLabel(strategy) {
  const safe = (strategy || '').toLowerCase();
  if (safe === 'public_direct_plus_manual_optional') return 'public direct + manual optional';
  if (safe === 'public_proxy_plus_manual_preferred') return 'public proxy + manual preferred';
  if (safe === 'manual_required') return 'manual required';
  if (safe === 'manual_preferred') return 'manual preferred';
  if (safe === 'internal_available') return 'internal available';
  return safe ? safe.replace(/_/g, ' ') : 'pending strategy';
}

function formatCoverageRatio(value) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${(value * 100).toFixed(0)}%`;
}

function buildNeedFtePreviewPayload(name = selectedHospital) {
  const hospital = HOSPITALS[name] || {};
  const populationTotal = getClinicalPopulationBase(name);
  const provinceCode = getSelectedProvinceCode(name);
  const scope = hospitalScopeCache[name] || null;
  const mockProfile = isMockHospital(name) ? getMockProfileConfig() : null;
  const indicatorValues = Object.fromEntries(
    Object.entries({
      RH0101: parseFloat(getIndicatorValue(name, 'RH0101')),
      PS0001: parseFloat(getIndicatorValue(name, 'PS0001')),
    }).filter(([, value]) => Number.isFinite(value)),
  );
  return {
    hospital_name: name,
    province_code: provinceCode,
    unit_name: isMockHospital(name) ? null : (scope?.lookup_unit_name || name),
    population_total: populationTotal,
    elderly_rate_pct: parseFloat(hospital.hni?.['Elderly_Rate_%'] || hospital.hni?.['elderly_rate_norm'] || 0) || 0,
    chronic_rate_pct: parseFloat(getChronicPrevalence(name)) || 0,
    mental_risk_rate_per100k: parseFloat(hospital.hni?.['Mental_Risk_Rate_%'] || hospital.hni?.['mental_rate_norm'] || 0) || 0,
    weight_elderly: parseFloat(document.getElementById('sliderElderly')?.value || 40) || 40,
    weight_chronic: parseFloat(document.getElementById('sliderChronic')?.value || 40) || 40,
    weight_mental: parseFloat(document.getElementById('sliderMental')?.value || 20) || 20,
    indicator_values: indicatorValues,
    workforce_counts: Object.fromEntries(
      PROFESSION_FIELDS.map((field) => [field.code, getProfessionCount(field.code, name)]),
    ),
    clinical_scope_type: scope?.clinical_scope_type || mockProfile?.hospitalLevel || HOSP_CONFIG[name]?.level || null,
    clinical_scope_name: scope?.clinical_scope_name || mockProfile?.provinceName || HOSP_CONFIG[name]?.province || null,
  };
}

function normalizeNeedFtePreview(preview) {
  if (!preview) return preview;
  const denominator = preview.denominator || {};
  const workloadPressure = preview.workload_pressure || preview.workloadPressure || {};
  return {
    ...preview,
    populationTotal: Number(preview.populationTotal ?? preview.population_total ?? preview.population ?? 0) || 0,
    requestedPopulationTotal: Number(preview.requestedPopulationTotal ?? preview.requested_population_total ?? 0) || 0,
    burdenMultiplier: Number(preview.burdenMultiplier ?? preview.burden_multiplier ?? 1) || 1,
    denominator: {
      ...denominator,
      scopeType: denominator.scopeType ?? denominator.scope_type ?? preview.clinical_scope_type ?? null,
      scopeName: denominator.scopeName ?? denominator.scope_name ?? preview.clinical_scope_name ?? null,
      denominatorMethod: denominator.denominatorMethod ?? denominator.denominator_method ?? null,
      denominatorPopulationTotal: Number(denominator.denominatorPopulationTotal ?? denominator.denominator_population_total ?? preview.population_total ?? 0) || 0,
      workloadPopulationProxy: Number(denominator.workloadPopulationProxy ?? denominator.workload_population_proxy ?? 0) || 0,
      workloadShare: Number(denominator.workloadShare ?? denominator.workload_share ?? 0) || 0,
    },
    workloadPressure: {
      ...workloadPressure,
      ratesPer10k: workloadPressure.ratesPer10k ?? workloadPressure.rates_per_10k ?? {},
      professionPressure: workloadPressure.professionPressure ?? workloadPressure.profession_pressure ?? {},
      referenceLookup: workloadPressure.referenceLookup ?? workloadPressure.reference_lookup ?? {},
    },
    serviceDenominatorMatrix: (preview.serviceDenominatorMatrix || preview.service_denominator_matrix || []).map((item) => ({
      ...item,
      actualRatePer10k: item.actualRatePer10k === null || item.actualRatePer10k === undefined
        ? (item.actual_rate_per_10k === null || item.actual_rate_per_10k === undefined ? null : Number(item.actual_rate_per_10k))
        : Number(item.actualRatePer10k),
      referenceRatePer10k: item.referenceRatePer10k === null || item.referenceRatePer10k === undefined
        ? (item.reference_rate_per_10k === null || item.reference_rate_per_10k === undefined ? null : Number(item.reference_rate_per_10k))
        : Number(item.referenceRatePer10k),
      sampleCount: Number(item.sampleCount ?? item.sample_count ?? 0),
      coverageRatio: Number(item.coverageRatio ?? item.coverage_ratio ?? 0),
      serviceFunction: item.serviceFunction ?? item.service_function ?? '',
      metricNameTh: item.metricNameTh ?? item.metric_name_th ?? item.metric_code,
      mappedProfessions: item.mappedProfessions ?? item.mapped_professions ?? [],
      availabilityStatus: item.availabilityStatus ?? item.availability_status ?? 'missing',
    })),
    rows: (preview.rows || []).map((item) => ({
      ...item,
      label: item.label ?? item.profession_name_th ?? item.professionNameTh ?? item.profession_code,
      baselineNeed: Number(item.baselineNeed ?? item.baseline_need_fte ?? 0) || 0,
      needFte: Number(item.needFte ?? item.need_fte ?? 0) || 0,
      availableFte: Number(item.availableFte ?? item.available_fte ?? 0) || 0,
      gapFte: Number(item.gapFte ?? item.gap_fte ?? 0) || 0,
      suggestedAdd: Number(item.suggestedAdd ?? item.suggested_add ?? 0) || 0,
      professionCode: item.professionCode ?? item.profession_code ?? null,
      professionNameTh: item.professionNameTh ?? item.profession_name_th ?? item.label ?? null,
      targetRatio: Number(item.targetRatio ?? item.target_ratio ?? 0) || 0,
      defaultWeightPct: Number(item.defaultWeightPct ?? item.default_weight_pct ?? 0) || 0,
      mixPct: Number(item.mixPct ?? item.mix_pct ?? 0) || 0,
      mixAdjustment: Number(item.mixAdjustment ?? item.mix_adjustment ?? 0) || 0,
      burdenMultiplier: Number(item.burdenMultiplier ?? item.burden_multiplier ?? preview.burden_multiplier ?? preview.burdenMultiplier ?? 1) || 1,
    })),
  };
}

async function fetchNeedFtePreview(name = selectedHospital, force = false, persist = false, persistedFromStep = null) {
  if (activeRunReplay && activeRunReplay.hospitalName === name && activeRunReplay.preview) {
    return activeRunReplay.preview;
  }
  const payload = buildNeedFtePreviewPayload(name);
  payload.persist = !!persist;
  payload.persisted_from_step = persistedFromStep || null;
  const signature = JSON.stringify(payload);
  const cacheEntry = needFtePreviewCache[name];
  if (cacheEntry && cacheEntry.signature === signature && !force && !persist) return cacheEntry.preview;
  try {
    const response = await fetch(`${getAnalysisApiBase()}/need-fte-preview`, {
      method:'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      await createApiError(response, `Unable to load need FTE preview for ${name}`);
    }
    const data = await response.json();
    needFtePreviewCache[name] = { signature, preview: normalizeNeedFtePreview(data.preview || null) };
    return needFtePreviewCache[name].preview;
  } catch (error) {
    console.warn('Unable to load backend need FTE preview', name, error);
    const fallback = normalizeNeedFtePreview(computeClinicalNeedFtePreview(name, window._hni));
    needFtePreviewCache[name] = { signature, preview: fallback };
    return fallback;
  }
}

function getSelectedProvinceCode(name = selectedHospital) {
  if (isMockHospital(name)) {
    const profile = getMockProfileConfig();
    return profile.provinceCode || null;
  }
  const provinceName = HOSP_CONFIG[name]?.province;
  return PROVINCE_CODE_MAP[provinceName] || null;
}

async function fetchHospitalScope(hospitalName = selectedHospital) {
  if (!hospitalName || isMockHospital(hospitalName)) return null;
  if (hospitalScopeCache[hospitalName]) return hospitalScopeCache[hospitalName];
  try {
    const params = new URLSearchParams({ hospital_name: hospitalName });
    const response = await fetch(`${MOCK_API_BASE.replace(/\/mock$/, '/scope')}/hospital?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load hospital scope for ${hospitalName}`);
    }
    const data = await response.json();
    hospitalScopeCache[hospitalName] = data.scope || null;
    return hospitalScopeCache[hospitalName];
  } catch (error) {
    console.warn('Unable to load hospital scope', hospitalName, error);
    hospitalScopeCache[hospitalName] = null;
    return null;
  }
}

async function fetchPpProvinceSummary(provinceCode) {
  if (!provinceCode) return null;
  if (ppSummaryCache[provinceCode]) return ppSummaryCache[provinceCode];
  try {
    const response = await fetch(`${getPpApiBase()}/province-summary/${provinceCode}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load PP summary for ${provinceCode}`);
    }
    const data = await response.json();
    cacheDictionary('pp', data.summary?.dictionary);
    ppSummaryCache[provinceCode] = data.summary || null;
    return ppSummaryCache[provinceCode];
  } catch (error) {
    console.warn('Unable to load PP province summary', provinceCode, error);
    ppSummaryCache[provinceCode] = null;
    return null;
  }
}

async function fetchPpUnitCapacitySummary(provinceCode, unitName) {
  if (!provinceCode || !unitName) return null;
  const cacheKey = `${provinceCode}::${unitName}`;
  if (ppUnitCapacityCache[cacheKey]) return ppUnitCapacityCache[cacheKey];
  try {
    const params = new URLSearchParams({ province_code: provinceCode, unit_name: unitName });
    const response = await fetch(`${getPpApiBase()}/unit-capacity-summary?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load PP unit capacity for ${unitName}`);
    }
    const data = await response.json();
    cacheDictionary('pp', data.summary?.dictionary);
    ppUnitCapacityCache[cacheKey] = data.summary || null;
    return ppUnitCapacityCache[cacheKey];
  } catch (error) {
    console.warn('Unable to load PP unit capacity summary', provinceCode, unitName, error);
    ppUnitCapacityCache[cacheKey] = null;
    return null;
  }
}

async function fetchPpDistrictSummary(provinceCode) {
  if (!provinceCode) return [];
  if (ppDistrictCache[provinceCode]) return ppDistrictCache[provinceCode];
  try {
    const response = await fetch(`${getPpApiBase()}/district-summary/${provinceCode}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load PP district summary for ${provinceCode}`);
    }
    const data = await response.json();
    ppDistrictCache[provinceCode] = data.districts || [];
    return ppDistrictCache[provinceCode];
  } catch (error) {
    console.warn('Unable to load PP district summary', provinceCode, error);
    ppDistrictCache[provinceCode] = [];
    return [];
  }
}

async function fetchPpHospitalSummary(hospitalName = selectedHospital) {
  if (!hospitalName || isMockHospital(hospitalName)) return null;
  if (ppHospitalSummaryCache[hospitalName]) return ppHospitalSummaryCache[hospitalName];
  try {
    const params = new URLSearchParams({ hospital_name: hospitalName });
    const response = await fetch(`${getPpApiBase()}/hospital-summary?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load PP hospital summary for ${hospitalName}`);
    }
    const data = await response.json();
    cacheDictionary('pp', data.summary?.dictionary);
    if (data.scope) hospitalScopeCache[hospitalName] = data.scope;
    ppHospitalSummaryCache[hospitalName] = data.summary || null;
    return ppHospitalSummaryCache[hospitalName];
  } catch (error) {
    console.warn('Unable to load PP hospital summary', hospitalName, error);
    ppHospitalSummaryCache[hospitalName] = null;
    return null;
  }
}

async function fetchAmphurPopulationReference(provinceCode) {
  if (!provinceCode) return { source:'', rows:[] };
  if (amphurPopulationCache[provinceCode]) return amphurPopulationCache[provinceCode];
  try {
    const params = new URLSearchParams({ province_code: provinceCode });
    const response = await fetch(`${MOCK_API_BASE.replace(/\/mock$/, '/reference/amphur-population')}?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load amphur population for ${provinceCode}`);
    }
    const data = await response.json();
    amphurPopulationCache[provinceCode] = {
      source: data.source || '',
      rows: Array.isArray(data.rows) ? data.rows : [],
    };
    return amphurPopulationCache[provinceCode];
  } catch (error) {
    console.warn('Unable to load amphur population reference', provinceCode, error);
    amphurPopulationCache[provinceCode] = { source:'', rows:[] };
    return amphurPopulationCache[provinceCode];
  }
}

async function fetchPpAmphurOutcomeSummary(provinceCode, amphurCode) {
  if (!provinceCode || !amphurCode) return [];
  const cacheKey = `${provinceCode}::${amphurCode}`;
  if (ppAmphurOutcomeCache[cacheKey]) return ppAmphurOutcomeCache[cacheKey];
  try {
    const params = new URLSearchParams({ province_code: provinceCode, amphur_code: amphurCode });
    const response = await fetch(`${getPpApiBase()}/amphur-outcome-summary?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load PP amphur outcome summary for ${amphurCode}`);
    }
    const data = await response.json();
    ppAmphurOutcomeCache[cacheKey] = Array.isArray(data.outcomes) ? data.outcomes : [];
    return ppAmphurOutcomeCache[cacheKey];
  } catch (error) {
    console.warn('Unable to load PP amphur outcome summary', provinceCode, amphurCode, error);
    ppAmphurOutcomeCache[cacheKey] = [];
    return [];
  }
}

function computeMedian(values = []) {
  const numbers = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  if (numbers.length % 2 === 1) return numbers[middle];
  return (numbers[middle - 1] + numbers[middle]) / 2;
}

async function fetchDistrictBaselineProfile(provinceCode, amphurCode, hospitalLevel) {
  const normalizedLevel = normalizeHospitalLevel(hospitalLevel);
  if (!provinceCode || !amphurCode || !normalizedLevel) return null;
  const cacheKey = `${provinceCode}::${amphurCode}::${normalizedLevel}`;
  if (Object.prototype.hasOwnProperty.call(districtBaselineProfileCache, cacheKey)) {
    return districtBaselineProfileCache[cacheKey];
  }
  try {
    const params = new URLSearchParams({
      province_code: provinceCode,
      amphur_code: amphurCode,
      hospital_level: normalizedLevel,
    });
    const response = await fetch(`${MOCK_API_BASE.replace(/\/mock$/, '/baseline')}/district-profile?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load district baseline for ${provinceCode}/${amphurCode}/${normalizedLevel}`);
    }
    const data = await response.json();
    districtBaselineProfileCache[cacheKey] = data.profile || null;
    return districtBaselineProfileCache[cacheKey];
  } catch (error) {
    console.warn('Unable to load district baseline profile', provinceCode, amphurCode, normalizedLevel, error);
    districtBaselineProfileCache[cacheKey] = null;
    return null;
  }
}

async function fetchPpIndicatorWorkforceMap(force = false) {
  if (ppIndicatorWorkforceMapCache && !force) return ppIndicatorWorkforceMapCache;
  try {
    const response = await fetch(`${getPpApiBase()}/indicator-workforce-map`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, 'Unable to load PP indicator workforce map');
    }
    const data = await response.json();
    ppIndicatorWorkforceMapCache = Array.isArray(data.mappings) ? data.mappings : [];
    return ppIndicatorWorkforceMapCache;
  } catch (error) {
    console.warn('Unable to load PP indicator workforce map', error);
    ppIndicatorWorkforceMapCache = [];
    return [];
  }
}

async function fetchHrUnitWorkforceSummary(provinceCode, unitName) {
  if (!provinceCode || !unitName) return null;
  const cacheKey = `${provinceCode}::${unitName}`;
  if (hrUnitWorkforceCache[cacheKey]) return hrUnitWorkforceCache[cacheKey];
  try {
    const params = new URLSearchParams({ province_code: provinceCode, unit_name: unitName });
    const response = await fetch(`${MOCK_API_BASE.replace(/\/mock$/, '/hr')}/unit-workforce-summary?${params.toString()}`, { method:'GET' });
    if (!response.ok) {
      await createApiError(response, `Unable to load HR workforce summary for ${unitName}`);
    }
    const data = await response.json();
    cacheDictionary('hr', data.summary?.dictionary);
    hrUnitWorkforceCache[cacheKey] = data.summary || null;
    return hrUnitWorkforceCache[cacheKey];
  } catch (error) {
    console.warn('Unable to load HR unit workforce summary', provinceCode, unitName, error);
    hrUnitWorkforceCache[cacheKey] = null;
    return null;
  }
}

async function ensureHrUnitWorkforceSummary(name = selectedHospital) {
  if (!name || isMockHospital(name)) return null;
  const provinceCode = getSelectedProvinceCode(name);
  if (!provinceCode) return null;
  return fetchHrUnitWorkforceSummary(provinceCode, name);
}

async function loadMockCatalog() {
  try {
    const data = await apiRequest('/catalog');
    mockCatalog = data.catalog || [];
  } catch (error) {
    console.warn('Unable to load mock catalog', error);
  }
}

function setMockInputLocal(payload) {
  const key = getMockInputKey(payload.indicator_code, payload.scope || 'global');
  mockSession.inputs[key] = {
    indicator_code: payload.indicator_code,
    scope: payload.scope || 'global',
    value_num: payload.value_num ?? null,
    value_text: payload.value_text ?? null,
    value_json: payload.value_json ?? null,
  };
  applyMockInputToHospital(mockSession.inputs[key]);
}

function getMockEntry(code, scope = 'global') {
  return mockSession.inputs[getMockInputKey(code, scope)] || null;
}

function getMockNumericValue(code, fallback = 0, scope = 'global') {
  const entry = getMockEntry(code, scope);
  if (!entry) return fallback;
  const value = parseFloat(entry.value_num);
  return Number.isNaN(value) ? fallback : value;
}

function setIndicatorNumeric(hospitalName, code, value) {
  if (!HOSPITALS[hospitalName].indicators[code]) HOSPITALS[hospitalName].indicators[code] = {};
  HOSPITALS[hospitalName].indicators[code].manual = value;
}

function applyMockInputToHospital(item) {
  const hospital = ensureHospitalData(MOCK_HOSPITAL_NAME);
  if (item.scope === 'pp_profile' || item.scope === 'pp_capacity' || item.scope === 'pp_outcome') {
    return;
  }
  const numericValue = item.value_num === null || item.value_num === undefined ? null : parseFloat(item.value_num);
  const specialtyMatch = item.indicator_code.match(/^(.*)_(doc_headcount|nurse_headcount|fte_factor|coverage_pct)$/);
  const supportField = PROFESSION_SPECIALTY_SUPPORT_FIELDS.find((field) => field.code === item.indicator_code);

  if (specialtyMatch && SPECIALTY_MAP[specialtyMatch[1]]) {
    const [, serviceCode, fieldType] = specialtyMatch;
    if (!hospital.specialtyCapacity[serviceCode]) {
      hospital.specialtyCapacity[serviceCode] = {
        docHeadcount: 0,
        nurseHeadcount: 0,
        fteFactor: 1,
        coveragePct: 0,
      };
    }
    if (fieldType === 'doc_headcount') hospital.specialtyCapacity[serviceCode].docHeadcount = numericValue || 0;
    if (fieldType === 'nurse_headcount') hospital.specialtyCapacity[serviceCode].nurseHeadcount = numericValue || 0;
    if (fieldType === 'fte_factor') hospital.specialtyCapacity[serviceCode].fteFactor = numericValue ?? 1;
    if (fieldType === 'coverage_pct') hospital.specialtyCapacity[serviceCode].coveragePct = numericValue || 0;
    return;
  }

  if (supportField) {
    if (!hospital.professionSpecialtyCapacity[supportField.serviceCode]) {
      hospital.professionSpecialtyCapacity[supportField.serviceCode] = {};
    }
    if (!hospital.professionSpecialtyCapacity[supportField.serviceCode][supportField.roleCode]) {
      hospital.professionSpecialtyCapacity[supportField.serviceCode][supportField.roleCode] = {
        headcount: 0,
        fteFactor: 1,
      };
    }
    if (supportField.fieldType === 'support_headcount') {
      hospital.professionSpecialtyCapacity[supportField.serviceCode][supportField.roleCode].headcount = numericValue || 0;
    }
    if (supportField.fieldType === 'support_fte') {
      hospital.professionSpecialtyCapacity[supportField.serviceCode][supportField.roleCode].fteFactor = numericValue ?? 1;
    }
    return;
  }

  switch (item.indicator_code) {
    case 'population_total':
      hospital.population['ประชากรรวม'] = numericValue || 0;
      return;
    case 'population_male':
      hospital.population['ประชากรชาย'] = numericValue || 0;
      return;
    case 'population_female':
      hospital.population['ประชากรหญิง'] = numericValue || 0;
      return;
    case 'elderly_pct':
      hospital.hni['Elderly_Rate_%'] = numericValue || 0;
      return;
    case 'prevalence_cvd':
    case 'prevalence_cancer':
    case 'prevalence_dm':
    case 'prevalence_ckd':
      hospital.hni[item.indicator_code] = numericValue || 0;
      return;
    case 'mental_risk_rate':
      hospital.hni['Mental_Risk_Rate_%'] = numericValue || 0;
      return;
    case 'weight_elderly':
    case 'weight_chronic':
    case 'weight_mental':
      hospital.hni[item.indicator_code] = numericValue || 0;
      return;
    case 'doctor_total':
      hospital.workforce.doctors['นายแพทย์'] = numericValue || 0;
      return;
    case 'nurse_total':
      hospital.workforce.nurses['พยาบาลวิชาชีพ'] = numericValue || 0;
      return;
    case 'pharmacist_total':
      hospital.workforce.pharma['เภสัชกร'] = numericValue || 0;
      return;
    case 'physical_therapist_total':
      hospital.professionCapacity.physical_therapist_total = numericValue || 0;
      return;
    case 'psychologist_total':
      hospital.professionCapacity.psychologist_total = numericValue || 0;
      return;
    case 'clinical_psychologist_total':
      hospital.professionCapacity.clinical_psychologist_total = numericValue || 0;
      return;
    default:
      setIndicatorNumeric(MOCK_HOSPITAL_NAME, item.indicator_code, numericValue);
  }
}

function applyMockScenarioToHospital(scenario) {
  HOSPITALS[MOCK_HOSPITAL_NAME] = createEmptyHospitalProfile();
  mockSession.inputs = {};

  (scenario.inputs || []).forEach((item) => {
    const payload = {
      indicator_code: item.indicator_code,
      scope: item.scope || 'global',
      value_num: item.value_num,
      value_text: item.value_text,
      value_json: item.value_json,
    };
    mockSession.inputs[getMockInputKey(payload.indicator_code, payload.scope)] = payload;
    applyMockInputToHospital(payload);
  });
}

async function loadMockScenario(scenarioId) {
  const data = await apiRequest(`/scenarios/${scenarioId}`);
  const scenario = data.scenario;
  mockSession.scenarioId = scenario.scenario_id;
  mockSession.hospitalId = scenario.mock_hospital_id;
  mockSession.loaded = true;
  applyMockScenarioToHospital(scenario);
  persistMockSessionState();
  updateMockStatus('ready', `Mock draft ready • ${scenario.scenario_name}`);
  return scenario;
}

async function ensureMockScenario() {
  try {
    updateMockStatus('loading', 'Preparing mock draft...');
    if (mockSession.scenarioId) {
      return await loadMockScenario(mockSession.scenarioId);
    }

    let hospital = null;
    const hospitalList = await apiRequest('/hospitals');
    hospital = (hospitalList.hospitals || []).find((item) => item.hospital_name === MOCK_HOSPITAL_NAME) || null;

    if (!hospital) {
      const created = await apiRequest('/hospitals', {
        method:'POST',
        body: JSON.stringify({
          hospital_name: MOCK_HOSPITAL_NAME,
          province_ref: 'Sandbox',
          hospital_level: MOCK_DEFAULT_HOSPITAL_LEVEL,
          note: 'Manual scenario for what-if planning',
        }),
      });
      hospital = created.hospital;
    }

    mockSession.hospitalId = hospital.mock_hospital_id;
    const scenarioResp = await apiRequest(`/hospitals/${hospital.mock_hospital_id}/scenarios`, {
      method:'POST',
      body: JSON.stringify({
        scenario_name: 'Draft 1',
        status: 'draft',
      }),
    });
    return await loadMockScenario(scenarioResp.scenario.scenario_id);
  } catch (error) {
    console.error(error);
    updateMockStatus('error', 'Mock save unavailable');
    throw error;
  }
}

function buildMockField(field, valueOverride = null) {
  const isWholeNumber = field.unit === 'คน';
  const isPercent = field.unit === '%';
  const rawValue = valueOverride ?? getMockNumericValue(field.code, '');
  const scope = field.scope || 'global';
  const baselineState = getMockFieldBaselineState(field.code, scope, field.baselineScope || null);
  let value = rawValue;
  if (rawValue !== '') {
    const numericValue = parseFloat(rawValue);
    if (!Number.isNaN(numericValue)) {
      if (isWholeNumber) value = Math.max(0, Math.round(numericValue));
      else if (isPercent) value = Math.min(100, Math.max(0, numericValue));
    }
  }
  let fieldHint = '';
  if (field.serviceCode && (field.fieldType === 'doc' || field.fieldType === 'nurse')) {
    const spec = SPECIALTY_MAP[field.serviceCode];
    if (spec) {
      fieldHint = field.fieldType === 'doc' ? spec.doc : spec.nurse;
    }
  } else if (field.supportHint && field.fieldType === 'support_headcount') {
    fieldHint = field.supportHint;
  }
  return `
    <div class="mock-form-field">
      <label for="mock_${field.code}">
        ${field.label}
        ${baselineState ? `<span class="mock-input-badge ${baselineState === 'edited' ? 'edited' : 'preloaded'}">${baselineState === 'edited' ? 'edited' : 'preloaded'}</span>` : ''}
      </label>
      ${fieldHint ? `<div class="mock-field-hint">${fieldHint}</div>` : ''}
      <input
        id="mock_${field.code}"
        class="mock-input"
        type="number"
        inputmode="${isWholeNumber ? 'numeric' : 'decimal'}"
        step="${isWholeNumber ? '1' : (field.step || '0.01')}"
        ${(isWholeNumber || isPercent) ? 'min="0"' : ''}
        ${isPercent ? 'max="100"' : ''}
        data-code="${field.code}"
        data-scope="${scope}"
        value="${value}"
      >
      <span class="mock-field-unit">${field.unit || ''}</span>
    </div>
  `;
}

function buildMockSourceBadgeHtml(source, label = '') {
  const safeSource = String(source || '').trim().toLowerCase();
  if (!safeSource) return '';
  const text = label || (safeSource === 'template_override'
    ? 'template override'
    : safeSource === 'template_fallback'
      ? 'template fallback'
      : 'district baseline');
  return `<span class="mock-source-badge ${safeSource === 'template_override' || safeSource === 'template_fallback' ? 'template' : 'district'}">${text}</span>`;
}

function buildMockSourceBadgeRow(sourceItems = []) {
  const items = (sourceItems || [])
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return buildMockSourceBadgeHtml(item);
      return buildMockSourceBadgeHtml(item.source, item.label || '');
    })
    .filter(Boolean);
  if (!items.length) return '';
  return `<div class="mock-source-badge-row">${items.join('')}</div>`;
}

function buildMockPanel(title, note, fields, actionsHtml = '', sourceItems = []) {
  return `
    <div class="mock-panel">
      <div class="mock-panel-title">
        <h4>${title}</h4>
      </div>
      ${note ? `<div class="mock-panel-note">${note}</div>` : ''}
      ${buildMockSourceBadgeRow(sourceItems)}
      <div class="mock-form-grid" style="margin-top:12px">
        ${fields.map((field) => buildMockField(field)).join('')}
      </div>
      <div class="mock-form-actions">
        ${actionsHtml || '<span></span>'}
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : 'Ready'}</span>
      </div>
    </div>
  `;
}

function buildResetBaselineButtonHtml(targetScope, baselineScope, label = 'reset baseline') {
  if (!hasBaselineScopeValues(baselineScope)) return '';
  return `<button type="button" class="run-history-action-button secondary" data-mock-action="reset-baseline" data-target-scope="${targetScope}" data-baseline-scope="${baselineScope}">${label}</button>`;
}

function sanitizeMockFieldCodePart(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildPpCapacityFieldCode(ppFunctionCode, professionCode) {
  return `pp_capacity__${sanitizeMockFieldCodePart(ppFunctionCode)}__${sanitizeMockFieldCodePart(professionCode)}`;
}

function getPpCapacityFieldDefinitions(summary = null) {
  const sourceRows = Array.isArray(summary?.capacity) && summary.capacity.length
    ? summary.capacity
    : PP_CAPACITY_FIELD_FALLBACK;
  const seen = new Set();
  return sourceRows
    .map((item) => ({
      ppFunctionCode: item.pp_function_code || item.ppFunctionCode,
      functionNameTh: item.function_name_th || item.functionNameTh || item.pp_function_code || item.ppFunctionCode,
      professionCode: item.profession_code || item.professionCode,
      professionNameTh: item.profession_name_th || item.professionNameTh || getProfessionLabel(item.profession_code || item.professionCode),
    }))
    .filter((item) => item.ppFunctionCode && item.professionCode)
    .filter((item) => {
      const key = `${item.ppFunctionCode}::${item.professionCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.professionCode === b.professionCode) return a.functionNameTh.localeCompare(b.functionNameTh);
      return a.professionCode.localeCompare(b.professionCode);
    })
    .map((item) => ({
      code: buildPpCapacityFieldCode(item.ppFunctionCode, item.professionCode),
      scope: 'pp_capacity',
      label: item.professionNameTh,
      unit: 'คน',
      step: '1',
      ppFunctionCode: item.ppFunctionCode,
      functionNameTh: item.functionNameTh,
      professionCode: item.professionCode,
      professionNameTh: item.professionNameTh,
    }));
}

function buildMockProfilePanel(amphurRows = []) {
  const profile = getMockProfileConfig();
  const clinicalBaseline = getMockClinicalBaselineSummary(profile);
  const needBaselineLabel = getMockProfileText('need_baseline_label', '');
  const dqBaselineLabel = getMockProfileText('dq_baseline_label', '');
  const templateOptions = getMockTemplateHospitalOptions(profile);
  const selectedTemplateHospital = getSelectedTemplateHospital(profile);
  const provinceOptions = Object.entries(PROVINCE_CODE_MAP)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([provinceName, provinceCode]) => `
      <option value="${provinceCode}" ${profile.provinceCode === provinceCode ? 'selected' : ''}>${provinceName}</option>
    `)
    .join('');
  const amphurOptions = (amphurRows || [])
    .map((row) => `
      <option value="${row.amphur_code}" ${profile.amphurCode === String(row.amphur_code || '') ? 'selected' : ''}>
        ${row.amphur_name_th || row.amphur_name || row.amphur_code}
      </option>
    `)
    .join('');
  const scopeLabel = profile.loaded && profile.amphurName
    ? `โปรไฟล์พร้อมใช้: อำเภอ${profile.amphurName} จ.${profile.provinceName}`
    : 'ยังไม่ได้ preload โปรไฟล์อำเภอ';
  const populationLine = profile.loaded && profile.populationTotal > 0
    ? `ประชากร ${profile.populationTotal.toLocaleString()} คน | source ${profile.populationSource || '-'} ${profile.populationReferenceYear || ''}`.trim()
    : 'เมื่อกดโหลด ระบบจะ prefill DQ + Need + PP/clinical baseline จาก district profile ก่อนให้แก้ไขต่อ';
  const needLine = profile.loaded
    ? (needBaselineLabel || 'Need baseline: HDC population/elderly + district burden/workload proxy')
    : 'Need baseline จะตั้งต้นจาก HDC population + district burden/workload proxy';
  const dqLine = profile.loaded
    ? (dqBaselineLabel || `DQ baseline: peer hospital median ตามระดับ ${profile.hospitalLevel}`)
    : 'DQ baseline จะตั้งต้นจาก peer hospital median ตามระดับโรงพยาบาล';
  const clinicalLine = profile.loaded
    ? clinicalBaseline.label
    : 'Clinical baseline จะตั้งต้นจาก district profile ตามอำเภอ + ระดับโรงพยาบาล';
  const templateLine = selectedTemplateHospital
    ? `Template hospital optional override: ${selectedTemplateHospital} | ${HOSP_CONFIG[selectedTemplateHospital]?.province || '-'} | ${HOSP_CONFIG[selectedTemplateHospital]?.level || '-'}`
    : 'Template hospital เป็น optional override เท่านั้น';
  return `
    <div class="mock-panel mock-profile-panel">
      <div class="mock-panel-title">
        <h4>Mock Profile Loader</h4>
      </div>
      <div class="mock-panel-note">เลือกจังหวัด อำเภอ และระดับโรงพยาบาลเพื่อ preload district baseline ก่อนแก้ไขเองใน Step 1, 2, 3, 5, 6 และ 7</div>
      <div class="mock-form-grid mock-profile-grid" style="margin-top:12px">
        <div class="mock-form-field">
          <label for="mock_hospital_level">ระดับโรงพยาบาล</label>
          <select id="mock_hospital_level" class="mock-select mock-profile-select" data-code="hospital_level" data-scope="pp_profile">
            ${MOCK_HOSPITAL_LEVEL_OPTIONS.map((level) => `<option value="${level}" ${profile.hospitalLevel === level ? 'selected' : ''}>${level}</option>`).join('')}
          </select>
        </div>
        <div class="mock-form-field">
          <label for="mock_province_code">จังหวัดอ้างอิง</label>
          <select id="mock_province_code" class="mock-select mock-profile-select" data-code="province_code" data-scope="pp_profile">
            <option value="">เลือกจังหวัด</option>
            ${provinceOptions}
          </select>
        </div>
        <div class="mock-form-field">
          <label for="mock_amphur_code">โปรไฟล์อำเภอ</label>
          <select id="mock_amphur_code" class="mock-select mock-profile-select" data-code="amphur_code" data-scope="pp_profile" ${profile.provinceCode ? '' : 'disabled'}>
            <option value="">เลือกอำเภอ</option>
            ${amphurOptions}
          </select>
        </div>
        <div class="mock-form-field">
          <label for="mock_template_hospital">Template Hospital (Optional)</label>
          <select id="mock_template_hospital" class="mock-select mock-profile-select" data-code="template_hospital" data-scope="pp_profile">
            <option value="">เลือก template hospital</option>
            ${templateOptions.map((name) => `<option value="${name}" ${selectedTemplateHospital === name ? 'selected' : ''}>${name} | ${HOSP_CONFIG[name]?.province || '-'} | ${HOSP_CONFIG[name]?.level || '-'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mock-profile-status">
        <strong>${scopeLabel}</strong>
        <span>${populationLine}</span>
        <span>${needLine}</span>
        <span>${dqLine}</span>
        <span>${clinicalLine}</span>
        <span>${templateLine}</span>
        ${profile.loaded ? buildMockSourceBadgeRow([
          { source: 'district_baseline', label:'Need baseline' },
          { source: 'district_baseline', label:'DQ baseline' },
          { source: clinicalBaseline.ppSource || 'district_baseline', label:'PP baseline' },
          { source: clinicalBaseline.capacitySource || 'district_baseline', label:'Clinical capacity' },
          { source: clinicalBaseline.outcomeSource || 'district_baseline', label:'Clinical outcome' },
          { source: clinicalBaseline.servicePlanSource || 'district_baseline', label:'Service plan' },
        ]) : ''}
      </div>
      <div class="mock-form-actions">
        <button type="button" class="run-history-action-button" data-mock-action="load-pp-profile" ${profile.provinceCode && profile.amphurCode ? '' : 'disabled'}>โหลดโปรไฟล์อำเภอ</button>
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : (profile.loaded ? 'Profile loaded' : 'Ready')}</span>
      </div>
    </div>
  `;
}

function renderMockGuide(stepNumber) {
  const slot = document.getElementById(`mockGuide${stepNumber}`);
  if (!slot) return;
  if (!isMockHospital()) {
    slot.innerHTML = '';
    return;
  }

  const guide = MOCK_STEP_GUIDES[stepNumber];
  if (!guide) {
    slot.innerHTML = '';
    return;
  }

  slot.innerHTML = `
    <div class="mock-guide">
      <h3>${guide.title}</h3>
      <p>${guide.intro}</p>
      <ul class="mock-guide-list">
        ${guide.bullets.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <div class="mock-guide-tip">${guide.tip}</div>
    </div>
  `;
}

function getSpecialtyCapacitySnapshot(serviceCode) {
  const capacity = HOSPITALS[selectedHospital]?.specialtyCapacity?.[serviceCode] || {};
  return {
    docHeadcount: parseFloat(capacity.docHeadcount) || 0,
    nurseHeadcount: parseFloat(capacity.nurseHeadcount) || 0,
    fteFactor: capacity.fteFactor === undefined ? 1 : (parseFloat(capacity.fteFactor) || 0),
    coveragePct: parseFloat(capacity.coveragePct) || 0,
  };
}

function getMockFieldByCode(code, scope = 'global') {
  if (scope === 'pp_capacity') {
    return { code, scope, unit:'คน' };
  }
  if (scope === 'pp_outcome') {
    const profile = getMockProfileConfig();
    const cacheKey = `${profile.provinceCode || ''}::${profile.amphurCode || ''}`;
    const outcomeField = (ppAmphurOutcomeCache[cacheKey] || []).find((item) => item.indicator_code === code);
    return outcomeField ? { code, scope, unit: outcomeField.unit || '' } : { code, scope, unit:'' };
  }
  return [
    ...DQ_FIELDS,
    ...NEED_INPUT_FIELDS,
    ...CAPACITY_FIELDS,
    ...OUTCOME_FIELDS,
    ...SERVICE_PLAN_FIELDS,
    ...SPECIALTY_CAPACITY_FIELDS,
    ...PROFESSION_SPECIALTY_SUPPORT_FIELDS,
  ].find((field) => field.code === code) || null;
}

function getProfessionCount(code, hospitalName = selectedHospital) {
  const provinceCode = getSelectedProvinceCode(hospitalName);
  const cacheKey = provinceCode && hospitalName ? `${provinceCode}::${hospitalName}` : null;
  const hrSummary = cacheKey ? hrUnitWorkforceCache[cacheKey] : null;
  if (hrSummary?.counts && !isMockHospital(hospitalName) && Object.prototype.hasOwnProperty.call(hrSummary.counts, code)) {
    return parseFloat(hrSummary.counts[code]) || 0;
  }
  const hospital = HOSPITALS[hospitalName] || {};
  if (code === 'doctor_total') return sumObj(hospital.workforce?.doctors);
  if (code === 'nurse_total') return (parseFloat(hospital.workforce?.nurses?.['พยาบาลวิชาชีพ']) || 0) + (parseFloat(hospital.workforce?.nurses?.['พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข']) || 0);
  if (code === 'pharmacist_total') return sumObj(hospital.workforce?.pharma);
  return parseFloat(hospital.professionCapacity?.[code]) || 0;
}

function getProfessionLabel(code) {
  return ({
    doctor_total: 'แพทย์',
    nurse_total: 'พยาบาลวิชาชีพ',
    pharmacist_total: 'เภสัชกร',
    physical_therapist_total: 'นักกายภาพบำบัด',
    psychologist_total: 'นักจิตวิทยา',
    clinical_psychologist_total: 'นักจิตวิทยาคลินิก',
    FAM_MD: 'แพทย์เวชศาสตร์ครอบครัว',
    RN: 'พยาบาลวิชาชีพ',
    PH_ACAD: 'นักวิชาการสาธารณสุข',
    PH_OFFICER: 'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข',
    PSY: 'นักจิตวิทยา',
    CPSY: 'นักจิตวิทยาคลินิก',
    PT: 'นักกายภาพบำบัด',
  }[code] || code);
}

function getProfessionBenchmark(code, domain = 'clinical_profession') {
  const lookup = getBenchmarkLookup(domain);
  return lookup?.[code] || null;
}

function getProfessionRateUnit(ratePer) {
  if (Number(ratePer) === 10000) return 'คน/หมื่นปชก.';
  if (Number(ratePer) === 100000) return 'คน/แสนปชก.';
  return 'คน/ประชากร';
}

function getNeedBurdenMultiplier(hniScore) {
  const safeHni = Number.isFinite(hniScore) ? hniScore : 50;
  return Math.max(0.75, Math.min(1.6, 0.75 + (safeHni / 100)));
}

function getClinicalPopulationBase(name = selectedHospital) {
  const hospital = HOSPITALS[name] || {};
  return Math.max(1, parseFloat(hospital.population?.['ประชากรรวม']) || 1);
}

function getProfessionSupportRecommendations(serviceCode, gapLevel) {
  const configs = PROFESSION_SUPPORT_MAP[serviceCode] || [];
  return configs.map((profession) => {
    const specialized = getProfessionSpecialtySupportSnapshot(serviceCode, profession.roleCode);
    const current = specialized.headcount > 0 ? specialized.headcount : getProfessionCount(profession.totalCode || profession.code);
    const desired = profession.minRequired?.[gapLevel] ?? profession.minRequired?.yellow ?? 1;
    return {
      ...profession,
      current,
      add: Math.max(0, desired - current),
      specializedFte: specialized.fteFactor,
    };
  });
}

function getProfessionSpecialtySupportSnapshot(serviceCode, roleCode) {
  const role = HOSPITALS[selectedHospital]?.professionSpecialtyCapacity?.[serviceCode]?.[roleCode] || {};
  return {
    headcount: parseFloat(role.headcount) || 0,
    fteFactor: role.fteFactor === undefined ? 1 : (parseFloat(role.fteFactor) || 0),
  };
}

function getProfessionNeedMix(name = selectedHospital) {
  const hospital = HOSPITALS[name] || {};
  const hasExtendedData = isMockHospital(name) || Object.values(hospital.professionCapacity || {}).some((value) => (parseFloat(value) || 0) > 0);
  const elderly = parseFloat(hospital.hni?.['Elderly_Rate_%']) || 0;
  const chronic = getChronicPrevalence(name);
  const mental = parseFloat(hospital.hni?.['Mental_Risk_Rate_%']) || 0;
  const hniBenchmarks = getBenchmarkLookup('hni_component');
  const refE = parseFloat(hniBenchmarks?.elderly_rate_pct?.reference_value || hniBenchmarks?.elderly_rate_pct?.target_value || 30) || 30;
  const refC = parseFloat(hniBenchmarks?.chronic_rate_pct?.reference_value || hniBenchmarks?.chronic_rate_pct?.target_value || 25) || 25;
  const refM = parseFloat(hniBenchmarks?.mental_risk_rate_per100k?.reference_value || hniBenchmarks?.mental_risk_rate_per100k?.target_value || 5000) || 5000;
  const normE = Math.min(1.5, elderly / Math.max(refE, 1));
  const normC = Math.min(1.5, chronic / Math.max(refC, 1));
  const normM = Math.min(1.5, mental / Math.max(refM, 1));
  const rehabVal = parseFloat(getIndicatorValue(name, 'RH0101'));
  const rehabPressure = Number.isNaN(rehabVal) ? (0.45 * normE) + (0.2 * normC) : Math.max(0, (50 - rehabVal) / 50);
  const suicideVal = parseFloat(getIndicatorValue(name, 'PS0001'));
  const suicidePressure = Number.isNaN(suicideVal) ? normM : Math.max(0, (suicideVal - 5) / 5);

  const rawWeights = {
    doctor_total: 28 + (18 * normC) + (8 * normE),
    nurse_total: 28 + (12 * normC) + (10 * normE) + (6 * normM),
    pharmacist_total: 10 + (8 * normC),
    physical_therapist_total: hasExtendedData ? (8 + (10 * rehabPressure) + (6 * normE)) : 0,
    psychologist_total: hasExtendedData ? (8 + (10 * normM) + (4 * suicidePressure)) : 0,
    clinical_psychologist_total: hasExtendedData ? (6 + (10 * normM) + (6 * suicidePressure)) : 0,
  };
  const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(
    Object.entries(rawWeights).map(([code, value]) => [code, (value / totalWeight) * 100]),
  );
}

function computeMultiProfessionWCI(name = selectedHospital, denominatorPreview = null) {
  const effectivePopulation = Number(
    denominatorPreview?.denominator?.denominatorPopulationTotal
    ?? denominatorPreview?.denominator?.denominator_population_total
    ?? denominatorPreview?.populationTotal
    ?? denominatorPreview?.population_total
    ?? getClinicalPopulationBase(name)
  ) || getClinicalPopulationBase(name);
  const pop = Math.max(1, effectivePopulation);
  const previewMix = denominatorPreview?.profession_mix || denominatorPreview?.professionMix || null;
  const mix = previewMix && Object.keys(previewMix).length ? previewMix : getProfessionNeedMix(name);
  const benchmarkLookup = getBenchmarkLookup('clinical_profession');
  const benchmarks = Object.entries(benchmarkLookup || {}).reduce((acc, [code, benchmark]) => {
    const target = parseFloat(benchmark.target_value);
    const per = parseFloat(benchmark.rate_per);
    if (!Number.isFinite(target) || !Number.isFinite(per) || target <= 0 || per <= 0) return acc;
    const headcount = getProfessionCount(code, name);
    if (headcount <= 0 && !isMockHospital(name) && !Object.prototype.hasOwnProperty.call(mix, code)) return acc;
    acc[code] = {
      per,
      target,
      defaultWeightPct: parseFloat(benchmark.default_weight_pct || 0) || 0,
      ftePerHeadcount: parseFloat(benchmark.fte_per_headcount || 1) || 1,
      benchmark,
    };
    return acc;
  }, {});
  const detail = Object.entries(benchmarks).reduce((acc, [code, benchmark]) => {
    const headcount = getProfessionCount(code, name);
    const ratio = (headcount / pop) * benchmark.per;
    const normalized = Math.min(140, (ratio / benchmark.target) * 100);
    acc[code] = {
      headcount,
      ratio,
      weight: mix[code] || 0,
      score: normalized,
      benchmark: {
        ...benchmark.benchmark,
        per: benchmark.per,
        target: benchmark.target,
      },
    };
    return acc;
  }, {});
  const wci = Object.values(detail).reduce((sum, item) => sum + ((item.score * item.weight) / 100), 0);
  return { wci, detail, mix, populationTotal: pop };
}

function computeClinicalNeedFtePreview(name = selectedHospital, hniScore = window._hni) {
  const pop = getClinicalPopulationBase(name);
  const mix = getProfessionNeedMix(name);
  const burdenMultiplier = getNeedBurdenMultiplier(hniScore);
  const benchmarkLookup = getBenchmarkLookup('clinical_profession');
  const rows = Object.entries(benchmarkLookup || {}).map(([code, benchmark]) => {
    const ratePer = parseFloat(benchmark.rate_per || 0);
    const targetValue = parseFloat(benchmark.target_value || 0);
    if (!ratePer || !targetValue) return null;
    const baselineNeed = (targetValue * pop) / ratePer;
    const defaultWeight = parseFloat(benchmark.default_weight_pct || 0) || 0;
    const actualWeight = parseFloat(mix?.[code] || 0) || 0;
    const mixAdjustment = defaultWeight > 0 ? Math.max(0.65, actualWeight / defaultWeight) : 1;
    const pressureFactor = parseFloat(benchmark.pressure_fte_factor || 1) || 1;
    const needFte = baselineNeed * burdenMultiplier * mixAdjustment * pressureFactor;
    const headcount = getProfessionCount(code, name);
    const ftePerHeadcount = parseFloat(benchmark.fte_per_headcount || 1) || 1;
    const availableFte = headcount * ftePerHeadcount;
    const gapFte = Math.max(0, needFte - availableFte);
    return {
      code,
      label: getProfessionLabel(code),
      baselineNeed,
      needFte,
      availableFte,
      gapFte,
      suggestedAdd: Math.ceil(gapFte),
      ratePer,
      targetValue,
      defaultWeight,
      actualWeight,
      mixAdjustment,
      burdenMultiplier,
    };
  }).filter(Boolean).sort((a, b) => b.gapFte - a.gapFte);

  return {
    population: pop,
    population_total: pop,
    burdenMultiplier,
    denominator: {
      scope_type: hospitalScopeCache[name]?.clinical_scope_type || HOSP_CONFIG[name]?.level || 'amphur',
      scope_name: hospitalScopeCache[name]?.clinical_scope_name || HOSP_CONFIG[name]?.province || name,
      denominator_method: 'frontend_population_fallback',
      denominator_population_total: pop,
      workload_share: null,
    },
    rows,
  };
}

function buildSpecialtyCapacityPanel() {
  const groups = Object.entries(SPECIALTY_MAP).map(([code, spec]) => {
    const fields = SPECIALTY_CAPACITY_FIELDS.filter((field) => field.serviceCode === code);
    const snapshot = getSpecialtyCapacitySnapshot(code);
    return `
      <div class="mock-panel">
        <div class="mock-panel-title">
          <h4>${code}: ${spec.name}</h4>
        </div>
        <div class="mock-form-grid" style="margin-top:12px">
          ${fields.map((field) => {
            let value = '';
            if (field.fieldType === 'doc') value = snapshot.docHeadcount || '';
            if (field.fieldType === 'nurse') value = snapshot.nurseHeadcount || '';
            if (field.fieldType === 'fte') value = snapshot.fteFactor;
            if (field.fieldType === 'coverage') value = snapshot.coveragePct || '';
            return buildMockField(field, value);
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="mock-panel">
      <div class="mock-panel-title">
        <h4>Specialty Capacity Matrix</h4>
      </div>
      <div class="mock-subgrid">
        ${groups}
      </div>
      <div class="mock-form-actions">
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : 'Ready'}</span>
      </div>
    </div>
  `;
}

function buildProfessionSupportPanel() {
  const groups = Object.entries(PROFESSION_SPECIALTY_SUPPORT_CONFIG).map(([serviceCode, roles]) => {
    const spec = SPECIALTY_MAP[serviceCode];
    return `
      <div class="mock-panel">
        <div class="mock-panel-title">
          <h4>${serviceCode}: ${spec?.name || serviceCode}</h4>
        </div>
        <div class="mock-form-grid" style="margin-top:12px">
          ${roles.map((role) => {
            const headcountField = PROFESSION_SPECIALTY_SUPPORT_FIELDS.find((field) => field.serviceCode === serviceCode && field.roleCode === role.roleCode && field.fieldType === 'support_headcount');
            const fteField = PROFESSION_SPECIALTY_SUPPORT_FIELDS.find((field) => field.serviceCode === serviceCode && field.roleCode === role.roleCode && field.fieldType === 'support_fte');
            const snapshot = getProfessionSpecialtySupportSnapshot(serviceCode, role.roleCode);
            return `
              <div class="mock-support-role-card">
                ${buildMockField(headcountField, snapshot.headcount || '')}
                ${buildMockField(fteField, snapshot.fteFactor)}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="mock-panel">
      <div class="mock-panel-title">
        <h4>Professional Support Matrix</h4>
      </div>
      <div class="mock-subgrid">
        ${groups}
      </div>
      <div class="mock-form-actions">
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : 'Ready'}</span>
      </div>
    </div>
  `;
}

function isPpOutcomeOffTarget(valueNum, goodDirection, targetValue) {
  const observed = Number(valueNum);
  const target = Number(targetValue);
  if (!Number.isFinite(observed)) return false;
  if (goodDirection === 'high') {
    return Number.isFinite(target) ? observed < target : false;
  }
  if (goodDirection === 'low') {
    if (!Number.isFinite(target)) return observed > 0;
    if (target <= 0) return observed > 0;
    return observed > target;
  }
  return false;
}

function allocateRoundedShares(total, items, shareAccessor) {
  if (!Array.isArray(items) || !items.length) return [];
  const safeTotal = Math.max(0, Math.round(total));
  if (safeTotal <= 0) {
    return items.map((item) => ({ item, value:0 }));
  }
  const weighted = items.map((item) => {
    const share = Math.max(0, Number(shareAccessor(item) || 0));
    return {
      item,
      raw: safeTotal * share,
    };
  });
  const shareSum = weighted.reduce((sum, row) => sum + row.raw, 0);
  if (shareSum <= 0) {
    const evenShare = safeTotal / weighted.length;
    return allocateRoundedShares(safeTotal, items, () => (1 / items.length) || evenShare);
  }
  const baseRows = weighted.map((row) => ({
    item: row.item,
    value: Math.floor(row.raw),
    remainder: row.raw - Math.floor(row.raw),
  }));
  let allocated = baseRows.reduce((sum, row) => sum + row.value, 0);
  baseRows
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((row) => {
      if (allocated >= safeTotal) return;
      row.value += 1;
      allocated += 1;
    });
  return baseRows;
}

function buildMockPpCapacitySeedValues(provinceSummary, scopePopulationTotal, provincePopulationTotal) {
  const definitions = getPpCapacityFieldDefinitions(provinceSummary);
  const capacityRows = Array.isArray(provinceSummary?.capacity) ? provinceSummary.capacity : [];
  const benchmarkLookup = provinceSummary?.benchmarks || {};
  const capacityByProfession = {};
  capacityRows.forEach((row) => {
    const professionCode = row.profession_code;
    if (!professionCode) return;
    if (!capacityByProfession[professionCode]) capacityByProfession[professionCode] = [];
    capacityByProfession[professionCode].push(row);
  });
  const payload = [];
  const seenCodes = new Set();
  Object.entries(capacityByProfession).forEach(([professionCode, rows]) => {
    const provinceHeadcount = rows.reduce((sum, row) => sum + (parseFloat(row.headcount_total || 0) || 0), 0);
    const benchmark = benchmarkLookup[professionCode] || null;
    let targetHeadcount = provincePopulationTotal > 0
      ? Math.round((provinceHeadcount * scopePopulationTotal) / provincePopulationTotal)
      : 0;
    if (targetHeadcount <= 0 && benchmark) {
      const ratePer = parseFloat(benchmark.rate_per || 0);
      const targetValue = parseFloat(benchmark.target_value || 0);
      if (ratePer > 0 && targetValue > 0) {
        targetHeadcount = Math.round((scopePopulationTotal * targetValue) / ratePer);
      }
    }
    const allocatedRows = allocateRoundedShares(targetHeadcount, rows, (row) => {
      const rowHeadcount = parseFloat(row.headcount_total || 0) || 0;
      return provinceHeadcount > 0 ? (rowHeadcount / provinceHeadcount) : (1 / Math.max(rows.length, 1));
    });
    allocatedRows.forEach(({ item, value }) => {
      const code = buildPpCapacityFieldCode(item.pp_function_code, item.profession_code);
      seenCodes.add(code);
      payload.push({
        indicator_code: code,
        scope: 'pp_capacity',
        value_num: value,
      });
    });
  });
  definitions.forEach((field) => {
    if (seenCodes.has(field.code)) return;
    payload.push({
      indicator_code: field.code,
      scope: 'pp_capacity',
      value_num: 0,
    });
  });
  return payload;
}

function buildMockPpAuditTrail(capacityRows, dictionary) {
  const totals = {};
  (capacityRows || []).forEach((row) => {
    const professionCode = row.profession_code;
    if (!professionCode) return;
    if (!totals[professionCode]) {
      totals[professionCode] = {
        label: getPpProfessionLabel({ dictionary }, professionCode, row.profession_name_th || professionCode),
        note: getPpProfessionNote({ dictionary }, professionCode),
        count: 0,
      };
    }
    totals[professionCode].count += parseFloat(row.headcount_total || 0) || 0;
  });
  return totals;
}

function mergeMockBaselineValues(primaryValues = [], fallbackValues = [], mode = 'fallback') {
  const merged = new Map();
  const upsert = (entry, allowOverride = true) => {
    const key = `${entry.scope || 'global'}::${entry.indicator_code}`;
    if (!allowOverride && merged.has(key)) return;
    merged.set(key, entry);
  };
  primaryValues.forEach((entry) => upsert(entry, true));
  if (mode === 'override') {
    fallbackValues.forEach((entry) => upsert(entry, true));
    return Array.from(merged.values());
  }
  fallbackValues.forEach((entry) => {
    const key = `${entry.scope || 'global'}::${entry.indicator_code}`;
    const existing = merged.get(key);
    const hasNumericValue = existing && Number.isFinite(Number(existing.value_num));
    const hasTextValue = existing && typeof existing.value_text === 'string' && existing.value_text.trim() !== '';
    if (!existing || (!hasNumericValue && !hasTextValue)) {
      upsert(entry, true);
    }
  });
  return Array.from(merged.values());
}

function buildIndicatorBaselineValuesFromRows(rows = [], baselineScope) {
  const currentValues = [];
  const baselineValues = [];
  (rows || []).forEach((row) => {
    const value = Number(row?.value_num);
    if (!Number.isFinite(value)) return;
    currentValues.push({ indicator_code: row.indicator_code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: row.indicator_code, scope: baselineScope, value_num: value });
  });
  return { currentValues, baselineValues };
}

function buildPeerMedianIndicatorBaselineValues(peerUnits = [], fields = [], baselineScope) {
  const currentValues = [];
  const baselineValues = [];
  fields.forEach((field) => {
    const values = (peerUnits || [])
      .map((unit) => {
        const rawValue = getIndicatorValue(unit?.unit_name, field.code);
        const numericValue = rawValue === null || rawValue === undefined ? null : Number(rawValue);
        return Number.isFinite(numericValue) ? numericValue : null;
      })
      .filter((value) => value !== null);
    const medianValue = computeMedian(values);
    if (!Number.isFinite(medianValue)) return;
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: medianValue });
    baselineValues.push({ indicator_code: field.code, scope: baselineScope, value_num: medianValue });
  });
  return { currentValues, baselineValues };
}

async function buildDistrictClinicalBaselineValues(districtProfile, templateHospital) {
  const currentValues = [];
  const baselineValues = [];
  const sources = {
    capacity: 'district_baseline',
    outcome: 'district_baseline',
    servicePlan: 'district_baseline',
  };
  const workforceCounts = districtProfile?.clinical_workforce?.counts || {};
  PROFESSION_FIELDS.forEach((field) => {
    const value = Number(workforceCounts[field.code] ?? 0) || 0;
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: field.code, scope:'baseline_global_capacity', value_num: value });
  });

  const peerUnits = Array.isArray(districtProfile?.peer_units) ? districtProfile.peer_units : [];
  const outcomeSeed = Array.isArray(districtProfile?.clinical_outcomes) && districtProfile.clinical_outcomes.length
    ? buildIndicatorBaselineValuesFromRows(districtProfile.clinical_outcomes, 'baseline_global_outcome')
    : buildPeerMedianIndicatorBaselineValues(peerUnits, OUTCOME_FIELDS, 'baseline_global_outcome');
  const serviceSeed = Array.isArray(districtProfile?.clinical_service_plan) && districtProfile.clinical_service_plan.length
    ? buildIndicatorBaselineValuesFromRows(districtProfile.clinical_service_plan, 'baseline_global_service_plan')
    : buildPeerMedianIndicatorBaselineValues(peerUnits, SERVICE_PLAN_FIELDS, 'baseline_global_service_plan');
  currentValues.push(...outcomeSeed.currentValues, ...serviceSeed.currentValues);
  baselineValues.push(...outcomeSeed.baselineValues, ...serviceSeed.baselineValues);

  if (templateHospital) {
    const templateBaseline = await buildTemplateHospitalBaselineValues(templateHospital);
    sources.capacity = 'template_override';
    sources.outcome = 'template_override';
    sources.servicePlan = 'template_override';
    return {
      currentValues: mergeMockBaselineValues(currentValues, templateBaseline.currentValues, 'override'),
      baselineValues: mergeMockBaselineValues(baselineValues, templateBaseline.baselineValues, 'override'),
      peerUnits,
      sources,
    };
  }

  return { currentValues, baselineValues, peerUnits, sources };
}

function buildMockNeedBaselineValues(profile, needProfile = null) {
  const currentValues = [];
  const baselineValues = [];
  const needLookup = needProfile || {};
  const valueByCode = {
    population_total: Number(needLookup.population_total ?? profile.populationTotal ?? 0) || 0,
    population_male: Number(needLookup.population_male ?? profile.populationMale ?? 0) || 0,
    population_female: Number(needLookup.population_female ?? profile.populationFemale ?? 0) || 0,
    elderly_pct: Number(needLookup.elderly_pct ?? 0) || 0,
    prevalence_cvd: Number(needLookup.prevalence_cvd ?? 0) || 0,
    prevalence_cancer: Number(needLookup.prevalence_cancer ?? 0) || 0,
    prevalence_dm: Number(needLookup.prevalence_dm ?? 0) || 0,
    prevalence_ckd: Number(needLookup.prevalence_ckd ?? 0) || 0,
    mental_risk_rate: Number(needLookup.mental_risk_rate ?? 0) || 0,
  };
  NEED_INPUT_FIELDS.forEach((field) => {
    const value = valueByCode[field.code] ?? 0;
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: field.code, scope:'baseline_global_need', value_num: value });
  });
  return { currentValues, baselineValues };
}

function buildMockDqBaselineValues(dqRows = []) {
  const currentValues = [];
  const baselineValues = [];
  const dqLookup = Object.fromEntries(
    (Array.isArray(dqRows) ? dqRows : []).map((row) => [row.indicator_code, Number(row.value_num ?? 0) || 0]),
  );
  DQ_FIELDS.forEach((field) => {
    const value = dqLookup[field.code] ?? 0;
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: field.code, scope:'baseline_global_dq', value_num: value });
  });
  return { currentValues, baselineValues };
}

async function buildTemplateHospitalBaselineValues(templateHospital) {
  if (!templateHospital || !HOSP_CONFIG[templateHospital]) {
    return { currentValues: [], baselineValues: [] };
  }
  const templateProvinceCode = PROVINCE_CODE_MAP[HOSP_CONFIG[templateHospital]?.province] || null;
  const hrSummary = templateProvinceCode
    ? await fetchHrUnitWorkforceSummary(templateProvinceCode, templateHospital)
    : null;
  const workforceCounts = {
    doctor_total: hrSummary?.counts?.doctor_total ?? getProfessionCount('doctor_total', templateHospital),
    nurse_total: hrSummary?.counts?.nurse_total ?? getProfessionCount('nurse_total', templateHospital),
    pharmacist_total: hrSummary?.counts?.pharmacist_total ?? getProfessionCount('pharmacist_total', templateHospital),
    physical_therapist_total: hrSummary?.counts?.physical_therapist_total ?? getProfessionCount('physical_therapist_total', templateHospital),
    psychologist_total: hrSummary?.counts?.psychologist_total ?? getProfessionCount('psychologist_total', templateHospital),
    clinical_psychologist_total: hrSummary?.counts?.clinical_psychologist_total ?? getProfessionCount('clinical_psychologist_total', templateHospital),
  };
  const currentValues = [];
  const baselineValues = [];
  Object.entries(workforceCounts).forEach(([code, value]) => {
    currentValues.push({ indicator_code: code, scope:'global', value_num: Number(value || 0) });
    baselineValues.push({ indicator_code: code, scope:'baseline_global_capacity', value_num: Number(value || 0) });
  });
  OUTCOME_FIELDS.forEach((field) => {
    const rawValue = getIndicatorValue(templateHospital, field.code);
    const value = rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: field.code, scope:'baseline_global_outcome', value_num: value });
  });
  SERVICE_PLAN_FIELDS.forEach((field) => {
    const rawValue = getIndicatorValue(templateHospital, field.code);
    const value = rawValue === null || rawValue === undefined || Number.isNaN(Number(rawValue)) ? null : Number(rawValue);
    currentValues.push({ indicator_code: field.code, scope:'global', value_num: value });
    baselineValues.push({ indicator_code: field.code, scope:'baseline_global_service_plan', value_num: value });
  });
  return { currentValues, baselineValues };
}

async function preloadMockPpProfile() {
  if (!isMockHospital() || !mockSession.scenarioId) return;
  const profile = getMockProfileConfig();
  if (!profile.provinceCode || !profile.amphurCode) return;
  const templateHospital = document.getElementById('mock_template_hospital')?.value || getSelectedTemplateHospital(profile);
  updateMockStatus('loading', 'กำลัง preload โปรไฟล์อำเภอ...');
  const [populationRef, provinceSummary, districtProfile] = await Promise.all([
    fetchAmphurPopulationReference(profile.provinceCode),
    fetchPpProvinceSummary(profile.provinceCode),
    fetchDistrictBaselineProfile(profile.provinceCode, profile.amphurCode, profile.hospitalLevel),
  ]);
  const amphurRow = (populationRef.rows || []).find((row) => String(row.amphur_code || '') === String(profile.amphurCode || ''));
  if (!amphurRow || !provinceSummary) {
    updateMockStatus('warn', 'ยังโหลดโปรไฟล์อำเภอไม่ได้');
    return;
  }
  const clinicalBaseline = await buildDistrictClinicalBaselineValues(districtProfile, templateHospital);
  const needBaseline = buildMockNeedBaselineValues(profile, districtProfile?.need_profile || null);
  const dqBaseline = buildMockDqBaselineValues(districtProfile?.dq_profile || []);
  const provincePopulationTotal = (populationRef.rows || []).reduce(
    (sum, row) => sum + (parseFloat(row.total_population || 0) || 0),
    0,
  );
  const populationTotal = Math.max(0, Math.round(parseFloat(amphurRow.total_population || 0) || 0));
  const populationMale = Math.max(0, Math.round(parseFloat(amphurRow.male_total || 0) || 0));
  const populationFemale = Math.max(0, Math.round(parseFloat(amphurRow.female_total || 0) || 0));
  const populationSource = populationRef.source === 'hdc'
    ? 'verified_amphur_population_hdc'
    : 'verified_amphur_population_dopa';
  const ppCapacitySource = districtProfile?.pp_capacity?.capacity?.length
    ? {
        capacity: districtProfile.pp_capacity.capacity,
        scope_population_total: districtProfile.pp_population_total,
      }
    : provinceSummary;
  const ppCapacitySourcePopulation = parseFloat(ppCapacitySource?.scope_population_total || 0) || provincePopulationTotal;
  const ppCapacityBaseline = buildMockPpCapacitySeedValues(ppCapacitySource, populationTotal, ppCapacitySourcePopulation);
  const outcomeRows = Array.isArray(districtProfile?.pp_outcomes) && districtProfile.pp_outcomes.length
    ? districtProfile.pp_outcomes
    : await fetchPpAmphurOutcomeSummary(profile.provinceCode, profile.amphurCode);
  const peerUnitNames = (districtProfile?.peer_units || [])
    .map((item) => item?.unit_name)
    .filter(Boolean)
    .join(', ');
  const clinicalBaselineLabel = districtProfile
    ? `Clinical baseline: district profile ${profile.hospitalLevel} | peer ${districtProfile.peer_unit_count || 0} รพ.${peerUnitNames ? ` | ${peerUnitNames}` : ''}`
    : (templateHospital
      ? `Clinical baseline: template fallback ${templateHospital}`
      : `Clinical baseline: ${profile.hospitalLevel}`);
  const clinicalBaselineNote = districtProfile?.clinical_scope_note || '';
  const needBaselineLabel = districtProfile?.need_profile?.source_note
    ? `Need baseline: ${districtProfile.need_profile.source_note}`
    : 'Need baseline: HDC population/elderly + district burden/workload proxy';
  const dqBaselineLabel = districtProfile
    ? `DQ baseline: peer hospital median ตามระดับ ${profile.hospitalLevel} (${districtProfile.peer_unit_count || 0} แห่ง)`
    : `DQ baseline: peer hospital median ตามระดับ ${profile.hospitalLevel}`;
  const values = [
    { indicator_code:'hospital_level', scope:'pp_profile', value_text: profile.hospitalLevel || MOCK_DEFAULT_HOSPITAL_LEVEL },
    { indicator_code:'province_code', scope:'pp_profile', value_text: profile.provinceCode },
    { indicator_code:'province_name', scope:'pp_profile', value_text: getProvinceNameByCode(profile.provinceCode) || profile.provinceName || '' },
    { indicator_code:'amphur_code', scope:'pp_profile', value_text: String(amphurRow.amphur_code || profile.amphurCode) },
    { indicator_code:'amphur_name', scope:'pp_profile', value_text: amphurRow.amphur_name_th || amphurRow.amphur_name || profile.amphurName || '' },
    { indicator_code:'template_hospital', scope:'pp_profile', value_text: templateHospital || '' },
    { indicator_code:'population_total', scope:'pp_profile', value_num: populationTotal },
    { indicator_code:'population_male', scope:'pp_profile', value_num: populationMale },
    { indicator_code:'population_female', scope:'pp_profile', value_num: populationFemale },
    { indicator_code:'population_reference_year', scope:'pp_profile', value_text: String(amphurRow.reference_year_be || '') },
    { indicator_code:'population_source', scope:'pp_profile', value_text: populationSource },
    { indicator_code:'clinical_baseline_source', scope:'pp_profile', value_text: districtProfile ? 'district_profile' : (templateHospital ? 'template_fallback' : 'district_profile') },
    { indicator_code:'clinical_baseline_label', scope:'pp_profile', value_text: clinicalBaselineLabel },
    { indicator_code:'clinical_baseline_note', scope:'pp_profile', value_text: clinicalBaselineNote },
    { indicator_code:'need_baseline_label', scope:'pp_profile', value_text: needBaselineLabel },
    { indicator_code:'dq_baseline_label', scope:'pp_profile', value_text: dqBaselineLabel },
    { indicator_code:'pp_baseline_source', scope:'pp_profile', value_text: 'district_baseline' },
    { indicator_code:'clinical_capacity_source', scope:'pp_profile', value_text: clinicalBaseline.sources?.capacity || 'district_baseline' },
    { indicator_code:'clinical_outcome_source', scope:'pp_profile', value_text: clinicalBaseline.sources?.outcome || 'district_baseline' },
    { indicator_code:'clinical_service_plan_source', scope:'pp_profile', value_text: clinicalBaseline.sources?.servicePlan || 'district_baseline' },
    { indicator_code:'district_peer_scope', scope:'pp_profile', value_text: districtProfile?.peer_scope || '' },
    { indicator_code:'district_peer_count', scope:'pp_profile', value_num: Number(districtProfile?.peer_unit_count || 0) || 0 },
    { indicator_code:'district_baseline_status', scope:'pp_profile', value_text: districtProfile?.readiness?.status || '' },
    { indicator_code:'district_peer_units', scope:'pp_profile', value_json: districtProfile?.peer_units || [] },
    { indicator_code:'profile_loaded', scope:'pp_profile', value_num: 1 },
    ...needBaseline.currentValues,
    ...needBaseline.baselineValues,
    ...dqBaseline.currentValues,
    ...dqBaseline.baselineValues,
    ...clinicalBaseline.currentValues,
    ...clinicalBaseline.baselineValues,
    ...ppCapacityBaseline,
    ...ppCapacityBaseline.map((entry) => ({
      ...entry,
      scope: 'baseline_pp_capacity',
    })),
    ...(outcomeRows || []).map((row) => ({
      indicator_code: row.indicator_code,
      scope: 'pp_outcome',
      value_num: Number.isFinite(Number(row.value_num)) ? Number(row.value_num) : null,
    })),
    ...(outcomeRows || []).map((row) => ({
      indicator_code: row.indicator_code,
      scope: 'baseline_pp_outcome',
      value_num: Number.isFinite(Number(row.value_num)) ? Number(row.value_num) : null,
    })),
  ];
  queueMockSave(values);
  window._needFtePreview = null;
  if (currentStep === 0) {
    await renderStep0();
  } else {
    const rerenders = {
      1: renderStep1,
      2: renderStep2,
      3: renderStep3,
      5: renderStep5,
      7: renderStep7,
    };
    const rerender = rerenders[currentStep];
    if (rerender) await rerender();
  }
  updateMockStatus('ready', `โหลดโปรไฟล์ ${amphurRow.amphur_name_th || amphurRow.amphur_name || profile.amphurCode} แล้ว`);
}

async function maybeAutoPreloadMockProfile(triggerCode = '') {
  if (!isMockHospital() || !mockSession.scenarioId) return;
  if (!['amphur_code', 'hospital_level', 'template_hospital'].includes(triggerCode)) return;
  const profile = getMockProfileConfig();
  if (!profile.provinceCode || !profile.amphurCode) return;
  await preloadMockPpProfile();
}

async function resetMockScopeFromBaseline(targetScope, baselineScope) {
  if (!isMockHospital() || !mockSession.scenarioId) return;
  const baselineValues = Object.values(mockSession.inputs || {})
    .filter((entry) => entry.scope === baselineScope)
    .map((entry) => ({
      indicator_code: entry.indicator_code,
      scope: targetScope,
      value_num: entry.value_num ?? null,
      value_text: entry.value_text ?? null,
      value_json: entry.value_json ?? null,
    }));
  if (!baselineValues.length) {
    updateMockStatus('warn', 'ยังไม่พบ baseline สำหรับ reset');
    return;
  }
  queueMockSave(baselineValues);
  const rerenders = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    5: renderStep5,
    6: renderStep6,
    7: renderStep7,
  };
  const rerender = rerenders[currentStep];
  if (rerender) await rerender();
  updateMockStatus('ready', 'คืนค่าจาก baseline แล้ว');
}

async function buildMockPpSummary() {
  const profile = getMockProfileConfig();
  if (!profile.loaded || !profile.provinceCode || !profile.amphurCode) return null;
  const [provinceSummary, templateOutcomes, indicatorMap] = await Promise.all([
    fetchPpProvinceSummary(profile.provinceCode),
    fetchPpAmphurOutcomeSummary(profile.provinceCode, profile.amphurCode),
    fetchPpIndicatorWorkforceMap(),
  ]);
  if (!provinceSummary) return null;

  const definitions = getPpCapacityFieldDefinitions(provinceSummary);
  const capacity = definitions.map((field) => {
    const entry = getMockEntry(field.code, 'pp_capacity');
    const headcount = Math.max(0, Math.round(parseFloat(entry?.value_num || 0) || 0));
    return {
      pp_function_code: field.ppFunctionCode,
      function_name_th: field.functionNameTh,
      profession_code: field.professionCode,
      profession_name_th: field.professionNameTh,
      headcount_total: headcount,
      fte_total: headcount,
    };
  }).filter((row) => row.headcount_total > 0);

  const functionCapacity = {};
  capacity.forEach((row) => {
    const key = `${row.pp_function_code}::${row.profession_code}`;
    functionCapacity[key] = (functionCapacity[key] || 0) + (parseFloat(row.fte_total || 0) || 0);
  });

  const outcomes = (templateOutcomes || []).map((row) => {
    const entry = getMockEntry(row.indicator_code, 'pp_outcome');
    const fallbackValue = Number.isFinite(Number(row.value_num)) ? Number(row.value_num) : null;
    const valueNum = entry && entry.value_num !== null && entry.value_num !== undefined
      ? Number(entry.value_num)
      : fallbackValue;
    return {
      ...row,
      value_num: Number.isFinite(valueNum) ? valueNum : null,
      is_off_target: isPpOutcomeOffTarget(valueNum, row.good_direction, row.target_value),
      amphur_name: profile.amphurName || row.amphur_name,
      fact_count: Number.isFinite(valueNum) ? 1 : 0,
    };
  });

  const recommendations = {};
  const mappingsByIndicator = {};
  (indicatorMap || []).forEach((row) => {
    if (!mappingsByIndicator[row.indicator_code]) mappingsByIndicator[row.indicator_code] = [];
    mappingsByIndicator[row.indicator_code].push(row);
  });
  outcomes
    .filter((row) => row.is_off_target)
    .forEach((row) => {
      (mappingsByIndicator[row.indicator_code] || []).forEach((mapping) => {
        const key = `${mapping.pp_function_code}::${mapping.profession_code}`;
        const currentCapacity = functionCapacity[key] || 0;
        const urgencyDelta = (parseFloat(mapping.contribution_weight || 0) || 1) / Math.max(currentCapacity, 0.5);
        if (!recommendations[mapping.profession_code]) {
          recommendations[mapping.profession_code] = {
            profession_code: mapping.profession_code,
            profession_name_th: getPpProfessionLabel(provinceSummary, mapping.profession_code, mapping.profession_code),
            urgency_score: 0,
            linked_indicators: new Set(),
            linked_functions: new Set(),
          };
        }
        recommendations[mapping.profession_code].urgency_score += urgencyDelta;
        recommendations[mapping.profession_code].linked_indicators.add(row.indicator_name_th);
        recommendations[mapping.profession_code].linked_functions.add(mapping.function_name_th || mapping.pp_function_code);
      });
    });

  const recommendationRows = Object.values(recommendations)
    .map((item) => ({
      profession_code: item.profession_code,
      profession_name_th: item.profession_name_th,
      urgency_score: Number(item.urgency_score.toFixed(2)),
      linked_indicators: Array.from(item.linked_indicators),
      linked_functions: Array.from(item.linked_functions),
      benchmark: provinceSummary.benchmarks?.[item.profession_code] || null,
    }))
    .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
    .slice(0, 8);

  const auditTrail = buildMockPpAuditTrail(capacity, provinceSummary.dictionary || {});
  const offTargetRows = outcomes.filter((item) => item.is_off_target);
  return {
    province_code: profile.provinceCode,
    province_name_th: profile.provinceName || provinceSummary.province_name_th,
    amphur_code: profile.amphurCode,
    amphur_name: profile.amphurName,
    year_be: provinceSummary.year_be || null,
    scope_type: 'amphur',
    scope_population_total: profile.populationTotal,
    scope_population_source: profile.populationSource,
    scope_population_reference_year: profile.populationReferenceYear,
    data_status: {
      indicator_count: outcomes.filter((item) => item.value_num !== null && item.value_num !== undefined).length,
      fact_count: outcomes.filter((item) => item.value_num !== null && item.value_num !== undefined).length,
      off_target_indicator_count: offTargetRows.length,
      capacity_rows: capacity.length,
      total_capacity_fte: capacity.reduce((sum, row) => sum + (parseFloat(row.fte_total || 0) || 0), 0),
      total_capacity_headcount: capacity.reduce((sum, row) => sum + (parseFloat(row.headcount_total || 0) || 0), 0),
      shortlist_only: true,
      expected_indicator_count: outcomes.length,
    },
    capacity,
    outcomes,
    recommendations: recommendationRows,
    dictionary: provinceSummary.dictionary || {},
    benchmarks: provinceSummary.benchmarks || {},
    audit_trail: auditTrail,
    confidence: provinceSummary.confidence || null,
  };
}

function buildMockPpCapacityEditor(source) {
  const fields = getPpCapacityFieldDefinitions(source);
  const templateHospital = getSelectedTemplateHospital();
  const cards = fields.map((field) => buildMockField(
    {
      code: field.code,
      scope: 'pp_capacity',
      baselineScope: 'baseline_pp_capacity',
      label: `${field.professionNameTh}`,
      unit: 'คน',
      step: '1',
      supportHint: field.functionNameTh,
      fieldType: 'support_headcount',
    },
    getMockNumericValue(field.code, 0, 'pp_capacity'),
  )).join('');
  return `
    <div class="mock-panel">
      <div class="mock-panel-title">
        <h4>PP Capacity Input</h4>
      </div>
      <div class="mock-panel-note">baseline PP capacity ใช้ district baseline ของอำเภอและระดับโรงพยาบาล แล้วผู้ใช้แก้ไข headcount ราย function x profession ได้เอง${templateHospital ? ` | template optional override: ${templateHospital}` : ''}</div>
      <div class="mock-form-grid" style="margin-top:12px">
        ${cards}
      </div>
      <div class="mock-form-actions">
        ${buildResetBaselineButtonHtml('pp_capacity', 'baseline_pp_capacity', 'reset PP baseline')}
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : 'Ready'}</span>
      </div>
    </div>
  `;
}

function buildMockPpOutcomeEditor(source) {
  const rows = Array.isArray(source?.outcomes) ? source.outcomes : [];
  const cards = rows.map((item) => buildMockField(
    {
      code: item.indicator_code,
      scope: 'pp_outcome',
      baselineScope: 'baseline_pp_outcome',
      label: item.indicator_name_th,
      unit: item.unit || '',
      step: '0.01',
    },
    getMockNumericValue(item.indicator_code, item.value_num ?? '', 'pp_outcome'),
  )).join('');
  return `
    <div class="mock-panel">
      <div class="mock-panel-title">
        <h4>PP Outcome Input</h4>
      </div>
      <div class="mock-panel-note">ระบบ preload ค่า baseline จากอำเภอที่เลือก แล้วเปิดให้แก้ค่า outcome phase 1 ก่อนคำนวณ recommendation ใหม่</div>
      <div class="mock-form-grid" style="margin-top:12px">
        ${cards}
      </div>
      <div class="mock-form-actions">
        ${buildResetBaselineButtonHtml('pp_outcome', 'baseline_pp_outcome', 'reset PP outcome')}
        <span class="mock-status-text mock-panel-state">${mockSession.saveState === 'saving' ? 'Saving...' : 'Ready'}</span>
      </div>
    </div>
  `;
}

function getChronicPrevalence(name = selectedHospital) {
  const hospital = HOSPITALS[name] || {};
  if (isMockHospital(name)) {
    return ['prevalence_cvd', 'prevalence_cancer', 'prevalence_dm', 'prevalence_ckd']
      .reduce((sum, key) => sum + (parseFloat(hospital.hni?.[key]) || 0), 0);
  }
  const provinceName = HOSP_CONFIG[name]?.province;
  const ref = provinceName ? PROVINCE_PREVALENCE[provinceName] : null;
  if (ref) return ref.CVD + ref.Cancer + ref.DM + ref.CKD;
  return hospital.hni?.['Chronic_Rate_%'] || hospital.hni?.['chronic_rate_norm'] || 0;
}

function queueMockSave(values) {
  if (!mockSession.scenarioId) return;
  values.forEach((value) => {
    setMockInputLocal(value);
    mockPendingValues[getMockInputKey(value.indicator_code, value.scope || 'global')] = value;
  });
  mockSession.saveState = 'saving';
  updateMockStatus('saving', 'Saving mock draft...');

  clearTimeout(mockSaveTimer);
  mockSaveTimer = setTimeout(async () => {
    const payloadValues = Object.values(mockPendingValues);
    mockPendingValues = {};
    try {
      await apiRequest(`/scenarios/${mockSession.scenarioId}/inputs`, {
        method:'PUT',
        body: JSON.stringify({ values: payloadValues }),
      });
      mockSession.saveState = 'ready';
      persistMockSessionState();
      updateMockStatus('ready', 'Mock draft saved');
      document.querySelectorAll('.mock-panel-state').forEach((node) => { node.textContent = 'Saved'; });
    } catch (error) {
      console.error(error);
      mockSession.saveState = 'error';
      updateMockStatus('error', 'Mock save failed');
      document.querySelectorAll('.mock-panel-state').forEach((node) => { node.textContent = 'Save failed'; });
    }
  }, MOCK_INPUT_DEBOUNCE_MS);
}

async function saveMockRunSnapshot() {
  if (!isMockHospital() || !mockSession.scenarioId) return;
  const details = Object.entries(SPECIALTY_MAP).map(([code, spec]) => {
    const val = getIndicatorValue(selectedHospital, code);
    const numVal = val === null ? null : parseFloat(val);
    const specialtyCapacity = getSpecialtyCapacitySnapshot(code);
    const demand = numVal === null || Number.isNaN(numVal)
      ? { addDoc:0, addNurse:0, issue:false }
      : computeSpecialtyDemand(spec, numVal, window._gapLevel || 'green');
    const supportCapacity = (PROFESSION_SUPPORT_MAP[code] || []).map((profession) => ({
      label: profession.label,
      total_count: getProfessionCount(profession.totalCode || profession.code),
      ...getProfessionSpecialtySupportSnapshot(code, profession.roleCode),
    }));
    return {
      indicator_code: code,
      observed_value: numVal,
      status: demand.issue ? 'issue' : 'ok',
      suggested_doc_add: demand.addDoc,
      suggested_nurse_add: demand.addNurse,
      process_note: spec.process,
      detail_json: {
        current_doc_headcount: specialtyCapacity.docHeadcount,
        current_nurse_headcount: specialtyCapacity.nurseHeadcount,
        current_fte_factor: specialtyCapacity.fteFactor,
        current_coverage_pct: specialtyCapacity.coveragePct,
        support_capacity: supportCapacity,
      },
    };
  });

  const payload = {
    hni_score: window._hni || null,
    wci_score: window._wci || null,
    gap_score: window._hni !== undefined && window._wci !== undefined ? (window._hni - window._wci) : null,
    dq_pass: window._dqPass !== false,
    confidence_level: window._dqPass === false ? 'provisional' : 'standard',
    engine_version: 'mock-ui-v1',
    summary_json: {
      selectedHospital,
      outcome_good: window._outcomeGood !== false,
      outcome_data_count: window._outcomeDataCount || 0,
      issue_count: window._issueCount || 0,
      profession_capacity: {
        doctor_total: getProfessionCount('doctor_total'),
        nurse_total: getProfessionCount('nurse_total'),
        pharmacist_total: getProfessionCount('pharmacist_total'),
        physical_therapist_total: getProfessionCount('physical_therapist_total'),
        psychologist_total: getProfessionCount('psychologist_total'),
        clinical_psychologist_total: getProfessionCount('clinical_psychologist_total'),
      },
      profession_need_mix: window._professionMix || {},
    },
    details,
  };

  const signature = JSON.stringify(payload);
  if (signature === mockSession.lastRunSignature) return;

  try {
    await apiRequest(`/scenarios/${mockSession.scenarioId}/runs`, {
      method:'POST',
      body: JSON.stringify(payload),
    });
    mockSession.lastRunSignature = signature;
    persistMockSessionState();
  } catch (error) {
    console.error('Unable to save mock run result', error);
  }
}

// ========== Data Loading ==========
async function loadData() {
  try {
    restoreMockSessionState();
    const resp = await fetch('data_inputV1.csv');
    const text = await resp.text();
    const parsed = Papa.parse(text, { header:true, skipEmptyLines:true });
    DATA = parsed.data;
    processData();
    await resolveMockApiBase();
    await fetchAnalysisConfig();
    await loadMockCatalog();
    if (mockSession.scenarioId) {
      try {
        await loadMockScenario(mockSession.scenarioId);
        selectedHospital = MOCK_HOSPITAL_NAME;
      } catch (error) {
        mockSession.scenarioId = null;
        mockSession.hospitalId = null;
        mockSession.inputs = {};
        localStorage.removeItem(MOCK_STORAGE_KEY);
        updateMockStatus('warn', 'Mock draft reset');
      }
    } else {
      updateMockStatus('inactive', 'Mock inactive');
    }
    document.getElementById('dataStatus').textContent = `${DATA.length} rows loaded`;
    document.getElementById('dataStatus').style.background = 'rgba(16,185,129,0.15)';
    buildStepDots();
    await renderStep0();
  } catch(e) {
    document.getElementById('dataStatus').textContent = 'Error loading data';
    document.getElementById('dataStatus').style.background = 'rgba(239,68,68,0.15)';
    document.getElementById('dataStatus').style.color = '#ef4444';
    updateMockStatus('error', 'Bootstrap failed');
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

function createEmptyHospitalProfile() {
  return {
    population: { 'ประชากรรวม':0, 'ประชากรชาย':0, 'ประชากรหญิง':0 },
    workforce: { doctors:{}, nurses:{}, pharma:{} },
    professionCapacity: {},
    professionSpecialtyCapacity: {},
    specialtyCapacity: {},
    hni: {},
    cmi: {},
    indicators: {},
  };
}

function ensureHospitalData(name) {
  if (!HOSPITALS[name]) HOSPITALS[name] = createEmptyHospitalProfile();
  return HOSPITALS[name];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getMetricStatus(item, val) {
  if (val === null || Number.isNaN(val)) return { status:'', isBad:false, unitHint:'ข้อมูลไม่พอ' };
  if (item.goodDir === 'low') {
    const isBad = val > item.threshold;
    return { status:isBad ? 'bad' : 'good', isBad, unitHint:`น้อย=ดี | เกณฑ์: < ${item.threshold}` };
  }
  if (item.goodDir === 'high') {
    const isBad = val < item.threshold;
    return { status:isBad ? 'warn' : 'good', isBad, unitHint:`มาก=ดี | เกณฑ์: > ${item.threshold}` };
  }
  if (item.goodDir === 'range') {
    const min = item.threshold[0];
    const max = item.threshold[1];
    const inRange = val >= min && val <= max;
    return { status:inRange ? 'good' : 'warn', isBad:!inRange, unitHint:`ช่วงเหมาะสม=${min}-${max}` };
  }
  return { status:'', isBad:false, unitHint:'' };
}

function formatThreshold(spec) {
  const unit = spec.unit || '';
  return spec.dir === 'low'
    ? `< ${spec.threshold}${unit}`
    : `> ${spec.threshold}${unit}`;
}

function formatMetricValue(val, unit) {
  if (val === null || Number.isNaN(val)) return 'N/A';
  return `${val.toFixed(2)}${unit || ''}`;
}

function getPpOutcomeStatus(item) {
  if (item?.value_num === null || item?.value_num === undefined || Number.isNaN(Number(item.value_num))) {
    return 'warn';
  }
  if (item?.is_off_target) return 'bad';
  return 'good';
}

function formatPpDirectionHint(item) {
  const direction = item?.good_direction === 'high'
    ? 'มาก=ดี'
    : item?.good_direction === 'low'
      ? 'น้อย=ดี'
      : 'ไม่มีทิศทาง';
  const targetText = item?.target_value !== null && item?.target_value !== undefined
    ? `${Number(item.target_value).toFixed(0)}`
    : 'N/A';
  return `${item?.unit || '-'} | ${direction} | เกณฑ์: ${targetText}`;
}

function computePpIndicatorGapRatio(item, isMockMode = false) {
  if (!item) return 0;
  if (isMockMode) {
    const offTargetDistricts = Number(item.off_target_districts || 0);
    const districtCount = Math.max(Number(item.district_count || 0), 1);
    return clamp(offTargetDistricts / districtCount, 0, 1);
  }

  const valueNum = Number(item.value_num);
  const targetValue = Number(item.target_value);
  if (!Number.isFinite(valueNum) || !Number.isFinite(targetValue)) return 0;

  if (item.good_direction === 'high') {
    return clamp((targetValue - valueNum) / Math.max(Math.abs(targetValue), 1), 0, 2);
  }
  if (item.good_direction === 'low') {
    if (targetValue <= 0) return valueNum > 0 ? 1 : 0;
    return clamp((valueNum - targetValue) / Math.max(Math.abs(targetValue), 1), 0, 2);
  }
  return 0;
}

function getPpRecommendationSeverity(item, isMockMode = false) {
  const gapRatio = computePpIndicatorGapRatio(item, isMockMode);
  if (gapRatio >= 0.5) {
    return { cardClass: 'pp-severity-red', severityLabel: 'วิกฤติ' };
  }
  if (gapRatio > 0) {
    return { cardClass: 'pp-severity-yellow', severityLabel: 'ต้องเร่งติดตาม' };
  }
  return { cardClass: 'pp-severity-green', severityLabel: 'คงระดับ' };
}

function getPpScenarioAddCount(source, recommendation) {
  const professionCode = recommendation?.profession_code;
  const benchmark = source?.benchmarks?.[professionCode];
  const audit = source?.audit_trail?.[professionCode];
  const population = parseFloat(source?.scope_population_total || 0);
  if (benchmark && audit && population > 0) {
    const ratePer = parseFloat(benchmark.rate_per || 0);
    const targetValue = parseFloat(benchmark.target_value || 0);
    const pressureFactor = parseFloat(benchmark.pressure_fte_factor || 1) || 1;
    const current = parseFloat(audit.count || 0) || 0;
    if (ratePer > 0 && targetValue > 0) {
      const baselineNeed = (targetValue * population) / ratePer;
      const urgencyScore = Number(recommendation?.urgency_score || 0);
      const needFte = baselineNeed * (1 + Math.min(0.8, (urgencyScore / 10) * pressureFactor));
      return Math.max(0, Math.ceil(needFte - current));
    }
  }
  const urgencyScore = Number(recommendation?.urgency_score || 0);
  if (urgencyScore >= 8) return 2;
  if (urgencyScore > 0) return 1;
  return 0;
}

function buildPpScenarioTagHtml(source, recommendation) {
  const professionCode = recommendation?.profession_code || '';
  const professionLabel = getPpProfessionLabel(source, professionCode, recommendation?.profession_name_th || professionCode);
  const addCount = getPpScenarioAddCount(source, recommendation);
  const compactLabel = professionCode || professionLabel;
  const titleLabel = professionCode && professionLabel && professionCode !== professionLabel
    ? `${professionCode} • ${professionLabel}`
    : (professionLabel || professionCode);
  const scenarioSuffix = addCount > 0 ? ` (+${addCount})` : '';
  return `<span class="rec-tag" title="${escapeHtml(titleLabel)}">${escapeHtml(`${compactLabel}${scenarioSuffix}`)}</span>`;
}

function buildPpRecommendationCardsHtml(source, isMockMode = false) {
  const outcomes = Array.isArray(source?.outcomes) ? source.outcomes : [];
  const recommendations = Array.isArray(source?.recommendations) ? source.recommendations : [];
  const flaggedOutcomes = outcomes.filter((item) => (isMockMode ? (item.off_target_districts || 0) > 0 : !!item.is_off_target));
  if (!flaggedOutcomes.length) {
    return '<div class="rec-card maintain"><h4>ไม่พบตัวชี้วัดที่ต้องเร่งแก้</h4><p>ผลลัพธ์ฝั่งส่งเสริมป้องกันยังไม่พบ indicator ที่หลุดเป้าใน scope นี้</p></div>';
  }
  return flaggedOutcomes.map((item) => {
    const linkedRecs = recommendations
      .filter((rec) => Array.isArray(rec.linked_indicators) && rec.linked_indicators.includes(item.indicator_name_th))
      .sort((a, b) => (b.urgency_score || 0) - (a.urgency_score || 0))
      .slice(0, 4);
    const severity = getPpRecommendationSeverity(item, isMockMode);
    const professionTags = linkedRecs
      .map((rec) => buildPpScenarioTagHtml(source, rec))
      .join('');
    const linkedFunctions = [...new Set(linkedRecs.flatMap((rec) => rec.linked_functions || []))].slice(0, 4);
    const directionText = item.good_direction === 'high' ? 'มาก=ดี' : item.good_direction === 'low' ? 'น้อย=ดี' : 'ไม่มีทิศทาง';
    const targetText = item.target_value !== null && item.target_value !== undefined ? Number(item.target_value).toFixed(0) : 'N/A';
    const valueText = isMockMode
      ? `${item.off_target_districts || 0} อำเภอ`
      : formatMetricValue(item.value_num, item.unit || '');
    const subline = isMockMode
      ? `มีอำเภอที่ไม่ผ่าน ${item.off_target_districts || 0} แห่ง | ${directionText} | เกณฑ์: ${targetText}${item.unit || ''}`
      : `${directionText} | เกณฑ์: ${targetText}${item.unit || ''} | ค่าในอำเภอ: ${valueText}`;
    const functionLine = linkedFunctions.length
      ? `<p style="margin-top:8px">ฟังก์ชันที่เชื่อม: ${escapeHtml(linkedFunctions.join(', '))}</p>`
      : '';
    const reasonLine = linkedRecs.length
      ? `<p style="margin-top:8px">ข้อเสนอด้านคน: ${escapeHtml(linkedRecs.map((rec) => `${getPpProfessionLabel(source, rec.profession_code, rec.profession_name_th)} (+${getPpScenarioAddCount(source, rec)})`).join(', '))}</p>`
      : '<p style="margin-top:8px">ยังไม่มี workforce mapping เฉพาะสำหรับตัวชี้วัดนี้</p>';
    return `
      <div class="rec-card ${severity.cardClass}">
        <h4>${escapeHtml(item.indicator_name_th)} = ${escapeHtml(valueText)}</h4>
        <p>${escapeHtml(subline)} | ระดับ: ${severity.severityLabel}</p>
        ${professionTags ? `<div class="rec-tags">${professionTags}</div>` : ''}
        ${functionLine}
        ${reasonLine}
      </div>
    `;
  }).join('');
}

function buildPpOutcomeCardsHtml(outcomes, mode = 'district') {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  if (!rows.length) {
    return '<p class="mini-empty">ยังไม่มี outcome summary</p>';
  }
  return rows.map((item) => {
    const status = getPpOutcomeStatus(item);
    const color = status === 'bad' ? 'var(--red)' : status === 'warn' ? 'var(--yellow)' : 'var(--green)';
    const value = mode === 'province'
      ? `${item.off_target_districts || 0} off-target`
      : formatMetricValue(item.value_num, item.unit || '');
    const hint = mode === 'province'
      ? `${item.unit || '-'} | ${item.good_direction === 'high' ? 'มาก=ดี' : item.good_direction === 'low' ? 'น้อย=ดี' : 'ไม่มีทิศทาง'} | เป้า: ${item.target_value ?? 'N/A'}`
      : formatPpDirectionHint(item);
    return `
      <div class="metric-card ${status}">
        <div class="label">${escapeHtml(item.indicator_name_th || item.indicator_code || '-')}</div>
        <div class="value" style="color:${color}">${escapeHtml(value)}</div>
        <div class="unit">${escapeHtml(hint)}${mode !== 'province' && item.is_off_target ? ' | off-target' : ''}</div>
      </div>
    `;
  }).join('');
}

function getClinicalWorkloadMetricValue(workload, metricCode) {
  const row = (workload?.metrics || []).find((item) => item.metric_code === metricCode);
  return Number(row?.median_value ?? row?.value_num ?? row?.count ?? 0) || 0;
}

async function getRecommendationContextProfile(hospitalName = selectedHospital) {
  if (isMockHospital(hospitalName)) {
    const profile = getMockProfileConfig();
    const districtProfile = profile.provinceCode && profile.amphurCode && profile.hospitalLevel
      ? await fetchDistrictBaselineProfile(profile.provinceCode, profile.amphurCode, profile.hospitalLevel)
      : null;
    return {
      hospitalName,
      provinceCode: profile.provinceCode || '',
      hospitalLevel: normalizeHospitalLevel(profile.hospitalLevel, MOCK_DEFAULT_HOSPITAL_LEVEL),
      amphurCode: profile.amphurCode || '',
      amphurName: profile.amphurName || districtProfile?.amphur_name_th || '',
      scope: null,
      districtProfile,
      isMock: true,
    };
  }

  const scope = await fetchHospitalScope(hospitalName);
  const provinceCode = scope?.province_code || getSelectedProvinceCode(hospitalName) || '';
  const hospitalLevel = normalizeHospitalLevel(HOSP_CONFIG[hospitalName]?.level || scope?.unit_type_label || '', HOSP_CONFIG[hospitalName]?.level || '');
  const amphurCode = scope?.home_amphur_code || scope?.pp_scope_code || '';
  const districtProfile = provinceCode && amphurCode && hospitalLevel
    ? await fetchDistrictBaselineProfile(provinceCode, amphurCode, hospitalLevel)
    : null;
  return {
    hospitalName,
    provinceCode,
    hospitalLevel,
    amphurCode,
    amphurName: scope?.home_amphur_name || scope?.pp_scope_name || districtProfile?.amphur_name_th || '',
    scope,
    districtProfile,
    isMock: false,
  };
}

function classifyDistrictArchetype(contextProfile, preview = window._needFtePreview) {
  const districtProfile = contextProfile?.districtProfile || null;
  const needProfile = districtProfile?.need_profile || {};
  const workload = districtProfile?.clinical_workload || {};
  const scope = contextProfile?.scope || {};
  const elderlyPct = Number(needProfile.elderly_pct ?? HOSPITALS[selectedHospital]?.hni?.['Elderly_Rate_%'] ?? 0) || 0;
  const chronicRate = Number(needProfile.prevalence_dm || 0) + Number(needProfile.prevalence_ckd || 0);
  const crossBorder = getClinicalWorkloadMetricValue(workload, 'cross_border_patients');
  const tourist = getClinicalWorkloadMetricValue(workload, 'tourist_patients');
  const mentalVisits = getClinicalWorkloadMetricValue(workload, 'mental_health_visits');
  const chronicVisits = getClinicalWorkloadMetricValue(workload, 'chronic_disease_visits');
  const denominatorMethod = preview?.denominator?.denominator_method || '';
  const hospitalLevel = contextProfile?.hospitalLevel || '';
  const clinicalScopeType = scope?.clinical_scope_type || districtProfile?.clinical_scope_type || '';

  if ((crossBorder + tourist) >= 500) {
    return {
      code: 'border_mobility',
      label: 'ชายแดน / เคลื่อนย้ายสูง',
      summary: 'ภาระบริการมีแรงกดจากผู้ป่วยเคลื่อนย้ายและเคสข้ามพื้นที่ ทำให้ continuity และการส่งต่อเป็นจุดเสี่ยง',
      reasons: [
        `cross-border + tourist workload ${Math.round(crossBorder + tourist).toLocaleString()}`,
        clinicalScopeType ? `clinical scope ${clinicalScopeType}` : 'network continuity pressure',
      ],
      focus: ['continuity of care', 'rapid referral', 'cross-area follow-up'],
    };
  }

  if (elderlyPct >= 22 || chronicVisits >= 3000 || chronicRate >= 10000) {
    return {
      code: 'aging_fragile',
      label: 'พื้นที่ผู้สูงอายุสูง',
      summary: 'ภาระหลักมาจากผู้สูงอายุและโรคเรื้อรัง จึงต้องเน้น continuity, adherence และ home/community integration',
      reasons: [
        `elderly ${elderlyPct.toFixed(1)}%`,
        chronicVisits > 0 ? `chronic workload ${Math.round(chronicVisits).toLocaleString()}` : 'chronic burden elevated',
      ],
      focus: ['frailty/chronic follow-up', 'tele-follow-up', 'home support'],
    };
  }

  if (hospitalLevel === 'เธฃเธเธจ.' || clinicalScopeType === 'province' || denominatorMethod === 'province_workload_blend') {
    return {
      code: 'urban_dense',
      label: 'เมือง / บริการหนาแน่น',
      summary: 'เป็นจุดรับ referral และเคสซับซ้อนสูง ความแออัดของ flow และ queue มักเป็น bottleneck สำคัญ',
      reasons: [
        hospitalLevel ? `hospital level ${hospitalLevel}` : 'tertiary flow pressure',
        clinicalScopeType ? `clinical scope ${clinicalScopeType}` : 'dense referral hub',
      ],
      focus: ['throughput', 'fast-track redesign', 'queue control'],
    };
  }

  return {
    code: 'rural_access',
    label: 'ชนบทเข้าถึงยาก',
    summary: 'พื้นที่พึ่งพาเครือข่ายอำเภอและการเข้าถึงบริการมากกว่าการขยายบริการซับซ้อนในจุดเดียว',
    reasons: [
      hospitalLevel ? `hospital level ${hospitalLevel}` : 'district care network',
      mentalVisits > 0 ? `mental workload ${Math.round(mentalVisits).toLocaleString()}` : 'access and follow-up pressure',
    ],
    focus: ['access', 'outreach', 'referral completion'],
  };
}

function uniqueList(values, maxItems = 3) {
  return [...new Set((values || []).filter(Boolean))].slice(0, maxItems);
}

function buildArchetypeCardHtml(archetype, contextProfile) {
  if (!archetype) return '';
  const areaLabel = contextProfile?.amphurName || contextProfile?.scope?.pp_scope_name || contextProfile?.scope?.clinical_scope_name || '-';
  return `
    <div class="rec-card archetype-card">
      <h4>District Archetype: ${escapeHtml(archetype.label)}</h4>
      <p>${escapeHtml(archetype.summary)}</p>
      <div class="rec-tags">
        <span class="rec-tag">พื้นที่ ${escapeHtml(areaLabel)}</span>
        ${uniqueList(archetype.reasons, 3).map((item) => `<span class="rec-tag">${escapeHtml(item)}</span>`).join('')}
      </div>
      <p style="margin-top:8px">Focus: ${escapeHtml(uniqueList(archetype.focus, 3).join(' | '))}</p>
    </div>
  `;
}

function buildBottleneckCardHtml(title, bottlenecks) {
  const rows = Array.isArray(bottlenecks) ? bottlenecks : [];
  if (!rows.length) {
    return `
      <div class="card split-inner-card">
        <h4>${escapeHtml(title)}</h4>
        <p class="mini-empty">ยังไม่พบ bottleneck ที่ชัดเจนจากข้อมูลรอบนี้</p>
      </div>
    `;
  }
  return `
    <div class="card split-inner-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="bottleneck-list">
        ${rows.map((item) => `
          <div class="bottleneck-item">
            <div class="bottleneck-head">
              <span class="bottleneck-pill bottleneck-${escapeHtml(item.type || 'maintain')}">${escapeHtml(item.label)}</span>
            </div>
            <p>${escapeHtml(item.evidence || '')}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildInterventionPortfolioHtml(title, portfolio) {
  const sections = [
    { key: 'quickWins', label: 'Quick Win' },
    { key: 'structural', label: 'Structural' },
    { key: 'digital', label: 'Digital' },
    { key: 'governance', label: 'Governance' },
  ];
  return `
    <div class="card split-inner-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="portfolio-grid">
        ${sections.map((section) => {
          const items = uniqueList(portfolio?.[section.key] || [], 3);
          return `
            <div class="portfolio-column">
              <div class="portfolio-title">${escapeHtml(section.label)}</div>
              ${items.length
                ? items.map((item) => `<div class="portfolio-item">${escapeHtml(item)}</div>`).join('')
                : '<div class="portfolio-item muted">ยังไม่มีข้อเสนอเฉพาะ</div>'}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function buildClinicalBottleneckSummary({ dqPass, outcomeDataCount, gapLevel, outcomeGood, issueCount, archetype, needPreview }) {
  const items = [];
  const needRows = (needPreview?.rows || []).filter((item) => Number(item.gapFte || 0) > 0.05);
  const topNeed = needRows.slice(0, 2).map((item) => item.label).join(', ');

  if (!dqPass) {
    items.push({
      type: 'data',
      label: 'Data Quality Bottleneck',
      evidence: 'G01-G04 ยังไม่ผ่านทั้งหมด จึงต้องถือผล recommendation รอบนี้เป็น provisional ก่อนอนุมัติ',
    });
  }
  if (outcomeDataCount < 3) {
    items.push({
      type: 'data',
      label: 'Outcome Evidence Gap',
      evidence: `มี outcome ใช้ยืนยันเพียง ${outcomeDataCount} ตัว ทำให้ causal confidence ยังไม่เต็ม`,
    });
  }
  if (gapLevel === 'red' && !outcomeGood) {
    items.push({
      type: 'capacity',
      label: 'Capacity Bottleneck',
      evidence: `Gap สูงและ outcome แย่พร้อมกัน จึงมีสัญญาณว่าทรัพยากร/coverage ไม่พอ${topNeed ? ` โดยเฉพาะ ${topNeed}` : ''}`,
    });
    items.push({
      type: 'process',
      label: 'Care Pathway Bottleneck',
      evidence: `มี service-plan issue ${issueCount} รายการ จึงควรแก้ fast track และ protocol ควบคู่กับเรื่องกำลังคน`,
    });
  } else if (gapLevel !== 'green' && outcomeGood) {
    items.push({
      type: 'capacity',
      label: 'Capacity Pressure',
      evidence: 'Gap ยังตึงแต่ outcome ยังดี แปลว่าระบบกำลังแบกภาระอยู่และควรเสริม capacity เชิงป้องกัน',
    });
  } else if (gapLevel === 'green' && !outcomeGood) {
    items.push({
      type: 'process',
      label: 'Process / Protocol Bottleneck',
      evidence: 'กำลังคนโดยรวมยังพอ แต่ outcome ยังไม่ดี จึงควรทบทวน flow, protocol และคุณภาพการดูแลก่อนเพิ่มคน',
    });
  }

  if (['rural_access', 'border_mobility'].includes(archetype?.code || '') && (gapLevel !== 'green' || !outcomeGood)) {
    items.push({
      type: 'access',
      label: 'Access / Referral Bottleneck',
      evidence: `บริบท ${archetype.label} ทำให้การเข้าถึงบริการและ continuity ระหว่างหน่วยบริการเป็นคอขวดร่วม`,
    });
  }
  if ((archetype?.code || '') === 'aging_fragile' && !outcomeGood) {
    items.push({
      type: 'behavior',
      label: 'Continuity / Adherence Bottleneck',
      evidence: 'พื้นที่ผู้สูงอายุสูงมักมีปัญหาการติดตามต่อเนื่อง การใช้ยา และการดูแลที่บ้านร่วมด้วย',
    });
  }

  return items.slice(0, 3);
}

function buildClinicalInterventionPortfolio({ archetype, bottlenecks, needPreview, gapLevel, issueCount }) {
  const needRows = (needPreview?.rows || []).filter((item) => Number(item.gapFte || 0) > 0.05).slice(0, 3);
  const topNeedLabels = needRows.map((item) => item.label);
  const types = new Set((bottlenecks || []).map((item) => item.type));
  const quickWins = [];
  const structural = [];
  const digital = [];
  const governance = [];

  if (types.has('data')) {
    quickWins.push('ทำ ICD / outcome data review ก่อนสรุปอัตรากำลังถาวร');
    governance.push('ตั้ง rule ให้ผลลัพธ์ที่ data quality ไม่ผ่านถูกตีความเป็น provisional');
  }
  if (types.has('capacity')) {
    quickWins.push(topNeedLabels.length ? `เสริมกำลังชั่วคราวใน ${topNeedLabels.join(', ')}` : 'จัดลำดับเติมกำลังในวิชาชีพที่ gap สูงสุดก่อน');
    structural.push('ทบทวน roster และ redistribution ระหว่างหน่วย/เวรให้รองรับภาระงานจริง');
  }
  if (types.has('process')) {
    quickWins.push('ทบทวน fast track และ protocol ของตัวชี้วัดที่หลุดเกณฑ์');
    structural.push(issueCount > 0 ? 'ปรับ care pathway ของ service plan ที่มี issue ซ้ำ' : 'ออกแบบ flow การดูแลใหม่ให้ลด handoff และ delay');
  }
  if (types.has('access')) {
    quickWins.push('ทำ referral rule และ callback list สำหรับเคสหลุดการติดตาม');
    structural.push('เชื่อมการดูแลระหว่างอำเภอ-จังหวัดด้วย network protocol เดียวกัน');
  }
  if (types.has('behavior')) {
    quickWins.push('ทำ active follow-up กลุ่มเสี่ยงสูงที่ขาดนัดหรือคุมโรคไม่ได้');
  }

  if ((archetype?.code || '') === 'aging_fragile') {
    digital.push('ใช้ tele-follow-up หรือ high-risk registry สำหรับผู้สูงอายุ/โรคเรื้อรัง');
    structural.push('ผูก home/community support กับคลินิกติดตามโรคเรื้อรัง');
  } else if ((archetype?.code || '') === 'border_mobility') {
    digital.push('ทำ continuity list สำหรับผู้ป่วยข้ามพื้นที่และเคส refer-out');
    governance.push('ประชุมร่วมเครือข่ายรับ-ส่งต่อในพื้นที่เคลื่อนย้ายสูง');
  } else if ((archetype?.code || '') === 'urban_dense') {
    digital.push('ทำ queue / fast-track dashboard สำหรับจุดที่ workload หนาแน่น');
    structural.push('แยก stream ของเคสด่วน-เคส routine เพื่อลด congestion');
  } else {
    digital.push('ใช้ district follow-up list สำหรับพื้นที่เข้าถึงยาก');
    structural.push('เพิ่ม outreach และนัดติดตามเชิงรุกในพื้นที่ห่างไกล');
  }

  governance.push(gapLevel === 'red'
    ? 'ตั้ง monthly review เฉพาะคอขวดหลักจน outcome เริ่มกลับมาในเกณฑ์'
    : 'ติดตามผลแบบ monthly exception review และเทียบกับ baseline รอบก่อน');

  return {
    quickWins: uniqueList(quickWins, 3),
    structural: uniqueList(structural, 3),
    digital: uniqueList(digital, 3),
    governance: uniqueList(governance, 3),
  };
}

function buildPpBottleneckSummary(ppSource, archetype) {
  const offTarget = Number(ppSource?.data_status?.off_target_indicator_count || 0);
  const recommendationCount = Number((ppSource?.recommendations || []).length || 0);
  const items = [];

  if (offTarget <= 0) {
    items.push({
      type: 'maintain',
      label: 'Maintain / Monitor',
      evidence: 'ยังไม่พบ indicator ที่หลุดเป้าชัดเจนใน scope นี้ ให้คงระดับและเฝ้าระวังต่อเนื่อง',
    });
    return items;
  }

  if (offTarget >= 4) {
    items.push({
      type: 'access',
      label: 'Population Outreach Bottleneck',
      evidence: `มี off-target ${offTarget} indicators สะท้อนว่าการเข้าถึง preventive service ยังไม่ทั่วถึงพอ`,
    });
  }
  if (recommendationCount > 0) {
    items.push({
      type: 'capacity',
      label: 'Workforce Alignment Bottleneck',
      evidence: `ระบบชี้ profession pressure ${recommendationCount} รายการ จึงควรจัดคนให้ตรง function ที่กด outcome`,
    });
  } else {
    items.push({
      type: 'data',
      label: 'Workforce Mapping Gap',
      evidence: 'มี indicator หลุดเป้าแต่ยังไม่เกิด profession recommendation ที่ชัด จึงต้องทบทวน mapping หรือ baseline เพิ่ม',
    });
  }
  if ((archetype?.code || '') === 'aging_fragile') {
    items.push({
      type: 'behavior',
      label: 'Continuity Prevention Bottleneck',
      evidence: 'บริบทผู้สูงอายุสูงต้องเน้น chronic prevention, home follow-up และ adherence มากกว่ากิจกรรมครั้งเดียว',
    });
  }
  return items.slice(0, 3);
}

function buildPpInterventionPortfolio(ppSource, archetype) {
  const topRecs = (ppSource?.recommendations || []).slice(0, 3).map((item) => getPpProfessionLabel(ppSource, item.profession_code, item.profession_name_th));
  const offTarget = Number(ppSource?.data_status?.off_target_indicator_count || 0);
  const quickWins = [];
  const structural = [];
  const digital = [];
  const governance = [];

  if (offTarget > 0) {
    quickWins.push('ทำ micro-target outreach เฉพาะตัวชี้วัดที่หลุดเป้าในอำเภอรับผิดชอบ');
    governance.push('ติดตาม off-target indicators แบบ monthly district review');
  }
  if (topRecs.length) {
    quickWins.push(`จัดกำลังนำใน ${topRecs.join(', ')}`);
    structural.push('จัด function mix ของ PP workforce ให้สอดคล้องกับ indicator pressure');
  } else {
    structural.push('ทบทวน baseline และ workforce mapping ของ PP indicators ก่อนขยายมาตรการ');
  }

  if ((archetype?.code || '') === 'aging_fragile') {
    quickWins.push('เน้นคัดกรองและติดตาม NCD/ผู้สูงอายุเชิงรุก');
    digital.push('ใช้ follow-up list สำหรับกลุ่มเสี่ยงสูงและผู้ขาดนัด');
  } else if ((archetype?.code || '') === 'border_mobility') {
    quickWins.push('ทำ continuity outreach สำหรับประชากรเคลื่อนย้ายสูง');
    digital.push('ทำทะเบียนกลุ่มเสี่ยงข้ามพื้นที่และการส่งต่อข้อมูลต่อเนื่อง');
  } else if ((archetype?.code || '') === 'rural_access') {
    quickWins.push('ใช้ outreach รอบหมู่บ้าน/ชุมชนในจุดเข้าถึงยาก');
    digital.push('ทำ district exception list สำหรับทีมปฐมภูมิ');
  } else {
    quickWins.push('เพิ่มจุดบริการ/กิจกรรมเชิงรุกในพื้นที่หนาแน่นที่ coverage ต่ำ');
    digital.push('ใช้ dashboard ติดตามคิวคัดกรองและ coverage รายอำเภอ');
  }

  structural.push('ผูก PP intervention กับ district archetype แทนการใช้ชุดกิจกรรมเดียวทุกพื้นที่');
  governance.push('ให้จังหวัดใช้ outcome contract กับอำเภอที่ off-target สูง');

  return {
    quickWins: uniqueList(quickWins, 3),
    structural: uniqueList(structural, 3),
    digital: uniqueList(digital, 3),
    governance: uniqueList(governance, 3),
  };
}

function computeSpecialtyDemand(spec, numVal, gapLevel) {
  let severity = 0;
  if (spec.dir === 'low') {
    severity = (numVal - spec.threshold) / spec.threshold;
  } else if (spec.dir === 'high') {
    severity = (spec.threshold - numVal) / spec.threshold;
  }
  severity = Math.max(0, severity);
  const issue = severity > 0;
  if (!issue) {
    return { issue:false, severity:0, addDoc:0, addNurse:0 };
  }

  const shortageFactor = gapLevel === 'red' ? 1.0 : gapLevel === 'yellow' ? 0.7 : 0.35;
  const severityFactor = 1 + clamp(severity, 0, 2);
  let addDoc = Math.ceil((spec.baseDoc || 1) * severityFactor * shortageFactor);
  let addNurse = Math.ceil((spec.baseNurse || 2) * severityFactor * shortageFactor);

  // ถ้า Gap ต่ำ ให้เน้น process ก่อน เว้นแต่ตัวชี้วัดวิกฤติจริง
  if (gapLevel === 'green' && severity < 0.40) {
    addDoc = 0;
    addNurse = 0;
  }

  return { issue:true, severity, addDoc, addNurse };
}

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
async function renderStep0() {
  renderMockGuide(0);
  const grid = document.getElementById('hospitalGrid');
  grid.innerHTML = '';
  const step = document.getElementById('step0');
  let profileHost = document.getElementById('mockProfilePanelHost');
  if (!profileHost) {
    profileHost = document.createElement('div');
    profileHost.id = 'mockProfilePanelHost';
    step.appendChild(profileHost);
  }
  
  Object.keys(HOSP_CONFIG).forEach(name => {
    const h = ensureHospitalData(name);
    const isMock = name === MOCK_HOSPITAL_NAME;
    const pop = h.population?.['ประชากรรวม'] || '-';
    const docs = h.workforce?.doctors?.['นายแพทย์'] || 0;
    const nurses = (h.workforce?.nurses?.['พยาบาลวิชาชีพ'] || 0) + (h.workforce?.nurses?.['พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข'] || 0);
    const pharma = sumObj(h.workforce?.pharma);
    const cfg = HOSP_CONFIG[name];
    
    const card = document.createElement('div');
    card.className = 'hospital-card' + (selectedHospital === name ? ' selected' : '') + (isMock ? ' mock-hospital' : '');
    if (isMock) {
      const displayProvince = getHospitalDisplayProvince(name);
      const displayLevel = getHospitalDisplayLevel(name);
      const profile = getMockProfileConfig();
      card.innerHTML = `
        <div class="name" style="color:${cfg.color}">+ ${name}</div>
        <div class="pop">${displayProvince} | ${displayLevel} | ${profile.loaded ? 'profile loaded' : 'ตั้งค่าข้อมูลจำลองเอง'}</div>
        <div class="staff">
          <span>${profile.loaded ? `ปชก. ${profile.populationTotal.toLocaleString()}` : 'Sandbox Mode'}</span>
          <span>${profile.loaded && profile.amphurName ? `อำเภอ${profile.amphurName}` : 'What-if Analysis'}</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="name" style="color:${cfg.color}">${name}</div>
        <div class="pop">${cfg.province} | ${cfg.level} | ปชก. ${pop.toLocaleString?.()?pop.toLocaleString():pop}</div>
        <div class="staff">
          <span title="(นับเฉพาะกลุ่ม นายแพทย์)">แพทย์ ${docs}</span>
          <span title="(นับเฉพาะกลุ่ม พยาบาลวิชาชีพ และ นักวิชาการฯ)">พยาบาล ${nurses}</span>
          <span>เภสัช ${pharma}</span>
        </div>
      `;
    }
    card.onclick = async () => {
      try {
        if (isMockHospital(name)) {
          await ensureMockScenario();
        } else {
          updateMockStatus('inactive', 'Mock inactive');
        }
        selectedHospital = name;
        await renderStep0();
      } catch (error) {
        alert('ไม่สามารถสร้าง mock draft ได้');
      }
    };
    grid.appendChild(card);
  });

  if (isMockHospital() && mockSession.scenarioId) {
    const profile = getMockProfileConfig();
    const amphurRows = profile.provinceCode ? (await fetchAmphurPopulationReference(profile.provinceCode)).rows || [] : [];
    profileHost.innerHTML = buildMockProfilePanel(amphurRows);
  } else {
    profileHost.innerHTML = '';
  }
}

// ========== Step 1: Data Quality ==========
function renderStep1() {
  renderMockGuide(1);
  const grid = document.getElementById('dqMetrics');
  grid.innerHTML = '';

  if (isMockHospital()) {
    const profile = getMockProfileConfig();
    const dqBaselineLabel = getMockProfileText('dq_baseline_label', '');
    const editor = document.createElement('div');
    editor.className = 'metric-card editor-card';
    editor.innerHTML = buildMockPanel(
      'Manual Data Quality Input',
      dqBaselineLabel || 'DQ baseline จะ preload จาก peer hospital median ตามระดับโรงพยาบาล',
      DQ_FIELDS.map((field) => ({
        code: field.code,
        label: `${field.code} • ${field.label}`,
        unit: field.unit,
        baselineScope:'baseline_global_dq',
      })),
      buildResetBaselineButtonHtml('global', 'baseline_global_dq', 'reset DQ baseline'),
      profile.loaded ? [
        { source:'district_baseline', label:'district baseline' },
      ] : [],
    );
    grid.appendChild(editor);
  }
  
  let allPass = true;
  DQ_FIELDS.forEach((field) => {
    const code = field.code;
    const val = getIndicatorValue(selectedHospital, code);
    const hasVal = val !== null && !Number.isNaN(parseFloat(val));
    const numVal = hasVal ? parseFloat(val) : NaN;
    const pass = hasVal && numVal <= field.threshold;
    if (!pass) allPass = false;
    
    const card = document.createElement('div');
    card.className = `metric-card ${pass ? 'good' : 'bad'}`;
    card.innerHTML = `
      <div class="label">${code}: ${field.label}</div>
      <div class="value" style="color:${pass?'var(--green)':'var(--red)'}">${hasVal ? numVal.toFixed(2)+'%' : 'N/A'}</div>
      <div class="unit">เกณฑ์: < ${field.threshold}% | ${pass ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}</div>
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
  window._dqPass = allPass;
}

// ========== Step 2: Health Need ==========
function renderStep2() {
  renderMockGuide(2);
  const h = HOSPITALS[selectedHospital];
  const pop = h.population?.['ประชากรรวม'] || 0;
  const male = h.population?.['ประชากรชาย'] || 0;
  const female = h.population?.['ประชากรหญิง'] || 0;
  const cfg = HOSP_CONFIG[selectedHospital];
  const displayProvince = getHospitalDisplayProvince(selectedHospital);
  
  document.getElementById('popCard').innerHTML = `
    <h3>ข้อมูลประชากร — ${displayProvince}</h3>
    <div class="metric-card"><div class="label">ประชากรรวม</div><div class="value" style="color:var(--accent2)">${pop.toLocaleString()}</div><div class="unit">คน (HDC ปี 2569)</div></div>
    <div style="display:flex;gap:12px;margin-top:8px;">
      <div class="metric-card" style="flex:1"><div class="label">ชาย</div><div class="value" style="font-size:18px">${male.toLocaleString()}</div></div>
      <div class="metric-card" style="flex:1"><div class="label">หญิง</div><div class="value" style="font-size:18px">${female.toLocaleString()}</div></div>
    </div>
  `;
  
  if (isMockHospital()) {
    const profile = getMockProfileConfig();
    const needBaselineLabel = getMockProfileText('need_baseline_label', '');
    document.getElementById('popCard').innerHTML += buildMockPanel(
      'Manual Need Input',
      needBaselineLabel || 'Need baseline จะ preload จาก HDC population/elderly + district burden/workload proxy',
      NEED_INPUT_FIELDS.map((field) => ({ ...field, baselineScope:'baseline_global_need' })),
      buildResetBaselineButtonHtml('global', 'baseline_global_need', 'reset need baseline'),
      profile.loaded ? [
        { source:'district_baseline', label:'district baseline' },
      ] : [],
    );
  } else if (cfg.province && PROVINCE_PREVALENCE[cfg.province]) {
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

  if (isMockHospital()) {
    document.getElementById('sliderElderly').value = getMockNumericValue('weight_elderly', 40);
    document.getElementById('sliderChronic').value = getMockNumericValue('weight_chronic', 40);
    document.getElementById('sliderMental').value = getMockNumericValue('weight_mental', 20);
  }
  
  computeHNI();
}

function computeHNI() {
  const wE = parseInt(document.getElementById('sliderElderly').value);
  const wC = parseInt(document.getElementById('sliderChronic').value);
  const wM = parseInt(document.getElementById('sliderMental').value);
  document.getElementById('wElderly').textContent = wE;
  document.getElementById('wChronic').textContent = wC;
  document.getElementById('wMental').textContent = wM;
  
  const h = HOSPITALS[selectedHospital];
  const elderly = h.hni?.['Elderly_Rate_%'] || h.hni?.['elderly_rate_norm'] || 0;
  const chronic = getChronicPrevalence(selectedHospital);
  const mental = h.hni?.['Mental_Risk_Rate_%'] || h.hni?.['mental_rate_norm'] || 0;
  const hniBenchmarks = getBenchmarkLookup('hni_component');
  const refE = parseFloat(hniBenchmarks?.elderly_rate_pct?.reference_value || hniBenchmarks?.elderly_rate_pct?.target_value || 30) || 30;
  const refC = parseFloat(hniBenchmarks?.chronic_rate_pct?.reference_value || hniBenchmarks?.chronic_rate_pct?.target_value || 25) || 25;
  const refM = parseFloat(hniBenchmarks?.mental_risk_rate_per100k?.reference_value || hniBenchmarks?.mental_risk_rate_per100k?.target_value || 5000) || 5000;

  const normE = Math.min(1.5, elderly / Math.max(refE, 1));
  const normC = Math.min(1.5, chronic / Math.max(refC, 1));
  const normM = Math.min(1.5, mental / Math.max(refM, 1));
  
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
    <div style="font-size:11px;color:var(--text2);margin-top:6px">reference: ผู้สูงอายุ ${refE}%, chronic ${refC}%, mental ${refM.toLocaleString()}/100k</div>
  `;
  
  window._hni = hni;
  window._needFtePreview = null;

  if (isMockHospital()) {
    queueMockSave([
      { indicator_code:'weight_elderly', value_num:wE, scope:'global' },
      { indicator_code:'weight_chronic', value_num:wC, scope:'global' },
      { indicator_code:'weight_mental', value_num:wM, scope:'global' },
    ]);
  }
}

// ========== Step 3: Workforce Capacity ==========
async function renderStep3() {
  renderMockGuide(3);
  const h = HOSPITALS[selectedHospital];
  const pop = h.population?.['ประชากรรวม'] || 1;
  const provinceCode = getSelectedProvinceCode();
  const mockProfile = isMockHospital() ? getMockProfileConfig() : null;
  const clinicalBaseline = isMockHospital() ? getMockClinicalBaselineSummary(mockProfile) : null;
  const hospitalScope = isMockHospital() ? null : await fetchHospitalScope(selectedHospital);
  const hrUnitSummary = isMockHospital() ? null : await fetchHrUnitWorkforceSummary(provinceCode, selectedHospital);
  const docs = hrUnitSummary?.counts?.doctor_total ?? getProfessionCount('doctor_total');
  const nurses = hrUnitSummary?.counts?.nurse_total ?? getProfessionCount('nurse_total');
  const pharma = hrUnitSummary?.counts?.pharmacist_total ?? getProfessionCount('pharmacist_total');
  const pt = hrUnitSummary?.counts?.physical_therapist_total ?? getProfessionCount('physical_therapist_total');
  const psych = hrUnitSummary?.counts?.psychologist_total ?? getProfessionCount('psychologist_total');
  const cpsych = hrUnitSummary?.counts?.clinical_psychologist_total ?? getProfessionCount('clinical_psychologist_total');
  const professionMixTags = Object.entries(window._professionMix || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, weight]) => {
      const field = PROFESSION_FIELDS.find((item) => item.code === code);
      return `<span class="rec-tag">Need mix: ${field?.label || code} ${weight.toFixed(0)}%</span>`;
    })
    .join('');
  
  const grid = document.getElementById('wfMetrics');
  grid.innerHTML = '';

  if (isMockHospital()) {
    const editor = document.createElement('div');
    editor.className = 'metric-card editor-card';
    editor.innerHTML = buildMockPanel(
      'Manual Professional Workforce Input',
      clinicalBaseline?.label || 'baseline clinical workforce จาก district profile',
      CAPACITY_FIELDS.map((field) => ({ ...field, baselineScope:'baseline_global_capacity' })),
      buildResetBaselineButtonHtml('global', 'baseline_global_capacity', 'reset clinical workforce'),
      [
        {
          source: clinicalBaseline?.capacitySource || 'district_baseline',
          label: (clinicalBaseline?.capacitySource || 'district_baseline') === 'template_override' ? 'template override' : 'district baseline',
        },
      ],
    );
    grid.appendChild(editor);

    const specialtyEditor = document.createElement('div');
    specialtyEditor.className = 'metric-card editor-card';
    specialtyEditor.innerHTML = buildSpecialtyCapacityPanel();
    grid.appendChild(specialtyEditor);

    const supportEditor = document.createElement('div');
    supportEditor.className = 'metric-card editor-card';
    supportEditor.innerHTML = buildProfessionSupportPanel();
    grid.appendChild(supportEditor);
  }
  
  const split = document.createElement('div');
  split.className = 'split-stage-card';
  split.innerHTML = `
    <section class="domain-panel domain-panel-pp">
      <div class="domain-panel-header">
        <span class="domain-kicker">ส่งเสริมป้องกัน</span>
        <h3>Primary Care / Public Health Capacity</h3>
        <p>${isMockHospital()
          ? (mockProfile?.loaded
            ? `PP Scope: อำเภอ${mockProfile?.amphurName || '-'} จ.${mockProfile?.provinceName || '-'} | preload แล้วและแก้ไขค่า mock ได้เอง`
            : 'เลือกจังหวัด/อำเภอใน Step 0 แล้วกด preload โปรไฟล์ก่อน เพื่อให้ PP capacity ฝั่ง mock คำนวณต่อได้จริง')
          : `PP Scope: อำเภอ${hospitalScope?.pp_scope_name || '-'} | ดูแลส่งเสริมป้องกันเฉพาะพื้นที่ประจำของโรงพยาบาล`}</p>
      </div>
      <div id="ppCapacityPanel" class="domain-panel-body">
        <div class="card split-inner-card"><p>กำลังโหลดข้อมูล PP capacity...</p></div>
      </div>
    </section>
    <section class="domain-panel domain-panel-clinical">
      <div class="domain-panel-header">
        <span class="domain-kicker">รักษา-ฟื้นฟู</span>
        <h3>Hospital Treatment / Rehab Capacity</h3>
        <p>${isMockHospital() ? 'กำลังคนฝั่งรักษา เภสัชกรรม สุขภาพจิต และฟื้นฟูตามโครงสร้างโรงพยาบาล' : `Clinical Scope: ${hospitalScope?.clinical_scope_type === 'province' ? `จังหวัด${hospitalScope?.clinical_scope_name || ''}` : hospitalScope?.clinical_scope_type === 'network_zone' ? `เครือข่ายส่งต่อรอบ${hospitalScope?.lookup_unit_name || selectedHospital}` : `อำเภอ${hospitalScope?.clinical_scope_name || '-'}`} | ${hospitalScope?.clinical_scope_note || ''}`}</p>
      </div>
      <div id="clinicalCapacityPanel" class="domain-panel-body">
        <div class="domain-card-grid" id="clinicalCapacityGrid"></div>
        <div class="card split-inner-card" id="clinicalCapacityDetail"></div>
      </div>
    </section>
  `;
  grid.appendChild(split);

  const clinicalGrid = split.querySelector('#clinicalCapacityGrid');
  const clinicalDetail = split.querySelector('#clinicalCapacityDetail');

  const hrDictionary = hrUnitSummary?.dictionary || workforceDictionaryRegistry.hr || {};
  const items = [
    { code:'doctor_total', label:'แพทย์ทั้งหมด', note:'(นับเฉพาะ นายแพทย์)', val:docs, ratio:(docs/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'nurse_total', label:'พยาบาลทั้งหมด', note:'(พยาบาลวิชาชีพ / นักวิชาการฯ)', val:nurses, ratio:(nurses/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'pharmacist_total', label:'เภสัชกรทั้งหมด', val:pharma, ratio:(pharma/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'physical_therapist_total', label:'นักกายภาพบำบัด', note:'(รองรับ rehab / DALY disability)', val:pt, ratio:(pt/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'psychologist_total', label:'นักจิตวิทยา', note:'(รองรับ mental health need)', val:psych, ratio:(psych/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'clinical_psychologist_total', label:'นักจิตวิทยาคลินิก', note:'(รองรับ mental outcome)', val:cpsych, ratio:(cpsych/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
    { code:'total', label:'รวมบุคลากร', val:docs+nurses+pharma+pt+psych+cpsych, ratio:((docs+nurses+pharma+pt+psych+cpsych)/pop*10000).toFixed(1), unit:'คน/หมื่นปชก.' },
  ];
  
  items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    const dictNote = it.code !== 'total' ? (hrDictionary[it.code]?.note_th || it.note || '') : (it.note || '');
    card.innerHTML = `
      <div class="label" title="${dictNote}">${it.label} ${dictNote ? `<span style="display:block;font-size:10px;color:var(--text2);font-weight:normal;margin-top:2px;">${dictNote}</span>` : ''}</div>
      <div class="value" style="color:var(--accent2)">${it.val.toLocaleString()}</div>
      <div class="unit">${it.ratio} ${it.unit}</div>
      ${it.code !== 'total' ? `<div class="metric-card-actions">${buildDictionaryButtonHtml('hr', it.code)}</div>` : ''}
    `;
    clinicalGrid.appendChild(card);
  });
  
  // Top doctor specialties
  const docList = hrUnitSummary?.top_doctors?.length
    ? hrUnitSummary.top_doctors.map((item) => [item.label, item.count])
    : Object.entries(h.workforce?.doctors || {}).sort((a,b) => b[1]-a[1]).slice(0,5);
  const nurseList = hrUnitSummary?.top_nurses?.length
    ? hrUnitSummary.top_nurses.map((item) => [item.label, item.count])
    : Object.entries(h.workforce?.nurses || {}).sort((a,b) => b[1]-a[1]).slice(0,5);
  clinicalDetail.innerHTML = `
    <div class="split-inner-columns">
      <div>
        <h4>Top 5 แพทย์</h4>
        ${docList.length ? docList.map(([k,v])=>`<div class="mini-row"><span>${k}</span><strong>${v}</strong></div>`).join('') : '<p class="mini-empty">ยังไม่มีข้อมูล</p>'}
      </div>
      <div>
        <h4>Top 5 พยาบาล</h4>
        ${nurseList.length ? nurseList.map(([k,v])=>`<div class="mini-row"><span>${k}</span><strong>${v}</strong></div>`).join('') : '<p class="mini-empty">ยังไม่มีข้อมูล</p>'}
      </div>
    </div>
    ${hrUnitSummary?.audit_trail ? buildAuditPanelHtml(
      'DB Audit Trail',
      'hr',
      Object.entries(hrUnitSummary.audit_trail).map(([metricCode, item]) => ({ metricCode, item })),
    ) : ''}
    ${professionMixTags ? `<div class="domain-inline-note"><strong>Need-sensitive mix</strong> ${professionMixTags}</div>` : ''}
  `;
  
  const needPreview = await fetchNeedFtePreview(selectedHospital, true);
  const workloadReferences = await fetchWorkloadReferences();
  const wciCard = document.getElementById('wciCard');
  const serviceMatrixCard = document.getElementById('serviceMatrixCard');
  const professionWci = computeMultiProfessionWCI(selectedHospital, needPreview);
  const wci = professionWci.wci;
  window._wci = wci;
  window._professionMix = professionWci.mix;
  window._needFtePreview = needPreview;
  
  const wciColor = wci > 80 ? 'var(--green)' : wci > 60 ? 'var(--yellow)' : 'var(--red)';
  const mixTags = Object.entries(professionWci.mix)
    .sort((a, b) => b[1] - a[1])
    .map(([code, weight]) => {
      const field = PROFESSION_FIELDS.find((item) => item.code === code);
      return `<span class="specialty-tag">${field?.label || code} ${weight.toFixed(0)}%</span>`;
    }).join('');
  const scoreRows = Object.entries(professionWci.detail)
    .map(([code, item]) => {
      const field = PROFESSION_FIELDS.find((prof) => prof.code === code);
      const unit = getProfessionRateUnit(item.benchmark.per);
      return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${field?.label || code}</span><strong>${item.ratio.toFixed(1)} ${unit}</strong></div>`;
    }).join('');
  const denominatorMeta = getClinicalDenominatorMeta(needPreview);
  const needRows = (needPreview.rows || []).slice(0, 6)
    .map((item) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${item.label}</span><strong>${item.gapFte > 0.05 ? `Gap ${item.gapFte.toFixed(1)} FTE → +${item.suggestedAdd}` : 'เพียงพอ'}</strong></div>`)
    .join('');
  wciCard.innerHTML = `
    <h3>Workforce Capacity Index (WCI)</h3>
    <div style="text-align:center;padding:10px;">
      <div style="font-size:42px;font-weight:800;color:${wciColor}">${wci.toFixed(1)}</div>
      <div style="font-size:13px;color:var(--text2)">${wci>80?'🟢 กำลังคนเพียงพอ':wci>60?'🟡 ต้องเฝ้าระวัง':'🔴 กำลังคนไม่เพียงพอ'}</div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-top:8px;text-align:center">WCI เวอร์ชันนี้ถ่วงน้ำหนักตาม Need + DALY-sensitive profession mix + clinical denominator ที่ปรับตาม scope/workload</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px">${mixTags}</div>
    <div style="display:flex;gap:16px;margin-top:16px;">
      <div style="flex:1"><h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Top 5 แพทย์</h4>${docList.map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
      <div style="flex:1"><h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Top 5 พยาบาล</h4>${nurseList.map(([k,v])=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    </div>
    <div style="margin-top:16px">
      <h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Multi-Profession Capacity Ratios</h4>
      ${scoreRows}
    </div>
    <div style="margin-top:16px">
      <h4 style="font-size:12px;color:var(--text2);margin-bottom:8px">Need_FTE − Available_FTE Preview</h4>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">burden multiplier ${needPreview.burdenMultiplier.toFixed(2)} | ใช้ benchmark reference จาก backend</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">${denominatorMeta.label} | ฐาน ${denominatorMeta.population.toLocaleString()}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:8px">Service-level denominator matrix แสดงเต็มด้านล่าง พร้อม source strategy / status / observed reference</div>
      ${needRows}
    </div>
  `;
  if (serviceMatrixCard) {
    serviceMatrixCard.innerHTML = buildServiceMatrixPanelHtml(needPreview, workloadReferences);
  }
  renderPpCapacityPanel(split.querySelector('#ppCapacityPanel'));
}

// ========== Step 4: Gap Analysis ==========
async function renderStep4() {
  await ensureHrUnitWorkforceSummary(selectedHospital);
  if (!window._needFtePreview) {
    window._needFtePreview = await fetchNeedFtePreview(selectedHospital, true);
  }
  if (window._wci === undefined || window._wci === null) {
    const professionWci = computeMultiProfessionWCI(selectedHospital, window._needFtePreview);
    window._wci = professionWci.wci;
    window._professionMix = professionWci.mix;
  }
  renderMockGuide(4);
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
      <div class="matrix-cell matrix-header">Outcome ดี (Composite)</div>
      <div class="matrix-cell matrix-header">Outcome แย่ (Composite)</div>
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
  renderMockGuide(5);
  const grid = document.getElementById('perfMetrics');
  grid.innerHTML = '';
  const mockProfile = isMockHospital() ? getMockProfileConfig() : null;
  const clinicalBaseline = isMockHospital() ? getMockClinicalBaselineSummary(mockProfile) : null;

  const split = document.createElement('div');
  split.className = 'split-stage-card';
  split.innerHTML = `
    <section class="domain-panel domain-panel-pp">
      <div class="domain-panel-header">
        <span class="domain-kicker">ส่งเสริมป้องกัน</span>
        <h3>PP Outcome Validation</h3>
        <p>${isMockHospital()
          ? (mockProfile?.loaded
            ? `ตรวจ outcome ที่ preload จากอำเภอ${mockProfile?.amphurName || '-'} แล้วเปิดให้แก้ไขเองก่อนยืนยันผล | PP phase 1 = ${getPhase1IndicatorCount()} indicators`
            : `เลือกและ preload โปรไฟล์อำเภอใน Step 0 ก่อน เพื่อให้ฝั่ง PP outcome มี baseline ให้แก้ไข | PP phase 1 = ${getPhase1IndicatorCount()} indicators`)
          : `ตรวจว่าผลลัพธ์ฝั่งปฐมภูมิและสาธารณสุขระดับจังหวัด/อำเภอสอดคล้องกับ burden หรือไม่ | PP phase 1 = ${getPhase1IndicatorCount()} indicators`}</p>
      </div>
      <div id="ppOutcomePanel" class="domain-panel-body">
        <div class="card split-inner-card"><p>กำลังโหลดข้อมูล PP outcome...</p></div>
      </div>
    </section>
    <section class="domain-panel domain-panel-clinical">
      <div class="domain-panel-header">
        <span class="domain-kicker">รักษา-ฟื้นฟู</span>
        <h3>A-H / Hospital Outcome Validation</h3>
        <p>ใช้ผลลัพธ์ฝั่งรักษาเพื่อยืนยันว่า gap ที่พบมาจากกำลังคนหรือมาจาก process</p>
      </div>
      <div id="clinicalOutcomePanel" class="domain-panel-body">
        <div class="domain-card-grid" id="clinicalOutcomeGrid"></div>
      </div>
    </section>
  `;
  grid.appendChild(split);
  const clinicalOutcomeGrid = split.querySelector('#clinicalOutcomeGrid');

  if (isMockHospital()) {
    const editor = document.createElement('div');
    editor.className = 'metric-card editor-card';
    editor.innerHTML = buildMockPanel(
      'Manual Outcome Input',
      clinicalBaseline?.label || 'baseline outcome จาก district profile',
      OUTCOME_FIELDS.map((field) => ({
        code: field.code,
        label: `${field.code} • ${field.name}`,
        unit: field.unit,
        baselineScope:'baseline_global_outcome',
      })),
      buildResetBaselineButtonHtml('global', 'baseline_global_outcome', 'reset clinical outcome'),
      [
        {
          source: clinicalBaseline?.outcomeSource || 'district_baseline',
          label: (clinicalBaseline?.outcomeSource || 'district_baseline') === 'template_override' ? 'template override' : 'district baseline',
        },
      ],
    );
    clinicalOutcomeGrid.appendChild(editor);
  }
  
  let outcomeGood = true;
  let measuredCount = 0;
  OUTCOME_FIELDS.forEach(item => {
    const rawVal = getIndicatorValue(selectedHospital, item.code);
    const val = rawVal === null ? null : parseFloat(rawVal);
    if (val !== null && !Number.isNaN(val)) measuredCount++;
    const metric = getMetricStatus(item, val);
    if (metric.isBad) outcomeGood = false;
    
    const card = document.createElement('div');
    card.className = `metric-card ${val !== null && !Number.isNaN(val) ? metric.status : ''}`;
    card.innerHTML = `
      <div class="label">${item.code}: ${item.name}</div>
      <div class="value" style="color:${metric.status==='bad'?'var(--red)':metric.status==='warn'?'var(--yellow)':'var(--green)'}">${formatMetricValue(val, item.unit)}</div>
      <div class="unit">${item.unit} | ${metric.unitHint}</div>
    `;
    clinicalOutcomeGrid.appendChild(card);
  });

  if (measuredCount === 0) outcomeGood = false;
  window._outcomeGood = outcomeGood;
  window._outcomeDataCount = measuredCount;
  
  // Cross-validate with Gap
  const gapLevel = window._gapLevel || 'green';
  const verdict = document.getElementById('perfVerdict');
  
  if (measuredCount === 0) {
    verdict.className = 'step-verdict yellow';
    verdict.innerHTML = '⚠ <strong>ข้อมูล Outcome ไม่พอ:</strong> ยังประเมินขั้นยืนยันเชิงผลลัพธ์ไม่ได้ครบ ควรนำเข้า A-H เพิ่มเติมก่อนตัดสินใจเชิงนโยบาย';
  } else if (gapLevel === 'red' && !outcomeGood) {
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
  renderPpOutcomePanel(split.querySelector('#ppOutcomePanel'));
}

// ========== Step 6: Service Plan ==========
async function renderStep6() {
  await ensureHrUnitWorkforceSummary(selectedHospital);
  renderMockGuide(6);
  const container = document.getElementById('spIssues');
  container.innerHTML = '<h3 style="margin-bottom:16px">ตัวชี้วัด Service Plan ที่ต้องเฝ้าระวัง</h3>';
  const gapLevel = window._gapLevel || 'green';

  if (isMockHospital()) {
    container.innerHTML += `
      <div class="card">
        ${buildMockPanel(
          'Manual Service Plan Input',
          (getMockClinicalBaselineSummary(getMockProfileConfig()).label || 'baseline service plan จาก district profile'),
          SERVICE_PLAN_FIELDS.map((field) => ({ ...field, baselineScope:'baseline_global_service_plan' })),
          buildResetBaselineButtonHtml('global', 'baseline_global_service_plan', 'reset service plan'),
          [
            {
              source: getMockClinicalBaselineSummary(getMockProfileConfig()).servicePlanSource || 'district_baseline',
              label: (getMockClinicalBaselineSummary(getMockProfileConfig()).servicePlanSource || 'district_baseline') === 'template_override' ? 'template override' : 'district baseline',
            },
          ],
        )}
      </div>
    `;
  }
  
  let issueCount = 0;
  Object.entries(SPECIALTY_MAP).forEach(([code, spec]) => {
    const val = getIndicatorValue(selectedHospital, code);
    if (val === null) return;
    
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return;
    
    let isIssue = false;
    if (spec.dir === 'low' && numVal > spec.threshold) isIssue = true;
    if (spec.dir === 'high' && numVal < spec.threshold) isIssue = true;
    const supportSummary = getProfessionSupportRecommendations(code, gapLevel)
      .map((profession) => `${profession.label} ${profession.current}`)
      .join(' | ');
    const div = document.createElement('div');
    div.className = 'sp-issue';
    div.innerHTML = `
      <div class="issue-head">
        <span class="issue-name">${code}: ${spec.name}</span>
        <span class="issue-val ${isIssue?'bad':'warn'}">${formatMetricValue(numVal, spec.unit)}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">
        เกณฑ์: ${formatThreshold(spec)} | 
        สถานะ: ${isIssue?'<span style="color:var(--red)">ไม่ผ่าน</span>':'<span style="color:var(--green)">ผ่าน</span>'}
      </div>
      ${supportSummary ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Support professions: ${supportSummary}</div>` : ''}
      ${isIssue ? `<div>
        <span class="specialty-tag">แพทย์: ${spec.doc}</span>
        <span class="specialty-tag">พยาบาล: ${spec.nurse}</span>
        <span class="specialty-tag">${gapLevel === 'green' ? 'โฟกัส Process เป็นลำดับแรก' : 'พิจารณาเพิ่มอัตรากำลังร่วมด้วย'}</span>
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

async function renderPpCapacityPanel(container) {
  if (!container) return;
  const provinceCode = getSelectedProvinceCode();
  if (!provinceCode) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่ผูกจังหวัดอ้างอิง</h4><p>จุดนี้จะแสดงกำลังคนฝั่งส่งเสริมป้องกันเมื่อทราบจังหวัดของโรงพยาบาลหรือ mock scenario</p></div>';
    return;
  }

  if (isMockHospital() && !getMockProfileConfig().loaded) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่ได้ preload โปรไฟล์อำเภอ</h4><p>กลับไป Step 0 เพื่อเลือกจังหวัดและอำเภอ แล้วกด "โหลดโปรไฟล์อำเภอ" ก่อน ระบบจึงจะ prefill PP capacity ฝั่ง mock ได้</p></div>';
    return;
  }

  container.innerHTML = '<div class="card split-inner-card"><p>กำลังโหลดข้อมูล PP capacity...</p></div>';
  const [provinceSummary, unitCapacitySummary, hospitalScope, hospitalSummary, mockSummary] = await Promise.all([
    fetchPpProvinceSummary(provinceCode),
    isMockHospital() ? Promise.resolve(null) : fetchPpUnitCapacitySummary(provinceCode, selectedHospital),
    isMockHospital() ? Promise.resolve(null) : fetchHospitalScope(selectedHospital),
    isMockHospital() ? Promise.resolve(null) : fetchPpHospitalSummary(selectedHospital),
    isMockHospital() ? buildMockPpSummary() : Promise.resolve(null),
  ]);
  const capacitySource = isMockHospital() ? mockSummary : hospitalSummary;
  if (!capacitySource || (!provinceSummary && isMockHospital())) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่พบข้อมูล PP</h4><p>API local ยังไม่ตอบ PP province summary สำหรับจังหวัดนี้</p></div>';
    return;
  }
  const populationRaw = isMockHospital()
    ? parseFloat(String(capacitySource?.scope_population_total ?? HOSPITALS[selectedHospital]?.population?.['ประชากรรวม'] ?? 0).replace(/,/g, '')) || 0
    : parseFloat(capacitySource?.scope_population_total || 0) || 0;
  const population = Math.max(populationRaw, 1);
  const scopePopulationSource = capacitySource?.scope_population_source || '';
  const scopePopulationReferenceYear = capacitySource?.scope_population_reference_year || hospitalScope?.pp_population_reference_year || null;
  const populationSourceBadge = formatPopulationSourceBadge(scopePopulationSource, scopePopulationReferenceYear);
  const hasVerifiedPpPopulation = typeof scopePopulationSource === 'string'
    && scopePopulationSource.startsWith('verified_amphur_population');
  const canShowPpRatio = isMockHospital() || hasVerifiedPpPopulation;
  const professionTotals = {};
  (capacitySource.capacity || []).forEach((item) => {
    if (!professionTotals[item.profession_code]) {
      professionTotals[item.profession_code] = {
        profession_name_th: item.profession_name_th,
        fte_total: 0,
        headcount_total: 0,
      };
    }
    professionTotals[item.profession_code].fte_total += parseFloat(item.fte_total || 0);
    professionTotals[item.profession_code].headcount_total += parseFloat(item.headcount_total || 0);
  });
  const ppDictionary = capacitySource.dictionary || {};
  const professionCards = Object.entries(ppDictionary)
    .sort((a, b) => (a[1].display_order || 999) - (b[1].display_order || 999))
    .map(([code, definition]) => ({ code, ...definition }));
  const professionCardSet = professionCards.length ? professionCards : [
    { code:'FAM_MD', label_th:'แพทย์เวชศาสตร์ครอบครัว', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
    { code:'RN', label_th:'พยาบาลวิชาชีพ', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
    { code:'PH_ACAD', label_th:'นักวิชาการสาธารณสุข', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
    { code:'PH_OFFICER', label_th:'นักสาธารณสุข / เจ้าพนักงานสาธารณสุข', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
    { code:'PSY', label_th:'นักจิตวิทยา', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
    { code:'CPSY', label_th:'นักจิตวิทยาคลินิก', note_th:'นิยามกลางยังไม่ถูกโหลด', rate_per:10000, rate_unit_th:'คน/หมื่นปชก.' },
  ];
  const professionGrid = professionCardSet
    .map((profession) => {
      const item = professionTotals[profession.code] || { fte_total: 0, headcount_total: 0 };
      const headcount = Math.max(0, Math.round(parseFloat(item.headcount_total || 0)));
      const ratePer = profession.rate_per || 10000;
      const ratio = ((headcount / population) * ratePer).toFixed(1);
      return `
        <div class="metric-card">
          <div class="label">${profession.label_th}<span style="display:block;font-size:10px;color:var(--text2);font-weight:normal;margin-top:2px;">${profession.note_th}</span></div>
          <div class="value" style="color:var(--green)">${headcount.toLocaleString()}</div>
          <div class="unit">${canShowPpRatio ? `${ratio} ${profession.rate_unit_th || 'คน/หมื่นปชก.'}` : `Scope: อำเภอ${hospitalScope?.pp_scope_name || capacitySource?.amphur_name || '-'}`}</div>
          <div class="metric-card-actions">${buildDictionaryButtonHtml('pp', profession.code)}</div>
        </div>
      `;
    })
    .join('');
  const topCapacity = (capacitySource.capacity || []).slice(0, 4);
  const topFunctions = topCapacity
    .map((item) => `<div class="mini-row"><span>${item.function_name_th}</span><strong>${item.profession_name_th} ${Math.round(parseFloat(item.headcount_total || 0)).toLocaleString()} คน</strong></div>`)
    .join('');
  const topRecommendations = (capacitySource?.recommendations || [])
    .slice(0, 4)
    .map((item) => `<span class="rec-tag">${item.profession_name_th} ${item.urgency_score}</span>`)
    .join('');
  const totalCapacityHeadcount = (capacitySource.capacity || []).reduce(
    (sum, item) => sum + parseFloat(item.headcount_total || 0),
    0,
  );
  const ppAuditTrail = !isMockHospital() ? capacitySource?.audit_trail : null;
  const ppAuditCard = ppAuditTrail ? buildAuditPanelHtml(
    'PP DB Audit Trail',
    'pp',
    professionCardSet.map((profession) => ({ metricCode: profession.code, item: ppAuditTrail[profession.code] })).filter((entry) => entry.item),
  ) : '';

  container.innerHTML = `
    ${isMockHospital() ? buildMockPpCapacityEditor(capacitySource) : ''}
    <div class="domain-card-grid">
      ${professionGrid}
    </div>
    <div class="card split-inner-card">
      <h4>${isMockHospital() ? `บริบท PP mock | อำเภอ${capacitySource?.amphur_name || '-'}` : `บริบท PP อำเภอ${capacitySource?.amphur_name || hospitalScope?.pp_scope_name || '-'}`}</h4>
      <div class="source-badge source-badge-pp">${populationSourceBadge}</div>
      <div class="split-inner-columns">
        <div>
          <div class="mini-row"><span>${isMockHospital() ? 'PP Capacity mock รวม' : 'PP Capacity ของ รพ.'}</span><strong>${totalCapacityHeadcount.toLocaleString(undefined, { maximumFractionDigits: 2 })} คน</strong></div>
          <div class="mini-row"><span>${isMockHospital() ? 'Outcome baseline พร้อมใช้' : 'Indicators ในอำเภอรับผิดชอบ'}</span><strong>${capacitySource.data_status?.indicator_count || 0}</strong></div>
          <div class="mini-row"><span>Population scope</span><strong>อำเภอ${isMockHospital() ? (capacitySource?.amphur_name || '-') : (hospitalScope?.pp_scope_name || capacitySource?.amphur_name || '-')}</strong></div>
        </div>
        <div>
          <div class="mini-row"><span>${isMockHospital() ? 'Outcome facts ใน mock scope' : 'Outcome Facts ในอำเภอ'}</span><strong>${capacitySource.data_status?.district_fact_count || capacitySource.data_status?.fact_count || 0}</strong></div>
          <div class="mini-row"><span>${isMockHospital() ? 'Off-target indicators' : 'Off-target Indicators'}</span><strong>${capacitySource.data_status?.off_target_districts || capacitySource.data_status?.off_target_indicator_count || 0}</strong></div>
        </div>
      </div>
    </div>
    <div class="card split-inner-card">
      <h4>Top PP Functions (นับตามคน)</h4>
      ${topFunctions || '<p class="mini-empty">ยังไม่มี capacity function summary</p>'}
      ${topRecommendations ? `<div class="domain-inline-note"><strong>Profession pressure</strong> ${topRecommendations}</div>` : ''}
    </div>
    ${ppAuditCard}
  `;
}

async function renderPpOutcomePanel(container) {
  if (!container) return;
  const provinceCode = getSelectedProvinceCode();
  if (!provinceCode) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่ผูกจังหวัดอ้างอิง</h4><p>จุดนี้จะแสดง outcome ส่งเสริมป้องกันเมื่อทราบจังหวัดของโรงพยาบาลหรือ mock scenario</p></div>';
    return;
  }

  if (isMockHospital() && !getMockProfileConfig().loaded) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่ได้ preload โปรไฟล์อำเภอ</h4><p>Step 5 ของ mock จะเปิดให้แก้ outcome ได้หลังจาก preload โปรไฟล์อำเภอจาก Step 0 เท่านั้น</p></div>';
    return;
  }

  container.innerHTML = '<div class="card split-inner-card"><p>กำลังโหลดข้อมูล PP outcome...</p></div>';
  const [summary, districts, hospitalSummary, mockSummary] = await Promise.all([
    fetchPpProvinceSummary(provinceCode),
    fetchPpDistrictSummary(provinceCode),
    isMockHospital() ? Promise.resolve(null) : fetchPpHospitalSummary(selectedHospital),
    isMockHospital() ? buildMockPpSummary() : Promise.resolve(null),
  ]);
  const outcomeSource = isMockHospital() ? mockSummary : hospitalSummary;
  if (!summary) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่พบข้อมูล PP outcome</h4><p>API local ยังไม่ตอบ PP province summary สำหรับจังหวัดนี้</p></div>';
    return;
  }
  if (isMockHospital() && !outcomeSource) {
    container.innerHTML = '<div class="card split-inner-card"><h4>ยังไม่พบข้อมูล PP outcome mock</h4><p>โปรดลอง preload โปรไฟล์อำเภอใหม่อีกครั้ง</p></div>';
    return;
  }

  const outcomeCards = buildPpOutcomeCardsHtml(
    outcomeSource?.outcomes || [],
    'district',
  );
  const topDistricts = isMockHospital()
    ? (outcomeSource?.outcomes || [])
        .filter((item) => item.is_off_target)
        .slice(0, 4)
        .map((item) => `<div class="mini-row"><span>${item.indicator_name_th}</span><strong>${formatMetricValue(item.value_num, item.unit || '')}</strong></div>`)
        .join('')
    : (outcomeSource?.outcomes || [])
        .filter((item) => item.is_off_target)
        .slice(0, 4)
        .map((item) => `<div class="mini-row"><span>${item.indicator_name_th}</span><strong>${formatMetricValue(item.value_num, item.unit || '')}</strong></div>`)
        .join('');

  container.innerHTML = `
    ${isMockHospital() ? buildMockPpOutcomeEditor(outcomeSource) : ''}
    <div class="domain-card-grid">
      ${outcomeCards}
    </div>
    <div class="split-inner-columns">
      <div class="card split-inner-card">
        <h4>${isMockHospital() ? 'ตัวชี้วัดที่ต้องโฟกัส' : 'ตัวชี้วัดที่ต้องโฟกัส'}</h4>
        ${topDistricts || `<p class="mini-empty">${isMockHospital() ? 'ยังไม่พบตัวชี้วัด off-target ใน mock scope' : 'ยังไม่พบตัวชี้วัด off-target ในอำเภอนี้'}</p>`}
      </div>
      <div class="card split-inner-card">
        <h4>${isMockHospital() ? 'คำแนะนำวิชาชีพ' : 'วิชาชีพที่ระบบกำลังชี้เป้า'}</h4>
        ${(outcomeSource?.recommendations || []).slice(0, 5).map((item) => `<div class="mini-row"><span>${getPpProfessionLabel(outcomeSource, item.profession_code, item.profession_name_th)}</span><strong>score ${item.urgency_score}</strong></div>`).join('') || '<p class="mini-empty">ยังไม่มี recommendation ที่พร้อมใช้งาน</p>'}
      </div>
    </div>
  `;
}

async function renderPpRecommendationCard(container) {
  if (!container) return;
  const provinceCode = getSelectedProvinceCode();
  if (!provinceCode) {
    container.innerHTML = '';
    return;
  }

  if (isMockHospital() && !getMockProfileConfig().loaded) {
    container.innerHTML = '<div class="card"><h3>ส่งเสริมป้องกัน (PP)</h3><p>เลือกจังหวัด/อำเภอและ preload โปรไฟล์ใน Step 0 ก่อน จึงจะสรุป recommendation ฝั่ง PP ของ mock ได้</p></div>';
    return;
  }

  container.innerHTML = '<div class="card"><h3>ส่งเสริมป้องกัน (PP)</h3><p>กำลังโหลดข้อมูลระดับจังหวัด...</p></div>';
  const [summary, districtRows, hospitalSummary, mockSummary] = await Promise.all([
    fetchPpProvinceSummary(provinceCode),
    fetchPpDistrictSummary(provinceCode),
    isMockHospital() ? Promise.resolve(null) : fetchPpHospitalSummary(selectedHospital),
    isMockHospital() ? buildMockPpSummary() : Promise.resolve(null),
  ]);
  const ppSource = isMockHospital() ? mockSummary : hospitalSummary;
  if (!summary) {
    container.innerHTML = '<div class="card"><h3>ส่งเสริมป้องกัน (PP)</h3><p>ยังไม่พบข้อมูล PP summary จาก API local</p></div>';
    return;
  }
  if (isMockHospital() && !ppSource) {
    container.innerHTML = '<div class="card"><h3>ส่งเสริมป้องกัน (PP)</h3><p>ยังไม่พบ mock PP summary หลัง preload โปรไฟล์</p></div>';
    return;
  }

  const contextProfile = await getRecommendationContextProfile(selectedHospital);
  const archetype = classifyDistrictArchetype(contextProfile, window._needFtePreview);
  const ppBottlenecks = buildPpBottleneckSummary(ppSource, archetype);
  const ppPortfolio = buildPpInterventionPortfolio(ppSource, archetype);
  const ppPopulationBadge = formatPopulationSourceBadge(ppSource?.scope_population_source, ppSource?.scope_population_reference_year);
  const indicatorDrivenCards = buildPpRecommendationCardsHtml(ppSource, false);
  const topDistricts = isMockHospital()
    ? `
        <div class="rec-card urgent pp-district-card">
          <h4>อำเภอ${ppSource?.amphur_name || '-'}</h4>
          <p>off-target ${ppSource?.data_status?.off_target_indicator_count || 0} indicators | mock scope ที่ผู้ใช้แก้ไขต่อได้เอง</p>
          ${(ppSource?.recommendations || []).slice(0, 3).map((item) => `<span class="rec-tag">${getPpProfessionLabel(ppSource, item.profession_code, item.profession_name_th)} ${item.urgency_score}</span>`).join('') || '<p>ยังไม่มี profession recommendation</p>'}
        </div>
      `
    : `
        <div class="rec-card urgent pp-district-card">
          <h4>อำเภอ${ppSource?.amphur_name || '-'}</h4>
          <p>off-target ${ppSource?.data_status?.off_target_indicator_count || 0} indicators</p>
          ${(ppSource?.recommendations || []).slice(0, 3).map((item) => `<span class="rec-tag">${getPpProfessionLabel(ppSource, item.profession_code, item.profession_name_th)} ${item.urgency_score}</span>`).join('') || '<p>ยังไม่มี profession recommendation</p>'}
        </div>
      `;

  container.innerHTML = `
    <div class="domain-card-grid">
      <div class="metric-card">
        <div class="label">${isMockHospital() ? 'PP Scope' : 'PP Scope'}</div>
        <div class="value" style="color:var(--green)">${ppSource?.amphur_name || '-'}</div>
        <div class="unit">${isMockHospital() ? `จังหวัด ${ppSource?.province_name_th || summary.province_name_th}` : 'อำเภอรับผิดชอบด้านส่งเสริมป้องกัน'}</div>
        ${ppPopulationBadge ? `<div class="source-badge source-badge-pp" style="margin-top:10px">${ppPopulationBadge}</div>` : ''}
      </div>
      <div class="metric-card">
        <div class="label">${isMockHospital() ? 'Indicators พร้อมใช้' : 'Indicators ในอำเภอ'}</div>
        <div class="value" style="color:var(--accent2)">${ppSource?.data_status?.indicator_count || 0}</div>
        <div class="unit">ปี ${ppSource?.year_be || '-'} | PP phase 1 = ${getPhase1IndicatorCount()} indicators</div>
      </div>
      <div class="metric-card">
        <div class="label">${isMockHospital() ? 'Off-target Indicators' : 'Off-target Indicators'}</div>
        <div class="value" style="color:var(--yellow)">${ppSource?.data_status?.off_target_indicator_count || 0}</div>
        <div class="unit">${isMockHospital() ? 'ตัวชี้วัดใน mock scope ที่ยังหลุดเป้า' : 'ตัวชี้วัดที่ต้องเร่งแก้'}</div>
      </div>
      <div class="metric-card">
        <div class="label">คำแนะนำวิชาชีพ</div>
        <div class="value" style="color:var(--accent2)">${(ppSource?.recommendations || []).length}</div>
        <div class="unit">${isMockHospital() ? 'รายการที่คำนวณใหม่จาก mock inputs' : 'รายการที่เชื่อมกับตัวชี้วัด'}</div>
      </div>
    </div>
    <div class="card split-inner-card">
      <h4>FPHM Overlay Summary</h4>
      ${buildArchetypeCardHtml(archetype, contextProfile)}
      ${buildBottleneckCardHtml('PP Bottleneck Classification', ppBottlenecks)}
      ${buildInterventionPortfolioHtml('PP Intervention Portfolio', ppPortfolio)}
    </div>
    <div class="card split-inner-card">
      <h4>Indicator-Driven Recommendation</h4>
      ${indicatorDrivenCards}
    </div>
    <div class="card split-inner-card">
      <h4>${isMockHospital() ? 'Mock Scope ที่กำลังใช้อยู่' : 'อำเภอที่ควรโฟกัสก่อน'}</h4>
      ${topDistricts || '<p class="mini-empty">ยังไม่พบ district summary ที่มี off-target</p>'}
    </div>
  `;
}

// ========== Step 7: Recommendations ==========
async function renderStep7() {
  const hrUnitSummary = await ensureHrUnitWorkforceSummary(selectedHospital);
  if (window._wci === undefined || window._wci === null) {
    const professionWci = computeMultiProfessionWCI(selectedHospital);
    window._wci = professionWci.wci;
    window._professionMix = professionWci.mix;
  }
  window._needFtePreview = await fetchNeedFtePreview(selectedHospital, true, !isMockHospital(), 'step7');
  const runHistory = isMockHospital() ? [] : await fetchAnalysisRunHistory(selectedHospital, true);
  renderMockGuide(7);
  const container = document.getElementById('recommendations');
  const runHistoryCard = document.getElementById('analysisRunHistoryCard');
  const contextProfile = await getRecommendationContextProfile(selectedHospital);
  const archetype = classifyDistrictArchetype(contextProfile, window._needFtePreview);
  container.innerHTML = `
    <div class="split-stage-card split-stage-recommendation">
      <section class="domain-panel domain-panel-pp">
        <div class="domain-panel-header">
          <span class="domain-kicker">ส่งเสริมป้องกัน</span>
          <h3>PP Recommendation</h3>
          <p>ข้อเสนอจาก outcome ระดับอำเภอและ workforce mapping ฝั่งปฐมภูมิ/สาธารณสุข | PP phase 1 = ${getPhase1IndicatorCount()} indicators</p>
        </div>
        <div id="ppSummaryCard" class="domain-panel-body">
          <div class="card split-inner-card"><p>กำลังโหลดคำแนะนำ PP...</p></div>
        </div>
      </section>
      <section class="domain-panel domain-panel-clinical">
        <div class="domain-panel-header">
          <span class="domain-kicker">รักษา-ฟื้นฟู</span>
          <h3>Hospital / Rehab Recommendation</h3>
          <p>ข้อเสนอจาก Gap, A-H outcome และตัวชี้วัด Service Plan ของโรงพยาบาล</p>
        </div>
        <div id="clinicalRecommendationPanel" class="domain-panel-body"></div>
      </section>
    </div>
  `;
  
  const gapLevel = window._gapLevel || 'green';
  const outcomeGood = window._outcomeGood !== false;
  const outcomeDataCount = window._outcomeDataCount || 0;
  const dqPass = window._dqPass !== false;
  const issueCount = window._issueCount || 0;
  const clinicalContainer = document.getElementById('clinicalRecommendationPanel');
  const h = HOSPITALS[selectedHospital];
  const denominatorMeta = getClinicalDenominatorMeta(window._needFtePreview);
  const pop = denominatorMeta.population || h.population?.['ประชากรรวม'] || 0;
  const docs = hrUnitSummary?.counts?.doctor_total ?? getProfessionCount('doctor_total');
  const nurses = hrUnitSummary?.counts?.nurse_total ?? getProfessionCount('nurse_total');
  const pt = getProfessionCount('physical_therapist_total');
  const psych = getProfessionCount('psychologist_total');
  const cpsych = getProfessionCount('clinical_psychologist_total');
  const clinicalBottlenecks = buildClinicalBottleneckSummary({
    dqPass,
    outcomeDataCount,
    gapLevel,
    outcomeGood,
    issueCount,
    archetype,
    needPreview: window._needFtePreview,
  });
  const clinicalPortfolio = buildClinicalInterventionPortfolio({
    archetype,
    bottlenecks: clinicalBottlenecks,
    needPreview: window._needFtePreview,
    gapLevel,
    issueCount,
  });
  const professionMixTags = Object.entries(window._professionMix || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, ratio]) => `<span class="rec-tag">${getProfessionLabel(code)} ${Math.round(ratio)}%</span>`)
    .join('');
  const needFteTags = (window._needFtePreview?.rows || [])
    .filter((item) => item.gapFte > 0.05)
    .slice(0, 4)
    .map((item) => `<span class="rec-tag">${item.label} Need gap ${item.gapFte.toFixed(1)} FTE → +${item.suggestedAdd}</span>`)
    .join('');
  
  // Main recommendation
  let mainType, mainTitle, mainDesc;
  if (!dqPass) {
    mainType = 'process'; mainTitle = '⚠ ปรับคุณภาพข้อมูลก่อนอนุมัติอัตรากำลัง';
    mainDesc = `${selectedHospital} มีตัวชี้วัด G01-G04 บางรายการไม่ผ่านเกณฑ์ จึงควรถือผลแนะนำนี้เป็น provisional และเร่งปรับ ICD/Data quality ควบคู่ไปก่อน`;
  } else if (outcomeDataCount < 3) {
    mainType = 'process'; mainTitle = '⚠ Outcome Data ยังไม่เพียงพอ';
    mainDesc = `${selectedHospital} มีข้อมูล Outcome ที่ใช้ยืนยันน้อยกว่า 3 ตัวชี้วัด จึงควรเติมข้อมูล A-H ก่อนสรุปแผนกำลังคนแบบถาวร`;
  } else if (gapLevel === 'red' && !outcomeGood) {
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
  
  if (activeRunReplay) {
    clinicalContainer.innerHTML += buildReplayProvenanceHtml();
  }

  clinicalContainer.innerHTML += buildArchetypeCardHtml(archetype, contextProfile);
  clinicalContainer.innerHTML += `<div class="rec-card ${mainType}"><h4>${mainTitle}</h4><p>${mainDesc}</p>
    <div class="rec-tags"><span class="rec-tag">ฐานคำนวณ ${pop.toLocaleString()}</span><span class="rec-tag">${denominatorMeta.label}</span><span class="rec-tag">แพทย์ ${docs}</span><span class="rec-tag">พยาบาล ${nurses}</span><span class="rec-tag">กายภาพ ${pt}</span><span class="rec-tag">นักจิตวิทยา ${psych}</span><span class="rec-tag">นักจิตวิทยาคลินิก ${cpsych}</span>${professionMixTags}${needFteTags}</div></div>`;
  
  clinicalContainer.innerHTML += buildBottleneckCardHtml('Clinical Bottleneck Classification', clinicalBottlenecks);
  clinicalContainer.innerHTML += buildInterventionPortfolioHtml('Clinical Intervention Portfolio', clinicalPortfolio);

  // Specialty recommendations
  if (issueCount > 0) {
    clinicalContainer.innerHTML += '<div class="card"><h3>ข้อเสนอเฉพาะทาง (จาก Service Plan)</h3></div>';
    Object.entries(SPECIALTY_MAP).forEach(([code, spec]) => {
      const val = getIndicatorValue(selectedHospital, code);
      if (val === null) return;
      const numVal = parseFloat(val);
      if (isNaN(numVal)) return;
      let isIssue = (spec.dir === 'low' && numVal > spec.threshold) || (spec.dir === 'high' && numVal < spec.threshold);
      if (!isIssue) return;
      
      const demand = computeSpecialtyDemand(spec, numVal, gapLevel);
      const docTag = demand.addDoc > 0 ? `${spec.doc} (+${demand.addDoc})` : `${spec.doc} (คงอัตรา)`;
      const nurseTag = demand.addNurse > 0 ? `${spec.nurse} (+${demand.addNurse})` : `${spec.nurse} (คงอัตรา)`;
      const modeTag = (demand.addDoc > 0 || demand.addNurse > 0) ? 'แนวทาง: เพิ่มคน + ปรับ process' : 'แนวทาง: ปรับ process ก่อนเพิ่มคน';
      const supportTags = getProfessionSupportRecommendations(code, gapLevel)
        .map((profession) => `<span class="rec-tag">${profession.label} ${profession.add > 0 ? `(ปัจจุบัน ${profession.current} -> +${
          profession.add
        })` : `(ปัจจุบัน ${profession.current})`}</span>`)
        .join('');

      clinicalContainer.innerHTML += `<div class="rec-card urgent"><h4>${code}: ${spec.name} = ${formatMetricValue(numVal, spec.unit)}</h4>
        <p>เกินเกณฑ์ (${formatThreshold(spec)}) → ต้องการ:</p>
        <div class="rec-tags"><span class="rec-tag">${docTag}</span><span class="rec-tag">${nurseTag}</span><span class="rec-tag">${modeTag}</span>${supportTags}</div>
        <p style="margin-top:8px">ข้อเสนอเชิงกระบวนการ: ${spec.process}</p></div>`;
    });
  }
  
  // Data quality note
  clinicalContainer.innerHTML += `<div class="rec-card"><h4>ข้อควรระวัง</h4><p>• HNI ใช้ Mock Data สำหรับ Chronic/Mental → ค่าเป็นเพียงตัวอย่าง<br>• ข้อมูล CMI เป็นปีงบประมาณ 2569 จาก CMI Web เขตสุขภาพที่ 1<br>• ข้อมูลเฉพาะทางแพทย์ยังไม่มี → ต้องนำเข้าจากแพทยสภา<br>• จำนวนที่แนะนำเป็น Scenario ระดับ Headcount (ไม่ใช่ FTE) ควรตรวจ workload OPD/IPD/ER ก่อนอนุมัติจริง</p></div>`;

  if (isMockHospital()) {
    saveMockRunSnapshot();
  }
  renderPpRecommendationCard(document.getElementById('ppSummaryCard'));
  if (runHistoryCard) {
    runHistoryCard.style.display = isMockHospital() ? 'none' : '';
    if (!isMockHospital()) {
      runHistoryCard.innerHTML = buildRunHistoryCardHtml(runHistory);
    }
  }
}

// ========== Event Listeners ==========
document.getElementById('sliderElderly').addEventListener('input', handleHniSliderInput);
document.getElementById('sliderChronic').addEventListener('input', handleHniSliderInput);
document.getElementById('sliderMental').addEventListener('input', handleHniSliderInput);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDictionaryModal();
  }
});

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const dictionaryButton = target.closest('[data-dictionary-domain]');
  if (dictionaryButton instanceof HTMLElement) {
    event.preventDefault();
    openDictionaryModal(dictionaryButton.dataset.dictionaryDomain, dictionaryButton.dataset.dictionaryCode);
    return;
  }
  const mockActionButton = target.closest('[data-mock-action]');
  if (mockActionButton instanceof HTMLElement) {
    event.preventDefault();
    if (mockActionButton.dataset.mockAction === 'load-pp-profile') {
      await preloadMockPpProfile();
      return;
    }
    if (mockActionButton.dataset.mockAction === 'reset-baseline') {
      await resetMockScopeFromBaseline(
        mockActionButton.dataset.targetScope || 'global',
        mockActionButton.dataset.baselineScope || '',
      );
      return;
    }
  }
  const runActionButton = target.closest('[data-run-action]');
  if (runActionButton instanceof HTMLElement) {
    event.preventDefault();
    const action = runActionButton.dataset.runAction;
    if (action === 'clear-replay') {
      clearRunReplay();
      await renderStep3();
      await renderStep4();
      await renderStep7();
      return;
    }
    if (action === 'replay') {
      const runId = runActionButton.dataset.runId;
      const runs = analysisRunHistoryCache[selectedHospital] || [];
      const run = runs.find((item) => item.run_id === runId);
      if (!run) {
        updateMockStatus('warn', 'ไม่พบ run history ที่เลือก');
        return;
      }
      activateRunReplay(run);
      await renderStep3();
      await renderStep4();
      await renderStep7();
      return;
    }
  }
  const action = target.dataset.auditAction;
  const auditKey = target.dataset.auditKey;
  if (!action || !auditKey) return;
  event.preventDefault();
  if (action === 'copy-sql') {
    copyAuditSql(auditKey);
    return;
  }
  if (action === 'export-rows') {
    exportAuditSourceRows(auditKey);
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.classList?.contains('mock-profile-select')) {
    if (!isMockHospital() || !mockSession.scenarioId) return;
    const scope = target.dataset.scope || 'pp_profile';
    const code = target.dataset.code;
    if (code === 'province_code') {
      const provinceCode = target.value || '';
      queueMockSave([
        { indicator_code:'province_code', scope, value_text: provinceCode },
        { indicator_code:'province_name', scope, value_text: getProvinceNameByCode(provinceCode) || '' },
        { indicator_code:'amphur_code', scope, value_text: '' },
        { indicator_code:'amphur_name', scope, value_text: '' },
        { indicator_code:'profile_loaded', scope, value_num: 0 },
      ]);
      await renderStep0();
      return;
    }
    if (code === 'amphur_code') {
      const profile = getMockProfileConfig();
      const amphurRows = profile.provinceCode ? (await fetchAmphurPopulationReference(profile.provinceCode)).rows || [] : [];
      const selectedRow = amphurRows.find((row) => String(row.amphur_code || '') === String(target.value || ''));
      queueMockSave([
        { indicator_code:'amphur_code', scope, value_text: target.value || '' },
        { indicator_code:'amphur_name', scope, value_text: selectedRow?.amphur_name_th || selectedRow?.amphur_name || '' },
        { indicator_code:'profile_loaded', scope, value_num: 0 },
      ]);
      await renderStep0();
      await maybeAutoPreloadMockProfile(code);
      return;
    }
    if (code === 'hospital_level') {
      queueMockSave([
        { indicator_code:'hospital_level', scope, value_text: normalizeHospitalLevel(target.value, MOCK_DEFAULT_HOSPITAL_LEVEL) },
        { indicator_code:'profile_loaded', scope, value_num: 0 },
      ]);
      await renderStep0();
      await maybeAutoPreloadMockProfile(code);
      return;
    }
    if (code === 'template_hospital') {
      queueMockSave([
        { indicator_code:'template_hospital', scope, value_text: target.value || '' },
        { indicator_code:'profile_loaded', scope, value_num: 0 },
      ]);
      await renderStep0();
      await maybeAutoPreloadMockProfile(code);
      return;
    }
  }
  if (!target.classList?.contains('mock-input')) return;
  if (!isMockHospital() || !mockSession.scenarioId) return;

  const field = getMockFieldByCode(target.dataset.code, target.dataset.scope || 'global');
  let value = target.value === '' ? null : parseFloat(target.value);
  if (field?.unit === 'คน' && value !== null && !Number.isNaN(value)) {
    value = Math.max(0, Math.round(value));
    target.value = value;
  } else if (field?.unit === '%' && value !== null && !Number.isNaN(value)) {
    value = Math.min(100, Math.max(0, value));
    target.value = value;
  }
  queueMockSave([
    {
      indicator_code: target.dataset.code,
      scope: target.dataset.scope || 'global',
      value_num: Number.isNaN(value) ? null : value,
    },
  ]);

  const rerenders = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    5: renderStep5,
    6: renderStep6,
  };
  const rerender = rerenders[currentStep];
  if (rerender) await rerender();
});

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
