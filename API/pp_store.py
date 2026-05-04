import json
import os
import sqlite3
import unicodedata
import uuid
from collections import defaultdict
from datetime import datetime

try:
    from analysis_governance_store import (
        compute_pp_confidence_summary,
        get_benchmark_lookup,
        get_indicator_policy_lookup,
        get_phase1_indicator_count,
    )
    from pp_workforce_dictionary import (
        PP_PROFESSION_LABELS,
        PP_WORKFORCE_DICTIONARY,
        render_pp_metric_sql,
    )
except ImportError:
    from API.analysis_governance_store import (
        compute_pp_confidence_summary,
        get_benchmark_lookup,
        get_indicator_policy_lookup,
        get_phase1_indicator_count,
    )
    from API.pp_workforce_dictionary import (
        PP_PROFESSION_LABELS,
        PP_WORKFORCE_DICTIONARY,
        render_pp_metric_sql,
    )


BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "hr_blueprint.db")
HEALTH_REGION1_PROVINCES = ("50", "51", "52", "54", "55", "56", "57", "58")
PP_PARENT_CATEGORY_ID = "73daf277928bc32a1b3c8e772192543c"

PROFESSION_LABELS = PP_PROFESSION_LABELS


def _normalize_lookup_key(value: str | None) -> str:
    return unicodedata.normalize("NFC", (value or "").strip())


def _policy_allows_indicator(indicator_code: str, policy_lookup: dict[str, dict], field_name: str) -> bool:
    policy = policy_lookup.get(indicator_code)
    if not policy:
        return True
    return int(policy.get(field_name) or 0) == 1


def _filter_indicator_rows(
    rows: list[dict],
    policy_lookup: dict[str, dict],
    *,
    field_name: str,
    shortlist_only: bool = True,
) -> list[dict]:
    filtered = []
    for item in rows:
        indicator_code = item.get("indicator_code")
        if not _policy_allows_indicator(indicator_code, policy_lookup, field_name):
            continue
        if shortlist_only and not _policy_allows_indicator(indicator_code, policy_lookup, "include_in_phase1"):
            continue
        policy = policy_lookup.get(indicator_code, {})
        merged = dict(item)
        merged["policy_domain"] = policy.get("policy_domain")
        merged["policy_name_th"] = policy.get("policy_name_th")
        merged["policy_note"] = policy.get("policy_note")
        merged["private_sector_bias_flag"] = int(policy.get("private_sector_bias_flag") or 0)
        filtered.append(merged)
    return filtered

PP_FUNCTION_SEED = [
    {
        "pp_function_code": "PP_COMMUNITY_NURSING",
        "function_name_th": "การพยาบาลชุมชน",
        "function_name_en": "Community Nursing",
        "function_group": "primary_care",
        "dimension": "promotion_prevention",
        "description": "ดูแลประชากรเชิงรุก ติดตามต่อเนื่องที่บ้านและชุมชน",
        "default_profession_mix": {"RN": 0.55, "PH_OFFICER": 0.25, "PH_ACAD": 0.20},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_COMMUNICABLE_CONTROL",
        "function_name_th": "ควบคุมโรคติดต่อ",
        "function_name_en": "Communicable Disease Control",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "เฝ้าระวัง สอบสวน และควบคุมโรคติดต่อ",
        "default_profession_mix": {"PH_ACAD": 0.40, "PH_OFFICER": 0.35, "RN": 0.25},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_NCD_MENTAL_SUBSTANCE",
        "function_name_th": "ควบคุมโรคไม่ติดต่อ สุขภาพจิต และยาเสพติด",
        "function_name_en": "NCD Mental Health and Substance Control",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "คัดกรอง ติดตาม และจัดการโรคเรื้อรัง สุขภาพจิต และยาเสพติด",
        "default_profession_mix": {"RN": 0.30, "PH_ACAD": 0.25, "PH_OFFICER": 0.15, "FAM_MD": 0.15, "PSY": 0.10, "CPSY": 0.05},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_PRIMARY_CARE_HOLISTIC",
        "function_name_th": "บริการด้านปฐมภูมิและองค์รวม",
        "function_name_en": "Holistic Primary Care",
        "function_group": "primary_care",
        "dimension": "promotion_prevention",
        "description": "บริการปฐมภูมิแบบองค์รวม ครอบคลุมคัดกรอง ส่งเสริม ป้องกัน และติดตามต่อเนื่อง",
        "default_profession_mix": {"RN": 0.35, "PH_ACAD": 0.25, "PH_OFFICER": 0.20, "FAM_MD": 0.20},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_PUBLIC_HEALTH_ADMIN",
        "function_name_th": "บริหารสาธารณสุข",
        "function_name_en": "Public Health Administration",
        "function_group": "governance",
        "dimension": "promotion_prevention",
        "description": "วางแผน กำกับ และบริหารทรัพยากรด้านสาธารณสุข",
        "default_profession_mix": {"PH_ACAD": 0.45, "PH_OFFICER": 0.20, "RN": 0.20, "FAM_MD": 0.15},
        "is_primary_care": 0,
    },
    {
        "pp_function_code": "PP_SOCIAL_MEDICINE",
        "function_name_th": "เวชกรรมสังคม",
        "function_name_en": "Social Medicine",
        "function_group": "primary_care",
        "dimension": "promotion_prevention",
        "description": "เชื่อมบริการรักษากับบริบทสังคมและสิ่งแวดล้อมของประชากร",
        "default_profession_mix": {"FAM_MD": 0.35, "RN": 0.25, "PH_ACAD": 0.20, "PH_OFFICER": 0.20},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_FAMILY_MEDICINE",
        "function_name_th": "เวชปฏิบัติครอบครัว",
        "function_name_en": "Family Medicine",
        "function_group": "primary_care",
        "dimension": "promotion_prevention",
        "description": "แพทย์เวชศาสตร์ครอบครัวและทีมสหวิชาชีพดูแลประชากรแบบต่อเนื่อง",
        "default_profession_mix": {"FAM_MD": 0.40, "RN": 0.30, "PH_ACAD": 0.15, "PH_OFFICER": 0.15},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_PROMO_PREVENT_CONTROL",
        "function_name_th": "ส่งเสริม ป้องกัน ควบคุมโรค",
        "function_name_en": "Promotion Prevention and Control",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "งานเชิงรุกด้านส่งเสริมสุขภาพ ป้องกัน และควบคุมโรคระดับประชากร",
        "default_profession_mix": {"PH_ACAD": 0.35, "PH_OFFICER": 0.30, "RN": 0.20, "FAM_MD": 0.15},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_HEALTH_PROMOTION",
        "function_name_th": "ส่งเสริมสุขภาพ",
        "function_name_en": "Health Promotion",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "สร้างเสริมสุขภาพเชิงประชากรและพฤติกรรมสุขภาพ",
        "default_profession_mix": {"PH_ACAD": 0.35, "RN": 0.25, "PH_OFFICER": 0.25, "FAM_MD": 0.15},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_HEALTH_PROMOTION_PREVENTION",
        "function_name_th": "ส่งเสริมสุขภาพและป้องกันโรค",
        "function_name_en": "Health Promotion and Prevention",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "คัดกรอง ฉีดวัคซีน ติดตามหญิงตั้งครรภ์ เด็ก และกลุ่มเสี่ยง",
        "default_profession_mix": {"RN": 0.30, "PH_ACAD": 0.30, "PH_OFFICER": 0.25, "FAM_MD": 0.15},
        "is_primary_care": 1,
    },
    {
        "pp_function_code": "PP_HEALTH_EDUCATION",
        "function_name_th": "สุขศึกษา",
        "function_name_en": "Health Education",
        "function_group": "public_health",
        "dimension": "promotion_prevention",
        "description": "งานสื่อสารสุขภาพและปรับพฤติกรรมระดับบุคคลและชุมชน",
        "default_profession_mix": {"PH_ACAD": 0.40, "PH_OFFICER": 0.30, "RN": 0.20, "FAM_MD": 0.10},
        "is_primary_care": 1,
    },
]

