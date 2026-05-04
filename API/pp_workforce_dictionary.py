PP_WORKFORCE_DICTIONARY = {
    "FAM_MD": {
        "label_th": "แพทย์เวชศาสตร์ครอบครัว",
        "note_th": "นับจากตำแหน่งนายแพทย์ที่มี specialist = เวชศาสตร์ครอบครัว และ crosswalk กลุ่มงานเวชปฏิบัติครอบครัว/เวชกรรมสังคม โดยไม่รวม fallback priority >= 60",
        "profession_code": "FAM_MD",
        "display_order": 1,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "RN": {
        "label_th": "พยาบาลวิชาชีพ",
        "note_th": "นับจากตำแหน่งพยาบาลวิชาชีพ และพยาบาลวิชาชีพ/นักวิชาการสาธารณสุข ที่ถูก map เข้าฟังก์ชันส่งเสริมป้องกันตาม crosswalk กลุ่มงาน",
        "profession_code": "RN",
        "display_order": 2,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "PH_ACAD": {
        "label_th": "นักวิชาการสาธารณสุข",
        "note_th": "นับจากตำแหน่งนักวิชาการสาธารณสุข และตำแหน่งผสมที่ถูก map เข้าฟังก์ชันส่งเสริมสุขภาพ ควบคุมโรค ปฐมภูมิ และบริหารสาธารณสุข",
        "profession_code": "PH_ACAD",
        "display_order": 3,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "PH_OFFICER": {
        "label_th": "นักสาธารณสุข / เจ้าพนักงานสาธารณสุข",
        "note_th": "นับจากตำแหน่งนักสาธารณสุข และเจ้าพนักงานสาธารณสุข ที่ถูก map เข้าฟังก์ชันบริการชุมชน ป้องกันควบคุมโรค และ primary care",
        "profession_code": "PH_OFFICER",
        "display_order": 4,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "PSY": {
        "label_th": "นักจิตวิทยา",
        "note_th": "นับจากตำแหน่งนักจิตวิทยาที่ถูก map เข้าฟังก์ชัน mental health / suicide prevention ตาม crosswalk PP",
        "profession_code": "PSY",
        "display_order": 5,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "CPSY": {
        "label_th": "นักจิตวิทยาคลินิก",
        "note_th": "นับจากตำแหน่งนักจิตวิทยาคลินิกที่ถูก map เข้าฟังก์ชัน mental outcome / high-risk case ตาม crosswalk PP",
        "profession_code": "CPSY",
        "display_order": 6,
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
}


PP_PROFESSION_LABELS = {
    code: item["label_th"]
    for code, item in PP_WORKFORCE_DICTIONARY.items()
}
PP_PROFESSION_LABELS["PT"] = "นักกายภาพบำบัด"


def render_pp_metric_sql(metric_code: str) -> str:
    definition = PP_WORKFORCE_DICTIONARY[metric_code]
    profession_code = definition["profession_code"]
    return (
        "WITH active_positions AS ("
        " SELECT"
        "   p.position_id, p.position_name_th, p.position_group_name, p.position_specialist_name,"
        "   ou.unit_id, ou.unit_name, ou.unit_type_label, ou.province_code,"
        "   COALESCE(SUM(CASE"
        "     WHEN a.status = 'active' AND (a.end_date IS NULL OR a.end_date = '')"
        "     THEN COALESCE(a.fte_percentage, 100.0) / 100.0"
        "     ELSE 0"
        "   END), 0) AS assigned_fte,"
        "   COUNT(DISTINCT CASE"
        "     WHEN a.status = 'active' AND (a.end_date IS NULL OR a.end_date = '') THEN a.personnel_id"
        "   END) AS headcount"
        " FROM position p"
        " JOIN organizational_unit ou ON ou.unit_id = p.unit_id"
        " LEFT JOIN assignment a ON a.position_id = p.position_id"
        " WHERE ou.province_code = :province_code"
        "   AND ou.unit_name = :unit_name"
        " GROUP BY p.position_id, p.position_name_th, p.position_group_name, p.position_specialist_name,"
        "          ou.unit_id, ou.unit_name, ou.unit_type_label, ou.province_code"
        "), crosswalk AS ("
        " SELECT pp_function_code, profession_code, match_type, source_position_group_name,"
        "        source_position_name_th, source_specialist_keyword, source_unit_type_label, priority, weight"
        " FROM pp_position_group_crosswalk"
        f" WHERE is_active = 1 AND profession_code = '{profession_code}' AND priority < 60"
        ")"
        " SELECT * FROM active_positions;"
        " -- crosswalk matching and profession filtering are applied in application code"
        " -- via _matches_crosswalk() and _position_matches_profession() after loading active_positions + crosswalk."
    )