PP_POSITION_GROUP_CROSSWALK_SEED = [
    {"pp_function_code": "PP_COMMUNITY_NURSING", "profession_code": "RN", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานการพยาบาลชุมชน", "priority": 10, "weight": 1.0},
    {"pp_function_code": "PP_COMMUNICABLE_CONTROL", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานควบคุมโรคติดต่อ", "priority": 10, "weight": 0.7},
    {"pp_function_code": "PP_COMMUNICABLE_CONTROL", "profession_code": "PH_OFFICER", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานควบคุมโรคติดต่อ", "priority": 11, "weight": 0.8},
    {"pp_function_code": "PP_NCD_MENTAL_SUBSTANCE", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานควบคุมโรคไม่ติดต่อ สุขภาพจิตและยาเสพติด", "priority": 10, "weight": 0.7},
    {"pp_function_code": "PP_NCD_MENTAL_SUBSTANCE", "profession_code": "PH_OFFICER", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานควบคุมโรคไม่ติดต่อ สุขภาพจิตและยาเสพติด", "priority": 11, "weight": 0.8},
    {"pp_function_code": "PP_NCD_MENTAL_SUBSTANCE", "profession_code": "RN", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานควบคุมโรคไม่ติดต่อ สุขภาพจิตและยาเสพติด", "priority": 12, "weight": 0.5},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "RN", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานบริการด้านปฐมภูมิและองค์รวม", "priority": 10, "weight": 0.7},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานบริการด้านปฐมภูมิและองค์รวม", "priority": 11, "weight": 0.7},
    {"pp_function_code": "PP_PUBLIC_HEALTH_ADMIN", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานบริหารสาธารณสุข", "priority": 10, "weight": 1.0},
    {"pp_function_code": "PP_SOCIAL_MEDICINE", "profession_code": "FAM_MD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานเวชกรรมสังคม", "priority": 10, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานเวชปฏิบัติครอบครัว", "priority": 10, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "RN", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานเวชปฏิบัติครอบครัว", "priority": 11, "weight": 0.6},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "contains_group", "source_position_group_name": "เวชปฏิบัติครอบครัว", "priority": 20, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "RN", "match_type": "contains_group", "source_position_group_name": "เวชปฏิบัติครอบครัวและชุมชน", "priority": 21, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "PH_ACAD", "match_type": "contains_group", "source_position_group_name": "เวชปฏิบัติครอบครัวและชุมชน", "priority": 22, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "RN", "match_type": "contains_group", "source_position_group_name": "ศูนย์สุขภาพชุมชนเขตเมือง", "priority": 23, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "PH_ACAD", "match_type": "contains_group", "source_position_group_name": "ศูนย์สุขภาพชุมชนเขตเมือง", "priority": 24, "weight": 1.0},
    {"pp_function_code": "PP_PROMO_PREVENT_CONTROL", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานส่งเสริมป้องกันควบคุมโรค", "priority": 10, "weight": 0.9},
    {"pp_function_code": "PP_PROMO_PREVENT_CONTROL", "profession_code": "PH_OFFICER", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานส่งเสริมป้องกันควบคุมโรค", "priority": 11, "weight": 0.9},
    {"pp_function_code": "PP_HEALTH_PROMOTION", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานส่งเสริมสุขภาพ", "priority": 10, "weight": 0.9},
    {"pp_function_code": "PP_HEALTH_PROMOTION_PREVENTION", "profession_code": "RN", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานส่งเสริมสุขภาพและป้องกันโรค", "priority": 10, "weight": 0.7},
    {"pp_function_code": "PP_HEALTH_PROMOTION_PREVENTION", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานส่งเสริมสุขภาพและป้องกันโรค", "priority": 11, "weight": 0.7},
    {"pp_function_code": "PP_HEALTH_EDUCATION", "profession_code": "PH_ACAD", "match_type": "exact_group", "source_position_group_name": "กลุ่มงานสุขศึกษา", "priority": 10, "weight": 1.0},
    {"pp_function_code": "PP_HEALTH_PROMOTION_PREVENTION", "profession_code": "RN", "match_type": "contains_group", "source_position_group_name": "ปฐมภูมิ", "priority": 40, "weight": 0.4},
    {"pp_function_code": "PP_HEALTH_PROMOTION_PREVENTION", "profession_code": "PH_ACAD", "match_type": "contains_group", "source_position_group_name": "ปฐมภูมิ", "priority": 41, "weight": 0.4},
    {"pp_function_code": "PP_PUBLIC_HEALTH_ADMIN", "profession_code": "PH_ACAD", "match_type": "contains_group", "source_position_group_name": "สาธารณสุข", "priority": 45, "weight": 0.35},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "contains_specialist", "source_specialist_keyword": "เวชศาสตร์ครอบครัว", "priority": 15, "weight": 1.0},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "contains_position", "source_position_name_th": "นายแพทย์", "source_unit_type_label": "รพช.", "priority": 60, "weight": 0.005, "notes": "Fallback สำหรับ รพช. ที่ยังไม่ระบุ specialist"},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "contains_position", "source_position_name_th": "นายแพทย์", "source_unit_type_label": "รพท.", "priority": 61, "weight": 0.003, "notes": "Fallback สำหรับ รพท. ที่ยังไม่ระบุ specialist"},
    {"pp_function_code": "PP_FAMILY_MEDICINE", "profession_code": "FAM_MD", "match_type": "contains_position", "source_position_name_th": "นายแพทย์", "source_unit_type_label": "รพศ.", "priority": 62, "weight": 0.002, "notes": "Fallback สำหรับ รพศ. ที่ยังไม่ระบุ specialist"},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "PH_ACAD", "match_type": "exact_position", "source_position_name_th": "นักวิชาการสาธารณสุข", "source_unit_type_label": "รพ.สต./สอ.", "priority": 70, "weight": 0.7},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "PH_OFFICER", "match_type": "exact_position", "source_position_name_th": "นักสาธารณสุข", "source_unit_type_label": "รพ.สต./สอ.", "priority": 71, "weight": 0.7},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "PH_OFFICER", "match_type": "exact_position", "source_position_name_th": "เจ้าพนักงานสาธารณสุข", "source_unit_type_label": "รพ.สต./สอ.", "priority": 72, "weight": 0.7},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "RN", "match_type": "exact_position", "source_position_name_th": "พยาบาลวิชาชีพ", "source_unit_type_label": "รพ.สต./สอ.", "priority": 73, "weight": 0.6},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "RN", "match_type": "exact_position", "source_position_name_th": "พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข", "source_unit_type_label": "รพ.สต./สอ.", "priority": 74, "weight": 0.5},
    {"pp_function_code": "PP_PRIMARY_CARE_HOLISTIC", "profession_code": "PH_ACAD", "match_type": "exact_position", "source_position_name_th": "พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข", "source_unit_type_label": "รพ.สต./สอ.", "priority": 75, "weight": 0.5},
]

INDICATOR_MAPPING_RULES = [
    {
        "keywords": ("สุขภาพจิต", "ยาเสพติด"),
        "maps": [
            ("PP_NCD_MENTAL_SUBSTANCE", "RN", "คัดกรองและติดตามที่ primary care", 1.0, 1),
            ("PP_NCD_MENTAL_SUBSTANCE", "PH_ACAD", "บริหารโครงการและติดตามกลุ่มเสี่ยง", 0.8, 2),
            ("PP_NCD_MENTAL_SUBSTANCE", "PH_OFFICER", "ติดตามเชิงรุกและเยี่ยมบ้าน", 0.8, 2),
            ("PP_NCD_MENTAL_SUBSTANCE", "FAM_MD", "แพทย์เวชศาสตร์ครอบครัวคุมแผนต่อเนื่อง", 0.6, 3),
            ("PP_NCD_MENTAL_SUBSTANCE", "PSY", "ประเมินและปรับพฤติกรรมเชิงลึก", 0.7, 3),
            ("PP_NCD_MENTAL_SUBSTANCE", "CPSY", "ดูแลกรณี mental outcome ซับซ้อน", 0.7, 3),
        ],
    },
    {
        "keywords": ("คัดกรอง",),
        "maps": [
            ("PP_HEALTH_PROMOTION_PREVENTION", "RN", "งานคัดกรองและติดตามผลกลุ่มเสี่ยง", 1.0, 1),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_ACAD", "วางแผนเชิงรุกระดับพื้นที่", 0.9, 2),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_OFFICER", "ปฏิบัติการลงชุมชน", 0.8, 2),
            ("PP_FAMILY_MEDICINE", "FAM_MD", "เชื่อมคัดกรองกับการดูแลต่อเนื่อง", 0.6, 3),
        ],
    },
    {
        "keywords": ("ภูมิคุ้มกันโรค", "วัคซีน"),
        "maps": [
            ("PP_PROMO_PREVENT_CONTROL", "RN", "บริการวัคซีนและติดตามครบชุด", 1.0, 1),
            ("PP_PROMO_PREVENT_CONTROL", "PH_ACAD", "บริหารแผนสร้างเสริมภูมิคุ้มกัน", 0.8, 2),
            ("PP_PROMO_PREVENT_CONTROL", "PH_OFFICER", "ติดตามเด็กตกหล่นและชุมชน", 0.8, 2),
        ],
    },
    {
        "keywords": ("อนามัยแม่และเด็ก",),
        "maps": [
            ("PP_HEALTH_PROMOTION_PREVENTION", "RN", "ANC, MCH และติดตามเด็ก", 1.0, 1),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_ACAD", "กำกับตัวชี้วัด MCH", 0.8, 2),
            ("PP_FAMILY_MEDICINE", "FAM_MD", "ประเมินความเสี่ยงครรภ์และเด็ก", 0.7, 2),
        ],
    },
    {
        "keywords": ("อนามัยโรงเรียน", "สุขศึกษา"),
        "maps": [
            ("PP_HEALTH_EDUCATION", "PH_ACAD", "ออกแบบกิจกรรมสุขศึกษาในโรงเรียน", 1.0, 1),
            ("PP_HEALTH_EDUCATION", "PH_OFFICER", "ดำเนินกิจกรรมเชิงพื้นที่", 0.8, 2),
            ("PP_COMMUNITY_NURSING", "RN", "คัดกรองและติดตามนักเรียนกลุ่มเสี่ยง", 0.6, 3),
        ],
    },
    {
        "keywords": ("โภชนาการ",),
        "maps": [
            ("PP_HEALTH_PROMOTION", "PH_ACAD", "ออกแบบ intervention โภชนาการ", 1.0, 1),
            ("PP_HEALTH_PROMOTION", "RN", "ติดตามหญิงตั้งครรภ์ เด็ก และ NCD", 0.7, 2),
            ("PP_HEALTH_PROMOTION", "PH_OFFICER", "ลงชุมชนและเครือข่าย", 0.7, 2),
        ],
    },
    {
        "keywords": ("เฝ้าระวัง", "อนามัยสิ่งแวดล้อม"),
        "maps": [
            ("PP_COMMUNICABLE_CONTROL", "PH_ACAD", "เฝ้าระวังและวิเคราะห์สัญญาณเตือน", 1.0, 1),
            ("PP_COMMUNICABLE_CONTROL", "PH_OFFICER", "สอบสวนโรคและติดตามภาคสนาม", 0.9, 2),
            ("PP_PROMO_PREVENT_CONTROL", "RN", "เชื่อมระบบเฝ้าระวังกับบริการปฐมภูมิ", 0.6, 3),
        ],
    },
]

PHASE1_SHORTLIST_SEED = [
    {
        "indicator_code": "49e6c2e9fb9ee2deb0639680325cfbcd",
        "phase_code": "phase1",
        "domain_code": "MENTAL",
        "domain_name_th": "Mental health and suicide prevention",
        "age_group_focus": "15-59",
        "extraction_priority": 1,
        "rationale": "Mental burden ในกลุ่ม chronic และ suicide prevention มีผลต่อ DALY สูงและมี district variation",
        "mappings": [
            ("PP_NCD_MENTAL_SUBSTANCE", "PSY", 1.0, 1, "คัดกรองเชิงลึกและปรับพฤติกรรมกลุ่มเสี่ยงฆ่าตัวตาย"),
            ("PP_NCD_MENTAL_SUBSTANCE", "CPSY", 1.0, 1, "ประเมินกรณีซับซ้อนและวางแผนดูแลต่อเนื่อง"),
            ("PP_NCD_MENTAL_SUBSTANCE", "RN", 0.8, 2, "ติดตามผู้ป่วย chronic ใน primary care"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.6, 3, "เชื่อมการประเมินกับ continuity plan"),
        ],
    },
    {
        "indicator_code": "234d24523894e656f33260494dddd968",
        "phase_code": "phase1",
        "domain_code": "MENTAL",
        "domain_name_th": "Mental health and suicide prevention",
        "age_group_focus": "15-59",
        "extraction_priority": 2,
        "rationale": "2Q ใน chronic เป็น upstream ของ 9Q/8Q และต้องใช้ทีมปฐมภูมิเป็นหลัก",
        "mappings": [
            ("PP_NCD_MENTAL_SUBSTANCE", "RN", 1.0, 1, "คัดกรองในคลินิกโรคเรื้อรัง"),
            ("PP_NCD_MENTAL_SUBSTANCE", "PSY", 0.8, 2, "สนับสนุนการประเมินต่อ"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.5, 3, "เชื่อมแผนดูแลต่อเนื่อง"),
        ],
    },
    {
        "indicator_code": "8f104b5d2848b8a05a487205f0287991",
        "phase_code": "phase1",
        "domain_code": "MENTAL",
        "domain_name_th": "Mental health and suicide prevention",
        "age_group_focus": "60+",
        "extraction_priority": 3,
        "rationale": "ผู้สูงอายุเป็น age-group สำคัญของเขต 1 และต้องโยงกับ LTC/community care",
        "mappings": [
            ("PP_COMMUNITY_NURSING", "RN", 1.0, 1, "คัดกรองและติดตามผู้สูงอายุในชุมชน"),
            ("PP_NCD_MENTAL_SUBSTANCE", "PSY", 0.7, 2, "ประเมินปัญหาซึมเศร้าในผู้สูงอายุ"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.6, 3, "เชื่อมกับแผนดูแลต่อเนื่อง"),
        ],
    },
    {
        "indicator_code": "68e401815a64e624c286d97ef3582aa3",
        "phase_code": "phase1",
        "domain_code": "NCD",
        "domain_name_th": "NCD screening and continuity",
        "age_group_focus": "15-59",
        "extraction_priority": 4,
        "rationale": "HT screening เป็น upstream ของ CVD/stroke burden และควบคุมได้ผ่าน primary care",
        "mappings": [
            ("PP_HEALTH_PROMOTION_PREVENTION", "RN", 1.0, 1, "คัดกรองความดันระดับประชากร"),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_ACAD", 0.8, 2, "วางแผน outreach และติดตามกลุ่มเสี่ยง"),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_OFFICER", 0.7, 2, "ลงชุมชนและติดตามผู้ไม่มารับการคัดกรอง"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.5, 3, "กำกับ clinical pathway กลุ่มเสี่ยง"),
        ],
    },
    {
        "indicator_code": "150edaa99ecbe538378b8150e0776763",
        "phase_code": "phase1",
        "domain_code": "NCD",
        "domain_name_th": "NCD screening and continuity",
        "age_group_focus": "15-59",
        "extraction_priority": 5,
        "rationale": "DM screening เป็น upstream ของ CKD/CVD burden และต้องใช้ network ปฐมภูมิ",
        "mappings": [
            ("PP_HEALTH_PROMOTION_PREVENTION", "RN", 1.0, 1, "คัดกรองเบาหวานระดับประชากร"),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_ACAD", 0.8, 2, "วางแผนเชิงรุกระดับพื้นที่"),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_OFFICER", 0.7, 2, "ติดตามกลุ่มเสี่ยงในชุมชน"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.5, 3, "เชื่อม screening เข้าสู่ continuity care"),
        ],
    },
    {
        "indicator_code": "82a12029ec7f57eb2e286e830f90b039",
        "phase_code": "phase1",
        "domain_code": "NCD",
        "domain_name_th": "NCD screening and continuity",
        "age_group_focus": "60+",
        "extraction_priority": 6,
        "rationale": "HT control ใน ศสม./รพ.สต. สะท้อน continuity ของ primary care โดยตรง",
        "mappings": [
            ("PP_PRIMARY_CARE_HOLISTIC", "RN", 1.0, 1, "ติดตามและปรับแผนการรักษาเบื้องต้น"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.8, 2, "support clinical management"),
            ("PP_PRIMARY_CARE_HOLISTIC", "PH_OFFICER", 0.6, 3, "ติดตาม adherence เชิงชุมชน"),
        ],
    },
    {
        "indicator_code": "848b5045eab655b7be0069efcc445dd9",
        "phase_code": "phase1",
        "domain_code": "NCD",
        "domain_name_th": "NCD screening and continuity",
        "age_group_focus": "60+",
        "extraction_priority": 7,
        "rationale": "DM control ใน ศสม./รพ.สต. ใช้บอกคุณภาพ continuity และภาระ primary care",
        "mappings": [
            ("PP_PRIMARY_CARE_HOLISTIC", "RN", 1.0, 1, "ติดตามผู้ป่วยเบาหวานต่อเนื่อง"),
            ("PP_FAMILY_MEDICINE", "FAM_MD", 0.8, 2, "support treatment adjustment"),
            ("PP_PRIMARY_CARE_HOLISTIC", "PH_OFFICER", 0.6, 3, "ติดตาม adherence และ home visit"),
        ],
    },

    {
        "indicator_code": "28dd2c7955ce926456240b2ff0100bde",
        "phase_code": "phase1",
        "domain_code": "IMMUNIZATION",
        "domain_name_th": "Child immunization",
        "age_group_focus": "0-1",
        "extraction_priority": 11,
        "rationale": "Fully immunized age 1 เป็น high-impact prevention ที่แปลเป็น policy ได้ตรง",
        "mappings": [
            ("PP_PROMO_PREVENT_CONTROL", "RN", 1.0, 1, "ฉีดวัคซีนและติดตามครบชุด"),
            ("PP_PROMO_PREVENT_CONTROL", "PH_ACAD", 0.8, 2, "บริหารแผนวัคซีนระดับพื้นที่"),
            ("PP_PROMO_PREVENT_CONTROL", "PH_OFFICER", 0.7, 2, "ติดตามเด็กตกหล่น"),
        ],
    },
    {
        "indicator_code": "c47283d3c2c1e6528ddcf88c254f21b3",
        "phase_code": "phase1",
        "domain_code": "IMMUNIZATION",
        "domain_name_th": "Child immunization",
        "age_group_focus": "5y",
        "extraction_priority": 12,
        "rationale": "DTP5/Polio5 สะท้อน catch-up immunization ก่อนเข้าเรียน",
        "mappings": [
            ("PP_PROMO_PREVENT_CONTROL", "RN", 1.0, 1, "ติดตามฉีดวัคซีนซ้ำให้ครบ"),
            ("PP_PROMO_PREVENT_CONTROL", "PH_ACAD", 0.8, 2, "บริหารการตามเก็บเด็กตกหล่น"),
            ("PP_PROMO_PREVENT_CONTROL", "PH_OFFICER", 0.7, 2, "ติดตามในชุมชนและโรงเรียน"),
        ],
    },
    {
        "indicator_code": "df12bdd1a98ec0306ad71b914356f313",
        "phase_code": "phase1",
        "domain_code": "NUTRITION",
        "domain_name_th": "Nutrition and child growth",
        "age_group_focus": "0-2",
        "extraction_priority": 13,
        "rationale": "สูงดีสมส่วน 0-2 ปี สะท้อน early-life growth promotion",
        "mappings": [
            ("PP_HEALTH_PROMOTION", "PH_ACAD", 1.0, 1, "ออกแบบ intervention โภชนาการเด็กเล็ก"),
            ("PP_COMMUNITY_NURSING", "RN", 0.8, 2, "ติดตามเด็กเสี่ยงและแม่หลังคลอด"),
            ("PP_HEALTH_PROMOTION", "PH_OFFICER", 0.7, 2, "ลงชุมชนและติดตามรายครอบครัว"),
        ],
    },
    {
        "indicator_code": "b86aa996a4d38717de811ed5d04663d5",
        "phase_code": "phase1",
        "domain_code": "NUTRITION",
        "domain_name_th": "Nutrition and child growth",
        "age_group_focus": "3-5",
        "extraction_priority": 14,
        "rationale": "สูงดีสมส่วน 3-5 ปี ใช้จับ growth faltering ก่อนวัยเรียน",
        "mappings": [
            ("PP_HEALTH_PROMOTION", "PH_ACAD", 1.0, 1, "กำกับงานโภชนาการเด็กก่อนวัยเรียน"),
            ("PP_COMMUNITY_NURSING", "RN", 0.8, 2, "ติดตามเด็กเสี่ยงร่วมกับชุมชน"),
            ("PP_HEALTH_PROMOTION", "PH_OFFICER", 0.7, 2, "เยี่ยมบ้านและเชื่อมศูนย์เด็ก"),
        ],
    },
    {
        "indicator_code": "8189e9a96e80298c71924cc2cab4bcb6",
        "phase_code": "phase1",
        "domain_code": "NUTRITION",
        "domain_name_th": "Nutrition and child growth",
        "age_group_focus": "0-2",
        "extraction_priority": 15,
        "rationale": "weight-for-height 0-2 ปี จับทั้งผอมและเริ่มอ้วน ซึ่งเป็น double burden",
        "mappings": [
            ("PP_HEALTH_PROMOTION", "PH_ACAD", 1.0, 1, "ออกแบบ intervention targeted nutrition"),
            ("PP_COMMUNITY_NURSING", "RN", 0.8, 2, "ติดตามเด็กที่มีภาวะเสี่ยง"),
            ("PP_HEALTH_PROMOTION", "PH_OFFICER", 0.6, 3, "เชื่อมเครือข่ายชุมชน"),
        ],
    },
]


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def db_scalar(value):
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value


def infer_indicator_rule(indicator_name: str | None, subcatalog_name: str | None = None) -> dict:
    name = indicator_name or ""
    subcatalog = subcatalog_name or ""

    explicit_rules = [
        ("การฝากครรภ์ครั้งแรกก่อนหรือเท่ากับ 12 สัปดาห์", {"good_direction": "high", "target_value": 75.0, "unit": "%"}),
        ("การประเมินการฆ่าตัวตาย (8Q)", {"good_direction": "high", "target_value": 80.0, "unit": "%"}),
        ("ได้รับวัคซีน", {"good_direction": "high", "target_value": 95.0, "unit": "%"}),
        ("วัคซีน", {"good_direction": "high", "target_value": 95.0, "unit": "%"}),
        ("คัดกรอง", {"good_direction": "high", "target_value": 90.0, "unit": "%"}),
        ("อนามัยแม่และเด็ก", {"good_direction": "high", "target_value": 80.0, "unit": "%"}),
    ]
    for keyword, rule in explicit_rules:
        if keyword in name or keyword in subcatalog:
            return rule

    if name.startswith("ร้อยละ") or any(keyword in name for keyword in ("ได้รับ", "ประเมิน", "คัดกรอง", "ติดตาม", "ฝากครรภ์", "วัคซีน", "กินนมแม่")):
        return {"good_direction": "high", "target_value": 80.0, "unit": "%"}
    if any(keyword in name for keyword in ("อัตราป่วย", "อัตราตาย", "เสียชีวิต", "สูบบุหรี่", "อ้วน", "ผอม", "ตั้งครรภ์ซ้ำ")):
        return {"good_direction": "low", "target_value": 10.0, "unit": "%"}
    return {}


def build_pp_schema(db_path: str | None = None):
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS pp_function_catalog (
            pp_function_code TEXT PRIMARY KEY,
            function_name_th TEXT NOT NULL,
            function_name_en TEXT,
            function_group TEXT,
            dimension TEXT DEFAULT 'promotion_prevention',
            description TEXT,
            default_profession_mix TEXT,
            is_primary_care INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pp_indicator_catalog (
            indicator_code TEXT PRIMARY KEY,
            report_code TEXT NOT NULL UNIQUE,
            indicator_name_th TEXT NOT NULL,
            indicator_name_en TEXT,
            parent_category_id TEXT,
            parent_category_name_th TEXT,
            subcatalog_id TEXT,
            subcatalog_name_th TEXT,
            source_table TEXT,
            source_file TEXT,
            table_freeze TEXT,
            available_years_json TEXT,
            display_levels_json TEXT,
            preferred_display_level TEXT DEFAULT 'ampur',
            unit TEXT,
            good_direction TEXT,
            target_value REAL,
            extraction_method TEXT,
            latest_sync_at TEXT,
            is_active INTEGER DEFAULT 1,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pp_indicator_workforce_map (
            map_id INTEGER PRIMARY KEY AUTOINCREMENT,
            indicator_code TEXT NOT NULL,
            pp_function_code TEXT NOT NULL,
            profession_code TEXT NOT NULL,
            role_label TEXT,
            contribution_weight REAL DEFAULT 1.0,
            action_priority INTEGER DEFAULT 1,
            rationale TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (indicator_code, pp_function_code, profession_code, role_label),
            FOREIGN KEY (indicator_code) REFERENCES pp_indicator_catalog(indicator_code),
            FOREIGN KEY (pp_function_code) REFERENCES pp_function_catalog(pp_function_code)
        );

        CREATE TABLE IF NOT EXISTS pp_indicator_strategy_map (
            strategy_id INTEGER PRIMARY KEY AUTOINCREMENT,
            indicator_code TEXT NOT NULL,
            phase_code TEXT NOT NULL,
            domain_code TEXT NOT NULL,
            domain_name_th TEXT NOT NULL,
            age_group_focus TEXT,
            extraction_priority INTEGER DEFAULT 99,
            is_shortlist INTEGER DEFAULT 1,
            rationale TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (indicator_code, phase_code),
            FOREIGN KEY (indicator_code) REFERENCES pp_indicator_catalog(indicator_code)
        );

        CREATE TABLE IF NOT EXISTS pp_position_group_crosswalk (
            crosswalk_id INTEGER PRIMARY KEY AUTOINCREMENT,
            pp_function_code TEXT NOT NULL,
            profession_code TEXT NOT NULL,
            match_type TEXT NOT NULL,
            source_position_group_name TEXT,
            source_position_name_th TEXT,
            source_specialist_keyword TEXT,
            source_unit_type_label TEXT,
            role_scope TEXT DEFAULT 'pp',
            weight REAL DEFAULT 1.0,
            priority INTEGER DEFAULT 10,
            is_active INTEGER DEFAULT 1,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pp_function_code) REFERENCES pp_function_catalog(pp_function_code)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_crosswalk_unique
        ON pp_position_group_crosswalk (
            pp_function_code, profession_code, match_type,
            source_position_group_name, source_position_name_th,
            source_specialist_keyword, source_unit_type_label
        );

        CREATE TABLE IF NOT EXISTS pp_extraction_run (
            extraction_run_id TEXT PRIMARY KEY,
            source_name TEXT NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT DEFAULT CURRENT_TIMESTAMP,
            finished_at TEXT,
            parent_category_url TEXT,
            requested_year_be INTEGER,
            requested_province_code TEXT,
            report_count INTEGER DEFAULT 0,
            row_count INTEGER DEFAULT 0,
            message TEXT
        );

        CREATE TABLE IF NOT EXISTS fact_pp_outcome_district (
            fact_id INTEGER PRIMARY KEY AUTOINCREMENT,
            indicator_code TEXT NOT NULL,
            report_code TEXT NOT NULL,
            year_be INTEGER NOT NULL,
            freeze_month TEXT,
            zone_code TEXT,
            province_code TEXT,
            province_name TEXT,
            amphur_code TEXT,
            amphur_name TEXT,
            tambon_code TEXT,
            tambon_name TEXT,
            hospital_code TEXT,
            hospital_name TEXT,
            display_level TEXT NOT NULL,
            location_key TEXT NOT NULL,
            value_num REAL,
            value_text TEXT,
            numerator REAL,
            denominator REAL,
            raw_json TEXT,
            extraction_run_id TEXT,
            source_url TEXT,
            extracted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (indicator_code) REFERENCES pp_indicator_catalog(indicator_code),
            FOREIGN KEY (extraction_run_id) REFERENCES pp_extraction_run(extraction_run_id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_pp_outcome_unique
        ON fact_pp_outcome_district (indicator_code, year_be, display_level, location_key, freeze_month);

        CREATE INDEX IF NOT EXISTS idx_pp_indicator_catalog_subcatalog ON pp_indicator_catalog(subcatalog_id);
        CREATE INDEX IF NOT EXISTS idx_pp_indicator_workforce_map_indicator ON pp_indicator_workforce_map(indicator_code);
        CREATE INDEX IF NOT EXISTS idx_pp_indicator_strategy_phase ON pp_indicator_strategy_map(phase_code, is_shortlist, extraction_priority);
        CREATE INDEX IF NOT EXISTS idx_pp_crosswalk_priority ON pp_position_group_crosswalk(priority, is_active);
        CREATE INDEX IF NOT EXISTS idx_fact_pp_outcome_lookup ON fact_pp_outcome_district(indicator_code, year_be, province_code, amphur_code, display_level);
        """
    )
    _seed_pp_functions(cur)
    _seed_pp_crosswalk(cur)
    _seed_pp_indicator_strategy(cur)
    conn.commit()
    refresh_indicator_workforce_map(conn=conn)
    conn.commit()
    conn.close()


def _seed_pp_functions(cur: sqlite3.Cursor):
    for item in PP_FUNCTION_SEED:
        cur.execute(
            """
            INSERT INTO pp_function_catalog (
                pp_function_code, function_name_th, function_name_en, function_group,
                dimension, description, default_profession_mix, is_primary_care
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pp_function_code) DO UPDATE SET
                function_name_th=excluded.function_name_th,
                function_name_en=excluded.function_name_en,
                function_group=excluded.function_group,
                dimension=excluded.dimension,
                description=excluded.description,
                default_profession_mix=excluded.default_profession_mix,
                is_primary_care=excluded.is_primary_care
            """,
            (
                item["pp_function_code"],
                item["function_name_th"],
                item.get("function_name_en"),
                item.get("function_group"),
                item.get("dimension"),
                item.get("description"),
                json.dumps(item.get("default_profession_mix", {}), ensure_ascii=False),
                item.get("is_primary_care", 1),
            ),
        )


def _seed_pp_crosswalk(cur: sqlite3.Cursor):
    cur.execute("DELETE FROM pp_position_group_crosswalk")
    for item in PP_POSITION_GROUP_CROSSWALK_SEED:
        cur.execute(
            """
            INSERT INTO pp_position_group_crosswalk (
                pp_function_code, profession_code, match_type, source_position_group_name,
                source_position_name_th, source_specialist_keyword, source_unit_type_label,
                role_scope, weight, priority, is_active, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                item["pp_function_code"],
                item["profession_code"],
                item["match_type"],
                item.get("source_position_group_name"),
                item.get("source_position_name_th"),
                item.get("source_specialist_keyword"),
                item.get("source_unit_type_label"),
                item.get("role_scope", "pp"),
                item.get("weight", 1.0),
                item.get("priority", 10),
                item.get("notes"),
            ),
        )


def _seed_pp_indicator_strategy(cur: sqlite3.Cursor):
    cur.execute("DELETE FROM pp_indicator_strategy_map")
    for item in PHASE1_SHORTLIST_SEED:
        cur.execute(
            """
            INSERT INTO pp_indicator_strategy_map (
                indicator_code, phase_code, domain_code, domain_name_th,
                age_group_focus, extraction_priority, is_shortlist, rationale, updated_at
            )
            SELECT ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP
            WHERE EXISTS (
                SELECT 1 FROM pp_indicator_catalog c WHERE c.indicator_code = ?
            )
            """,
            (
                item["indicator_code"],
                item["phase_code"],
                item["domain_code"],
                item["domain_name_th"],
                item.get("age_group_focus"),
                item.get("extraction_priority", 99),
                item.get("rationale"),
                item["indicator_code"],
            ),
        )


def start_extraction_run(source_name: str, mode: str, parent_category_url: str | None = None, requested_year_be: int | None = None, requested_province_code: str | None = None, db_path: str | None = None) -> str:
    build_pp_schema(db_path)
    extraction_run_id = f"ppx-{uuid.uuid4().hex[:12]}"
    conn = get_connection(db_path)
    conn.execute(
        """
        INSERT INTO pp_extraction_run (
            extraction_run_id, source_name, mode, status, parent_category_url, requested_year_be, requested_province_code
        ) VALUES (?, ?, ?, 'running', ?, ?, ?)
        """,
        (extraction_run_id, source_name, mode, parent_category_url, requested_year_be, requested_province_code),
    )
    conn.commit()
    conn.close()
    return extraction_run_id


def finish_extraction_run(extraction_run_id: str, status: str, report_count: int = 0, row_count: int = 0, message: str | None = None, db_path: str | None = None):
    conn = get_connection(db_path)
    conn.execute(
        """
        UPDATE pp_extraction_run
        SET status=?, finished_at=?, report_count=?, row_count=?, message=?
        WHERE extraction_run_id=?
        """,
        (status, now_iso(), report_count, row_count, message, extraction_run_id),
    )
    conn.commit()
    conn.close()


def upsert_indicator_catalog(records: list[dict], db_path: str | None = None) -> int:
    if not records:
        return 0
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    cur = conn.cursor()
    count = 0
    for item in records:
        indicator_code = item.get("indicator_code") or item.get("report_code")
        report_code = item.get("report_code") or indicator_code
        parent_category_id = item.get("parent_category_id")
        parent_category_name = item.get("parent_category_name_th")
        if not indicator_code or not report_code or not item.get("indicator_name_th"):
            continue
        if parent_category_id and parent_category_id != PP_PARENT_CATEGORY_ID and parent_category_name != "ส่งเสริมป้องกัน":
            continue
        inferred_rule = infer_indicator_rule(item.get("indicator_name_th"), item.get("subcatalog_name_th"))
        resolved_unit = item.get("unit") or inferred_rule.get("unit")
        resolved_good_direction = item.get("good_direction") or inferred_rule.get("good_direction")
        resolved_target_value = item.get("target_value")
        if resolved_target_value is None:
            resolved_target_value = inferred_rule.get("target_value")
        cur.execute(
            """
            INSERT INTO pp_indicator_catalog (
                indicator_code, report_code, indicator_name_th, indicator_name_en,
                parent_category_id, parent_category_name_th, subcatalog_id, subcatalog_name_th,
                source_table, source_file, table_freeze, available_years_json, display_levels_json,
                preferred_display_level, unit, good_direction, target_value, extraction_method,
                latest_sync_at, is_active, notes, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(indicator_code) DO UPDATE SET
                report_code=excluded.report_code,
                indicator_name_th=excluded.indicator_name_th,
                indicator_name_en=excluded.indicator_name_en,
                parent_category_id=excluded.parent_category_id,
                parent_category_name_th=excluded.parent_category_name_th,
                subcatalog_id=excluded.subcatalog_id,
                subcatalog_name_th=excluded.subcatalog_name_th,
                source_table=excluded.source_table,
                source_file=excluded.source_file,
                table_freeze=excluded.table_freeze,
                available_years_json=excluded.available_years_json,
                display_levels_json=excluded.display_levels_json,
                preferred_display_level=excluded.preferred_display_level,
                unit=excluded.unit,
                good_direction=COALESCE(excluded.good_direction, pp_indicator_catalog.good_direction),
                target_value=COALESCE(excluded.target_value, pp_indicator_catalog.target_value),
                extraction_method=excluded.extraction_method,
                latest_sync_at=excluded.latest_sync_at,
                is_active=1,
                notes=excluded.notes,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                indicator_code,
                report_code,
                item["indicator_name_th"],
                item.get("indicator_name_en"),
                parent_category_id,
                parent_category_name,
                db_scalar(item.get("subcatalog_id")),
                db_scalar(item.get("subcatalog_name_th")),
                db_scalar(item.get("source_table")),
                db_scalar(item.get("source_file")),
                db_scalar(item.get("table_freeze")),
                json.dumps(item.get("available_years", []), ensure_ascii=False),
                json.dumps(item.get("display_levels", []), ensure_ascii=False),
                db_scalar(item.get("preferred_display_level")) or "ampur",
                db_scalar(resolved_unit),
                db_scalar(resolved_good_direction),
                resolved_target_value,
                db_scalar(item.get("extraction_method")) or "playwright",
                db_scalar(item.get("latest_sync_at")) or now_iso(),
                db_scalar(item.get("notes")),
            ),
        )
        count += 1
    _seed_pp_indicator_strategy(cur)
    refresh_indicator_workforce_map(conn=conn)
    conn.commit()
    conn.close()
    return count


def _infer_workforce_maps(indicator: dict) -> list[tuple]:
    haystack = " ".join(str(indicator.get(key, "") or "") for key in ("indicator_name_th", "subcatalog_name_th", "parent_category_name_th"))
    matches = []
    for rule in INDICATOR_MAPPING_RULES:
        if any(keyword in haystack for keyword in rule["keywords"]):
            matches.extend(rule["maps"])
    if not matches:
        matches = [
            ("PP_HEALTH_PROMOTION_PREVENTION", "RN", "default PP care coordination", 0.5, 5),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_ACAD", "default PP program management", 0.5, 5),
            ("PP_HEALTH_PROMOTION_PREVENTION", "PH_OFFICER", "default PP community outreach", 0.5, 5),
        ]
    return matches


def _phase1_mapping_lookup() -> dict[str, list[tuple]]:
    lookup = {}
    for item in PHASE1_SHORTLIST_SEED:
        lookup[item["indicator_code"]] = [
            (pp_function_code, profession_code, rationale, weight, priority)
            for pp_function_code, profession_code, weight, priority, rationale in item.get("mappings", [])
        ]
    return lookup


def refresh_indicator_workforce_map(db_path: str | None = None, conn: sqlite3.Connection | None = None):
    owns_conn = conn is None
    if owns_conn:
        conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM pp_indicator_workforce_map")
    explicit_lookup = _phase1_mapping_lookup()
    indicators = [
        row_to_dict(row)
        for row in cur.execute(
            "SELECT * FROM pp_indicator_catalog WHERE is_active=1 AND (parent_category_id = ? OR parent_category_name_th = 'ส่งเสริมป้องกัน')",
            (PP_PARENT_CATEGORY_ID,),
        ).fetchall()
    ]
    for indicator in indicators:
        workforce_maps = explicit_lookup.get(indicator["indicator_code"]) or _infer_workforce_maps(indicator)
        for pp_function_code, profession_code, rationale, weight, priority in workforce_maps:
            cur.execute(
                """
                INSERT INTO pp_indicator_workforce_map (
                    indicator_code, pp_function_code, profession_code, role_label,
                    contribution_weight, action_priority, rationale
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    indicator["indicator_code"],
                    pp_function_code,
                    profession_code,
                    PROFESSION_LABELS.get(profession_code, profession_code),
                    weight,
                    priority,
                    rationale,
                ),
            )
    if owns_conn:
        conn.commit()
        conn.close()


def list_pp_catalog(db_path: str | None = None) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT c.indicator_code, c.report_code, c.indicator_name_th, c.parent_category_name_th,
               c.subcatalog_name_th, c.source_table, c.table_freeze, c.latest_sync_at,
               c.preferred_display_level, c.good_direction, c.target_value,
               s.phase_code, s.domain_code, s.domain_name_th, s.age_group_focus,
               s.extraction_priority, COALESCE(s.is_shortlist, 0) AS is_shortlist
        FROM pp_indicator_catalog c
        LEFT JOIN pp_indicator_strategy_map s
          ON s.indicator_code = c.indicator_code
        WHERE c.is_active=1
          AND (c.parent_category_id = ? OR c.parent_category_name_th = 'ส่งเสริมป้องกัน')
        ORDER BY COALESCE(s.extraction_priority, 999), c.subcatalog_name_th, c.indicator_name_th
        """,
        (PP_PARENT_CATEGORY_ID,),
    ).fetchall()
    conn.close()
    return [row_to_dict(row) for row in rows]


def list_pp_shortlist_catalog(phase_code: str = "phase1", db_path: str | None = None) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT c.indicator_code, c.report_code, c.indicator_name_th, c.subcatalog_id,
               c.subcatalog_name_th, c.source_table, c.preferred_display_level,
               c.good_direction, c.target_value, c.unit,
               s.phase_code, s.domain_code, s.domain_name_th, s.age_group_focus,
               s.extraction_priority, s.rationale
        FROM pp_indicator_strategy_map s
        JOIN pp_indicator_catalog c ON c.indicator_code = s.indicator_code
        WHERE s.phase_code = ?
          AND s.is_shortlist = 1
          AND c.is_active = 1
        ORDER BY s.extraction_priority, c.indicator_name_th
        """,
        (phase_code,),
    ).fetchall()
    conn.close()
    return [row_to_dict(row) for row in rows]


def list_pp_crosswalk(db_path: str | None = None) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT c.*, f.function_name_th
        FROM pp_position_group_crosswalk c
        LEFT JOIN pp_function_catalog f ON f.pp_function_code = c.pp_function_code
        WHERE c.is_active=1
        ORDER BY c.priority, c.pp_function_code, c.profession_code
        """
    ).fetchall()
    conn.close()
    return [row_to_dict(row) for row in rows]


def list_pp_indicator_workforce_map(db_path: str | None = None) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    rows = conn.execute(
        """
        SELECT m.*, f.function_name_th
        FROM pp_indicator_workforce_map m
        LEFT JOIN pp_function_catalog f ON f.pp_function_code = m.pp_function_code
        ORDER BY m.indicator_code, m.contribution_weight DESC, m.profession_code
        """
    ).fetchall()
    conn.close()
    return [row_to_dict(row) for row in rows]


def _location_token(*values) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text.replace("|", "/")
    return "ALL"


def _location_key(row: dict) -> str:
    return "|".join(
        [
            _location_token(row.get("province_code"), row.get("province_name")),
            _location_token(row.get("amphur_code"), row.get("amphur_name")),
            _location_token(row.get("tambon_code"), row.get("tambon_name")),
            _location_token(row.get("hospital_code"), row.get("hospital_name")),
        ]
    )


def upsert_pp_outcome_rows(rows: list[dict], db_path: str | None = None) -> int:
    if not rows:
        return 0
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    cur = conn.cursor()
    inserted = 0
    for row in rows:
        row = dict(row)
        row["freeze_month"] = row.get("freeze_month") or ""
        row["location_key"] = row.get("location_key") or _location_key(row)
        cur.execute(
            """
            INSERT INTO fact_pp_outcome_district (
                indicator_code, report_code, year_be, freeze_month, zone_code,
                province_code, province_name, amphur_code, amphur_name,
                tambon_code, tambon_name, hospital_code, hospital_name,
                display_level, location_key, value_num, value_text, numerator, denominator,
                raw_json, extraction_run_id, source_url, extracted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(indicator_code, year_be, display_level, location_key, freeze_month)
            DO UPDATE SET
                report_code=excluded.report_code,
                zone_code=excluded.zone_code,
                province_code=excluded.province_code,
                province_name=excluded.province_name,
                amphur_code=excluded.amphur_code,
                amphur_name=excluded.amphur_name,
                tambon_code=excluded.tambon_code,
                tambon_name=excluded.tambon_name,
                hospital_code=excluded.hospital_code,
                hospital_name=excluded.hospital_name,
                value_num=excluded.value_num,
                value_text=excluded.value_text,
                numerator=excluded.numerator,
                denominator=excluded.denominator,
                raw_json=excluded.raw_json,
                extraction_run_id=excluded.extraction_run_id,
                source_url=excluded.source_url,
                extracted_at=excluded.extracted_at
            """,
            (
                row["indicator_code"],
                row.get("report_code") or row["indicator_code"],
                row["year_be"],
                row.get("freeze_month"),
                row.get("zone_code"),
                row.get("province_code"),
                row.get("province_name"),
                row.get("amphur_code"),
                row.get("amphur_name"),
                row.get("tambon_code"),
                row.get("tambon_name"),
                row.get("hospital_code"),
                row.get("hospital_name"),
                row.get("display_level") or "ampur",
                row["location_key"],
                row.get("value_num"),
                row.get("value_text"),
                row.get("numerator"),
                row.get("denominator"),
                json.dumps(row.get("raw_json"), ensure_ascii=False) if row.get("raw_json") is not None else None,
                row.get("extraction_run_id"),
                row.get("source_url"),
                row.get("extracted_at") or now_iso(),
            ),
        )
        inserted += 1
    conn.commit()
    conn.close()
    return inserted


def _fetch_position_capacity_rows(
    conn: sqlite3.Connection,
    province_code: str | None = None,
    unit_id: str | None = None,
    unit_name: str | None = None,
) -> list[dict]:
    params = list(HEALTH_REGION1_PROVINCES)
    sql = f"""
        SELECT
            p.position_id, p.position_name_th, p.position_group_name, p.position_specialist_name,
            COALESCE(p.fte_value, 1.0) AS position_fte,
            ou.unit_id, ou.unit_name, ou.unit_type_label, ou.province_code, ou.amphur_code, ou.amphur_name,
            prov.province_name_th,
            COALESCE(SUM(
                CASE
                    WHEN a.status = 'active' AND (a.end_date IS NULL OR a.end_date = '')
                    THEN COALESCE(a.fte_percentage, 100.0) / 100.0
                    ELSE 0
                END
            ), 0) AS assigned_fte,
            COUNT(DISTINCT CASE
                WHEN a.status = 'active' AND (a.end_date IS NULL OR a.end_date = '')
                THEN a.personnel_id
            END) AS headcount
        FROM position p
        JOIN organizational_unit ou ON ou.unit_id = p.unit_id
        LEFT JOIN provinces prov ON prov.province_code = ou.province_code
        LEFT JOIN assignment a ON a.position_id = p.position_id
        WHERE ou.province_code IN ({",".join("?" for _ in HEALTH_REGION1_PROVINCES)})
    """
    if province_code:
        sql += " AND ou.province_code = ?"
        params.append(province_code)
    if unit_id:
        sql += " AND ou.unit_id = ?"
        params.append(unit_id)
    sql += """
        GROUP BY
            p.position_id, p.position_name_th, p.position_group_name, p.position_specialist_name,
            p.fte_value, ou.unit_id, ou.unit_name, ou.unit_type_label, ou.province_code,
            ou.amphur_code, ou.amphur_name, prov.province_name_th
    """
    rows = [row_to_dict(row) for row in conn.execute(sql, params).fetchall()]
    if unit_name:
        lookup = _normalize_lookup_key(unit_name)
        rows = [row for row in rows if _normalize_lookup_key(row.get("unit_name")) == lookup]
    return rows


def _infer_position_professions(position_row: dict) -> set[str]:
    position_name = position_row.get("position_name_th") or ""
    specialist_name = position_row.get("position_specialist_name") or ""
    professions = set()

    if "พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข" in position_name:
        professions.update({"RN", "PH_ACAD"})
    if "นายแพทย์" in position_name:
        professions.add("MD")
    if "เวชศาสตร์ครอบครัว" in specialist_name:
        professions.add("FAM_MD")
        professions.add("MD")
    if "พยาบาล" in position_name:
        professions.add("RN")
    if "นักวิชาการสาธารณสุข" in position_name:
        professions.add("PH_ACAD")
    if "นักสาธารณสุข" in position_name or "เจ้าพนักงานสาธารณสุข" in position_name:
        professions.add("PH_OFFICER")
    if "นักจิตวิทยาคลินิก" in position_name:
        professions.add("CPSY")
    elif "นักจิตวิทยา" in position_name:
        professions.add("PSY")
    if "นักกายภาพบำบัด" in position_name:
        professions.add("PT")

    return professions


def _position_matches_profession(position_row: dict, profession_code: str) -> bool:
    professions = _infer_position_professions(position_row)
    if profession_code == "FAM_MD":
        return "FAM_MD" in professions
    if profession_code in {"RN", "PH_ACAD", "PH_OFFICER", "PSY", "CPSY", "PT"}:
        return profession_code in professions
    return True


def _load_crosswalk_rows(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT *
        FROM pp_position_group_crosswalk
        WHERE is_active=1
        ORDER BY priority ASC, crosswalk_id ASC
        """
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def _matches_crosswalk(position_row: dict, crosswalk_row: dict) -> bool:
    group_name = position_row.get("position_group_name") or ""
    position_name = position_row.get("position_name_th") or ""
    specialist_name = position_row.get("position_specialist_name") or ""
    unit_type_label = position_row.get("unit_type_label") or ""
    match_type = crosswalk_row["match_type"]

    if crosswalk_row.get("source_unit_type_label") and crosswalk_row["source_unit_type_label"] != unit_type_label:
        return False
    if match_type == "exact_group":
        return group_name == (crosswalk_row.get("source_position_group_name") or "")
    if match_type == "contains_group":
        return (crosswalk_row.get("source_position_group_name") or "") in group_name
    if match_type == "exact_position":
        return position_name == (crosswalk_row.get("source_position_name_th") or "")
    if match_type == "contains_position":
        return (crosswalk_row.get("source_position_name_th") or "") in position_name
    if match_type == "contains_specialist":
        return (crosswalk_row.get("source_specialist_keyword") or "") in specialist_name
    return False


def _compute_capacity_matches(
    conn: sqlite3.Connection,
    province_code: str | None = None,
    unit_id: str | None = None,
    unit_name: str | None = None,
    include_fallback_rules: bool = False,
) -> list[dict]:
    positions = _fetch_position_capacity_rows(conn, province_code=province_code, unit_id=unit_id, unit_name=unit_name)
    crosswalk = _load_crosswalk_rows(conn)
    matches = []
    for position in positions:
        filled_fte = float(position.get("assigned_fte") or 0)
        headcount = int(position.get("headcount") or 0)
        if filled_fte <= 0 and headcount <= 0:
            continue
        for rule in crosswalk:
            if not include_fallback_rules and (rule.get("priority") or 0) >= 60:
                continue
            if not _matches_crosswalk(position, rule):
                continue
            if not _position_matches_profession(position, rule["profession_code"]):
                continue
            weight = float(rule.get("weight") or 1.0)
            matches.append(
                {
                    "province_code": position.get("province_code"),
                    "province_name_th": position.get("province_name_th"),
                    "unit_id": position.get("unit_id"),
                    "unit_name": position.get("unit_name"),
                    "unit_type_label": position.get("unit_type_label"),
                    "pp_function_code": rule["pp_function_code"],
                    "profession_code": rule["profession_code"],
                    "matched_fte": filled_fte * weight,
                    "matched_headcount": headcount * weight,
                    "position_name_th": position.get("position_name_th"),
                    "position_group_name": position.get("position_group_name") or "",
                    "specialist_name": position.get("position_specialist_name") or "ไม่ระบุสาขา",
                    "crosswalk_priority": rule.get("priority"),
                    "crosswalk_match_type": rule.get("match_type"),
                }
            )
    return matches


def get_pp_capacity_summary(
    province_code: str | None = None,
    unit_id: str | None = None,
    unit_name: str | None = None,
    db_path: str | None = None,
) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    function_lookup = {
        row["pp_function_code"]: row_to_dict(row)
        for row in conn.execute("SELECT * FROM pp_function_catalog").fetchall()
    }
    summary = defaultdict(lambda: {"fte_total": 0.0, "headcount_total": 0.0})
    for item in _compute_capacity_matches(conn, province_code=province_code, unit_id=unit_id, unit_name=unit_name):
        key = (item["province_code"], item.get("unit_id"), item.get("unit_name"), item["pp_function_code"], item["profession_code"])
        summary[key]["fte_total"] += item["matched_fte"]
        summary[key]["headcount_total"] += item["matched_headcount"]
        summary[key]["province_name_th"] = item["province_name_th"]
        summary[key]["unit_id"] = item.get("unit_id")
        summary[key]["unit_name"] = item.get("unit_name")
    rows = []
    for (province_code_value, unit_id_value, unit_name_value, function_code, profession_code), agg in sorted(summary.items()):
        function_meta = function_lookup.get(function_code, {})
        rows.append(
            {
                "province_code": province_code_value,
                "province_name_th": agg.get("province_name_th"),
                "unit_id": unit_id_value,
                "unit_name": unit_name_value,
                "pp_function_code": function_code,
                "function_name_th": function_meta.get("function_name_th"),
                "profession_code": profession_code,
                "profession_name_th": PROFESSION_LABELS.get(profession_code, profession_code),
                "fte_total": round(agg["fte_total"], 2),
                "headcount_total": round(agg["headcount_total"], 2),
            }
        )
    conn.close()
    return rows


def get_pp_unit_capacity_summary(
    province_code: str,
    unit_name: str,
    db_path: str | None = None,
) -> dict:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    function_lookup = {
        row["pp_function_code"]: row_to_dict(row)
        for row in conn.execute("SELECT * FROM pp_function_catalog").fetchall()
    }
    matches = _compute_capacity_matches(conn, province_code=province_code, unit_name=unit_name)
    summary_rows = get_pp_capacity_summary(province_code=province_code, unit_name=unit_name, db_path=db_path)
    grouped = {
        code: {
            "label": definition["label_th"],
            "note": definition["note_th"],
            "count": 0.0,
            "sql": render_pp_metric_sql(code),
            "rate_per": definition["rate_per"],
            "rate_unit_th": definition["rate_unit_th"],
            "source_rows": [],
        }
        for code, definition in PP_WORKFORCE_DICTIONARY.items()
    }

    source_maps: dict[str, dict] = {code: {} for code in PP_WORKFORCE_DICTIONARY}
    for match in matches:
        profession_code = match["profession_code"]
        if profession_code not in grouped:
            continue
        grouped[profession_code]["count"] += float(match["matched_headcount"] or 0)
        source_key = (
            match.get("position_name_th") or "",
            match.get("position_group_name") or "",
            match.get("specialist_name") or "ไม่ระบุสาขา",
        )
        source_bucket = source_maps[profession_code].setdefault(
            source_key,
            {
                "position_name_th": match.get("position_name_th") or "",
                "position_group_name": match.get("position_group_name") or "",
                "specialist_name": match.get("specialist_name") or "ไม่ระบุสาขา",
                "weighted_headcount": 0.0,
                "weighted_fte": 0.0,
                "matched_functions": set(),
            },
        )
        source_bucket["weighted_headcount"] += float(match["matched_headcount"] or 0)
        source_bucket["weighted_fte"] += float(match["matched_fte"] or 0)
        function_name = function_lookup.get(match["pp_function_code"], {}).get("function_name_th") or match["pp_function_code"]
        source_bucket["matched_functions"].add(function_name)

    audit_trail = {}
    for profession_code, payload in grouped.items():
        source_rows = []
        for row in sorted(
            source_maps[profession_code].values(),
            key=lambda item: (-item["weighted_headcount"], -item["weighted_fte"], item["position_name_th"]),
        ):
            source_rows.append(
                {
                    "position_name_th": row["position_name_th"],
                    "position_group_name": row["position_group_name"],
                    "specialist_name": row["specialist_name"],
                    "count": round(row["weighted_headcount"], 2),
                    "fte": round(row["weighted_fte"], 2),
                    "matched_functions": sorted(row["matched_functions"]),
                }
            )
        audit_trail[profession_code] = {
            "label": payload["label"],
            "note": payload["note"],
            "count": round(payload["count"], 2),
            "sql": payload["sql"],
            "rate_per": payload["rate_per"],
            "rate_unit_th": payload["rate_unit_th"],
            "source_rows": source_rows,
        }

    conn.close()
    pp_benchmarks = get_benchmark_lookup("pp_profession", db_path=db_path)
    return {
        "province_code": province_code,
        "unit_name": unit_name,
        "capacity": summary_rows,
        "total_capacity_fte": round(sum(float(item["fte_total"] or 0) for item in summary_rows), 2),
        "total_capacity_headcount": round(sum(float(item["headcount_total"] or 0) for item in summary_rows), 2),
        "audit_trail": audit_trail,
        "dictionary": PP_WORKFORCE_DICTIONARY,
        "benchmarks": pp_benchmarks,
    }


def _get_latest_year(conn: sqlite3.Connection, province_code: str | None = None) -> int | None:
    sql = "SELECT MAX(year_be) AS max_year FROM fact_pp_outcome_district"
    params = []
    if province_code:
        sql += " WHERE province_code = ?"
        params.append(province_code)
    row = conn.execute(sql, params).fetchone()
    return row["max_year"] if row and row["max_year"] else None


def _is_off_target(value_num, good_direction, target_value) -> bool:
    if value_num is None or target_value is None or not good_direction:
        return False
    if good_direction == "high":
        return float(value_num) < float(target_value)
    if good_direction == "low":
        return float(value_num) > float(target_value)
    return False


def get_pp_outcome_summary(province_code: str, year_be: int | None = None, db_path: str | None = None, shortlist_only: bool = True) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    selected_year = year_be or _get_latest_year(conn, province_code=province_code)
    if selected_year is None:
        conn.close()
        return []
    policy_lookup = get_indicator_policy_lookup(db_path=db_path)
    shortlist_join = "LEFT JOIN pp_indicator_strategy_map s ON s.indicator_code = c.indicator_code"
    shortlist_filter = ""
    params = [province_code, selected_year]
    if shortlist_only:
        shortlist_filter = " AND s.phase_code = 'phase1' AND s.is_shortlist = 1"
    rows = conn.execute(
        f"""
        SELECT
            c.indicator_code, c.indicator_name_th, c.subcatalog_name_th, c.good_direction, c.target_value,
            s.domain_code, s.domain_name_th, s.age_group_focus, s.extraction_priority,
            COUNT(*) AS district_count,
            AVG(f.value_num) AS average_value,
            SUM(
                CASE
                    WHEN c.target_value IS NULL OR f.value_num IS NULL THEN 0
                    WHEN c.good_direction = 'high' AND f.value_num < c.target_value THEN 1
                    WHEN c.good_direction = 'low' AND f.value_num > c.target_value THEN 1
                    ELSE 0
                END
            ) AS off_target_districts
        FROM fact_pp_outcome_district f
        JOIN pp_indicator_catalog c ON c.indicator_code = f.indicator_code
        {shortlist_join}
        WHERE f.province_code = ?
          AND f.year_be = ?
          AND f.display_level IN ('ampur', 'district')
          {shortlist_filter}
        GROUP BY c.indicator_code, c.indicator_name_th, c.subcatalog_name_th, c.good_direction, c.target_value,
                 s.domain_code, s.domain_name_th, s.age_group_focus, s.extraction_priority
        ORDER BY COALESCE(s.extraction_priority, 999), off_target_districts DESC, c.subcatalog_name_th, c.indicator_name_th
        """,
        params,
    ).fetchall()
    conn.close()
    return _filter_indicator_rows(
        [row_to_dict(row) for row in rows],
        policy_lookup,
        field_name="include_in_outcome_validation",
        shortlist_only=shortlist_only,
    )


def get_pp_amphur_outcome_summary(
    province_code: str,
    amphur_code: str,
    year_be: int | None = None,
    db_path: str | None = None,
    shortlist_only: bool = True,
) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    selected_year = year_be or _get_latest_year(conn, province_code=province_code)
    if selected_year is None:
        conn.close()
        return []
    policy_lookup = get_indicator_policy_lookup(db_path=db_path)
    shortlist_join = "LEFT JOIN pp_indicator_strategy_map s ON s.indicator_code = c.indicator_code"
    shortlist_filter = ""
    params = [province_code, amphur_code, selected_year]
    if shortlist_only:
        shortlist_filter = " AND s.phase_code = 'phase1' AND s.is_shortlist = 1"
    rows = conn.execute(
        f"""
        SELECT
            c.indicator_code, c.indicator_name_th, c.subcatalog_name_th, c.good_direction, c.target_value, c.unit,
            s.domain_code, s.domain_name_th, s.age_group_focus, s.extraction_priority,
            COUNT(*) AS fact_count,
            AVG(f.value_num) AS value_num,
            MAX(COALESCE(f.amphur_name, f.location_key)) AS amphur_name
        FROM fact_pp_outcome_district f
        JOIN pp_indicator_catalog c ON c.indicator_code = f.indicator_code
        {shortlist_join}
        WHERE f.province_code = ?
          AND f.amphur_code = ?
          AND f.year_be = ?
          AND f.display_level IN ('ampur', 'district')
          {shortlist_filter}
        GROUP BY c.indicator_code, c.indicator_name_th, c.subcatalog_name_th, c.good_direction, c.target_value, c.unit,
                 s.domain_code, s.domain_name_th, s.age_group_focus, s.extraction_priority
        ORDER BY COALESCE(s.extraction_priority, 999), c.subcatalog_name_th, c.indicator_name_th
        """,
        params,
    ).fetchall()
    conn.close()
    output = []
    filtered_rows = _filter_indicator_rows(
        [row_to_dict(row) for row in rows],
        policy_lookup,
        field_name="include_in_outcome_validation",
        shortlist_only=shortlist_only,
    )
    for item in filtered_rows:
        item["is_off_target"] = _is_off_target(item.get("value_num"), item.get("good_direction"), item.get("target_value"))
        output.append(item)
    return output


def get_pp_district_summary(province_code: str, year_be: int | None = None, db_path: str | None = None, shortlist_only: bool = True) -> list[dict]:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    selected_year = year_be or _get_latest_year(conn, province_code=province_code)
    if selected_year is None:
        conn.close()
        return []
    policy_lookup = get_indicator_policy_lookup(db_path=db_path)

    capacity_rows = get_pp_capacity_summary(province_code=province_code, db_path=db_path)
    function_prof_capacity = defaultdict(float)
    for item in capacity_rows:
        function_prof_capacity[(item["pp_function_code"], item["profession_code"])] += float(item["fte_total"] or 0)

    strategy_rows = conn.execute(
        """
        SELECT indicator_code, domain_code, domain_name_th, extraction_priority
        FROM pp_indicator_strategy_map
        WHERE phase_code = 'phase1' AND is_shortlist = 1
        """
    ).fetchall()
    strategy_by_indicator = {row["indicator_code"]: row_to_dict(row) for row in strategy_rows}

    map_rows = [row_to_dict(row) for row in conn.execute("SELECT * FROM pp_indicator_workforce_map").fetchall()]
    maps_by_indicator = defaultdict(list)
    for item in map_rows:
        maps_by_indicator[item["indicator_code"]].append(item)

    rows = conn.execute(
        """
        SELECT
            f.indicator_code, c.indicator_name_th, c.good_direction, c.target_value,
            f.amphur_code, COALESCE(f.amphur_name, f.location_key) AS amphur_name,
            f.value_num
        FROM fact_pp_outcome_district f
        JOIN pp_indicator_catalog c ON c.indicator_code = f.indicator_code
        WHERE f.province_code = ?
          AND f.year_be = ?
          AND f.display_level IN ('ampur', 'district')
        ORDER BY f.amphur_code, c.indicator_name_th
        """,
        (province_code, selected_year),
    ).fetchall()
    conn.close()

    districts = defaultdict(
        lambda: {
            "off_target_indicator_count": 0,
            "off_target_indicators": [],
            "domains": set(),
            "recommendations": defaultdict(
                lambda: {
                    "urgency_score": 0.0,
                    "linked_indicators": set(),
                    "linked_functions": set(),
                }
            ),
        }
    )

    for row in rows:
        row = row_to_dict(row)
        strategy = strategy_by_indicator.get(row["indicator_code"])
        if not _policy_allows_indicator(row["indicator_code"], policy_lookup, "include_in_recommendation"):
            continue
        if shortlist_only and not _policy_allows_indicator(row["indicator_code"], policy_lookup, "include_in_phase1"):
            continue
        if shortlist_only and not strategy:
            continue
        if not _is_off_target(row.get("value_num"), row.get("good_direction"), row.get("target_value")):
            continue
        policy = policy_lookup.get(row["indicator_code"], {})
        district = districts[(row.get("amphur_code") or "", row.get("amphur_name") or "????????????")]
        district["off_target_indicator_count"] += 1
        district["off_target_indicators"].append(
            {
                "indicator_code": row["indicator_code"],
                "indicator_name_th": row["indicator_name_th"],
                "value_num": row.get("value_num"),
                "target_value": row.get("target_value"),
                "domain_code": strategy.get("domain_code") if strategy else None,
                "domain_name_th": strategy.get("domain_name_th") if strategy else None,
                "policy_note": policy.get("policy_note"),
                "private_sector_bias_flag": int(policy.get("private_sector_bias_flag") or 0),
            }
        )
        if strategy and strategy.get("domain_name_th"):
            district["domains"].add(strategy["domain_name_th"])
        for mapping in maps_by_indicator.get(row["indicator_code"], []):
            current_capacity = function_prof_capacity.get((mapping["pp_function_code"], mapping["profession_code"]), 0.0)
            urgency_delta = float(mapping.get("contribution_weight") or 1.0) / max(current_capacity, 0.5)
            rec = district["recommendations"][mapping["profession_code"]]
            rec["profession_code"] = mapping["profession_code"]
            rec["profession_name_th"] = PROFESSION_LABELS.get(mapping["profession_code"], mapping["profession_code"])
            rec["urgency_score"] += urgency_delta
            rec["linked_indicators"].add(row["indicator_name_th"])
            rec["linked_functions"].add(mapping["pp_function_code"])

    output = []
    for (amphur_code, amphur_name), item in districts.items():
        recommendation_rows = []
        for rec in item["recommendations"].values():
            recommendation_rows.append(
                {
                    "profession_code": rec["profession_code"],
                    "profession_name_th": rec["profession_name_th"],
                    "urgency_score": round(rec["urgency_score"], 2),
                    "linked_indicators": sorted(rec["linked_indicators"]),
                    "linked_functions": sorted(rec["linked_functions"]),
                }
            )
        recommendation_rows.sort(key=lambda value: value["urgency_score"], reverse=True)
        output.append(
            {
                "amphur_code": amphur_code,
                "amphur_name": amphur_name,
                "off_target_indicator_count": item["off_target_indicator_count"],
                "domains": sorted(item["domains"]),
                "off_target_indicators": item["off_target_indicators"],
                "recommendations": recommendation_rows[:5],
            }
        )
    output.sort(key=lambda value: value["off_target_indicator_count"], reverse=True)
    return output


def get_pp_province_summary(province_code: str, year_be: int | None = None, db_path: str | None = None, shortlist_only: bool = True) -> dict:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    latest_year = year_be or _get_latest_year(conn, province_code=province_code)
    province_row = conn.execute(
        "SELECT province_code, province_name_th FROM provinces WHERE province_code = ?",
        (province_code,),
    ).fetchone()
    province_name_th = province_row["province_name_th"] if province_row else province_code
    function_lookup = {
        row["pp_function_code"]: row_to_dict(row)
        for row in conn.execute("SELECT * FROM pp_function_catalog").fetchall()
    }
    map_rows = [row_to_dict(row) for row in conn.execute("SELECT * FROM pp_indicator_workforce_map").fetchall()]
    conn.close()

    capacity_rows = get_pp_capacity_summary(province_code=province_code, db_path=db_path)
    outcome_rows = get_pp_outcome_summary(province_code=province_code, year_be=latest_year, db_path=db_path, shortlist_only=shortlist_only)
    district_rows = get_pp_district_summary(province_code=province_code, year_be=latest_year, db_path=db_path, shortlist_only=shortlist_only)
    pp_benchmarks = get_benchmark_lookup("pp_profession", db_path=db_path)
    expected_indicator_count = get_phase1_indicator_count(db_path=db_path) if shortlist_only else len(outcome_rows)

    function_prof_capacity = defaultdict(float)
    for item in capacity_rows:
        function_prof_capacity[(item["pp_function_code"], item["profession_code"])] += float(item["fte_total"] or 0)
    maps_by_indicator = defaultdict(list)
    for item in map_rows:
        maps_by_indicator[item["indicator_code"]].append(item)

    recommendations = defaultdict(lambda: {"urgency_score": 0.0, "linked_indicators": set(), "linked_functions": set(), "reason_parts": []})
    for outcome in outcome_rows:
        district_gap = int(outcome.get("off_target_districts") or 0)
        if district_gap <= 0:
            continue
        for mapping in maps_by_indicator.get(outcome["indicator_code"], []):
            current_capacity = function_prof_capacity.get((mapping["pp_function_code"], mapping["profession_code"]), 0.0)
            urgency_delta = district_gap * float(mapping.get("contribution_weight") or 1.0) / max(current_capacity, 0.5)
            rec = recommendations[mapping["profession_code"]]
            rec["profession_code"] = mapping["profession_code"]
            rec["profession_name_th"] = PROFESSION_LABELS.get(mapping["profession_code"], mapping["profession_code"])
            rec["urgency_score"] += urgency_delta
            rec["linked_indicators"].add(outcome["indicator_name_th"])
            rec["linked_functions"].add(function_lookup.get(mapping["pp_function_code"], {}).get("function_name_th") or mapping["pp_function_code"])
            rec["reason_parts"].append(f"{outcome['indicator_name_th']} off-target {district_gap} ????? | capacity {current_capacity:.2f} FTE")

    recommendation_rows = []
    for rec in recommendations.values():
        benchmark = pp_benchmarks.get(rec["profession_code"], {})
        recommendation_rows.append(
            {
                "profession_code": rec["profession_code"],
                "profession_name_th": rec["profession_name_th"],
                "urgency_score": round(rec["urgency_score"], 2),
                "linked_indicators": sorted(rec["linked_indicators"]),
                "linked_functions": sorted(rec["linked_functions"]),
                "reason": "; ".join(rec["reason_parts"][:3]),
                "benchmark": benchmark,
            }
        )
    recommendation_rows.sort(key=lambda item: item["urgency_score"], reverse=True)

    confidence = compute_pp_confidence_summary(
        scope_population_source="province_hdc_summary",
        reference_year=latest_year,
        scope_type="province",
        observed_indicator_count=len({item["indicator_code"] for item in outcome_rows}),
        expected_indicator_count=expected_indicator_count,
        audit_available=bool(capacity_rows),
    )

    return {
        "province_code": province_code,
        "province_name_th": province_name_th,
        "year_be": latest_year,
        "data_status": {
            "indicator_count": len({item["indicator_code"] for item in outcome_rows}),
            "district_fact_count": sum(int(item.get("district_count") or 0) for item in outcome_rows),
            "capacity_rows": len(capacity_rows),
            "total_capacity_fte": round(sum(float(item["fte_total"] or 0) for item in capacity_rows), 2),
            "off_target_districts": len(district_rows),
            "shortlist_only": shortlist_only,
            "expected_indicator_count": expected_indicator_count,
        },
        "capacity": capacity_rows,
        "outcomes": outcome_rows,
        "districts": district_rows[:12],
        "recommendations": recommendation_rows[:8],
        "dictionary": PP_WORKFORCE_DICTIONARY,
        "benchmarks": pp_benchmarks,
        "confidence": confidence,
    }


def get_pp_amphur_summary(
    province_code: str,
    amphur_code: str,
    unit_name: str,
    amphur_name: str | None = None,
    year_be: int | None = None,
    db_path: str | None = None,
    shortlist_only: bool = True,
) -> dict:
    build_pp_schema(db_path)
    conn = get_connection(db_path)
    latest_year = year_be or _get_latest_year(conn, province_code=province_code)
    province_row = conn.execute(
        "SELECT province_code, province_name_th FROM provinces WHERE province_code = ?",
        (province_code,),
    ).fetchone()
    province_name_th = province_row["province_name_th"] if province_row else province_code
    function_lookup = {
        row["pp_function_code"]: row_to_dict(row)
        for row in conn.execute("SELECT * FROM pp_function_catalog").fetchall()
    }
    map_rows = [row_to_dict(row) for row in conn.execute("SELECT * FROM pp_indicator_workforce_map").fetchall()]
    conn.close()

    unit_capacity = get_pp_unit_capacity_summary(province_code=province_code, unit_name=unit_name, db_path=db_path)
    outcome_rows = get_pp_amphur_outcome_summary(
        province_code=province_code,
        amphur_code=amphur_code,
        year_be=latest_year,
        db_path=db_path,
        shortlist_only=shortlist_only,
    )
    maps_by_indicator = defaultdict(list)
    for item in map_rows:
        maps_by_indicator[item["indicator_code"]].append(item)
    function_prof_capacity = defaultdict(float)
    for item in unit_capacity["capacity"]:
        function_prof_capacity[(item["pp_function_code"], item["profession_code"])] += float(item["fte_total"] or 0)

    recommendations = defaultdict(
        lambda: {
            "urgency_score": 0.0,
            "linked_indicators": set(),
            "linked_functions": set(),
            "reason_parts": [],
        }
    )
    for outcome in outcome_rows:
        if not outcome.get("is_off_target"):
            continue
        for mapping in maps_by_indicator.get(outcome["indicator_code"], []):
            current_capacity = function_prof_capacity.get((mapping["pp_function_code"], mapping["profession_code"]), 0.0)
            urgency_delta = float(mapping.get("contribution_weight") or 1.0) / max(current_capacity, 0.5)
            rec = recommendations[mapping["profession_code"]]
            rec["profession_code"] = mapping["profession_code"]
            rec["profession_name_th"] = PROFESSION_LABELS.get(mapping["profession_code"], mapping["profession_code"])
            rec["urgency_score"] += urgency_delta
            rec["linked_indicators"].add(outcome["indicator_name_th"])
            rec["linked_functions"].add(function_lookup.get(mapping["pp_function_code"], {}).get("function_name_th") or mapping["pp_function_code"])
            rec["reason_parts"].append(
                f"{outcome['indicator_name_th']} value {float(outcome.get('value_num') or 0):.2f} target {float(outcome.get('target_value') or 0):.2f} | capacity {current_capacity:.2f} FTE"
            )

    pp_benchmarks = get_benchmark_lookup("pp_profession", db_path=db_path)
    recommendation_rows = []
    for rec in recommendations.values():
        benchmark = pp_benchmarks.get(rec["profession_code"], {})
        recommendation_rows.append(
            {
                "profession_code": rec["profession_code"],
                "profession_name_th": rec["profession_name_th"],
                "urgency_score": round(rec["urgency_score"], 2),
                "linked_indicators": sorted(rec["linked_indicators"]),
                "linked_functions": sorted(rec["linked_functions"]),
                "reason": "; ".join(rec["reason_parts"][:3]),
                "benchmark": benchmark,
            }
        )
    recommendation_rows.sort(key=lambda item: item["urgency_score"], reverse=True)

    off_target_rows = [item for item in outcome_rows if item.get("is_off_target")]
    expected_indicator_count = get_phase1_indicator_count(db_path=db_path) if shortlist_only else len(outcome_rows)
    confidence = compute_pp_confidence_summary(
        scope_population_source="unknown",
        reference_year=latest_year,
        scope_type="amphur",
        observed_indicator_count=len({item["indicator_code"] for item in outcome_rows}),
        expected_indicator_count=expected_indicator_count,
        audit_available=bool(unit_capacity.get("audit_trail")),
    )
    return {
        "province_code": province_code,
        "province_name_th": province_name_th,
        "amphur_code": amphur_code,
        "amphur_name": amphur_name or (outcome_rows[0]["amphur_name"] if outcome_rows else amphur_code),
        "unit_name": unit_name,
        "year_be": latest_year,
        "scope_type": "amphur",
        "data_status": {
            "indicator_count": len({item["indicator_code"] for item in outcome_rows}),
            "fact_count": sum(int(item.get("fact_count") or 0) for item in outcome_rows),
            "off_target_indicator_count": len(off_target_rows),
            "capacity_rows": len(unit_capacity["capacity"]),
            "total_capacity_fte": unit_capacity["total_capacity_fte"],
            "total_capacity_headcount": unit_capacity["total_capacity_headcount"],
            "shortlist_only": shortlist_only,
            "expected_indicator_count": expected_indicator_count,
        },
        "capacity": unit_capacity["capacity"],
        "audit_trail": unit_capacity["audit_trail"],
        "dictionary": PP_WORKFORCE_DICTIONARY,
        "benchmarks": pp_benchmarks,
        "outcomes": outcome_rows,
        "recommendations": recommendation_rows[:8],
        "confidence": confidence,
    }


if __name__ == "__main__":
    build_pp_schema()
    print(
        json.dumps(
            {
                "catalog_count": len(list_pp_catalog()),
                "crosswalk_count": len(list_pp_crosswalk()),
                "capacity_rows": len(get_pp_capacity_summary()),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
