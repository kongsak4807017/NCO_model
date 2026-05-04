HR_WORKFORCE_DICTIONARY = {
    "doctor_total": {
        "label_th": "แพทย์ทั้งหมด",
        "note_th": "นับเฉพาะ position_name_th = นายแพทย์",
        "exact_position_names": ["นายแพทย์"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "nurse_total": {
        "label_th": "พยาบาลทั้งหมด",
        "note_th": "นับเฉพาะ position_name_th = พยาบาลวิชาชีพ และ พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข",
        "exact_position_names": ["พยาบาลวิชาชีพ", "พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "pharmacist_total": {
        "label_th": "เภสัชกรทั้งหมด",
        "note_th": "นับเฉพาะ position_name_th = เภสัชกร",
        "exact_position_names": ["เภสัชกร"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "physical_therapist_total": {
        "label_th": "นักกายภาพบำบัด",
        "note_th": "นับเฉพาะ position_name_th = นักกายภาพบำบัด",
        "exact_position_names": ["นักกายภาพบำบัด"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "psychologist_total": {
        "label_th": "นักจิตวิทยา",
        "note_th": "นับเฉพาะ position_name_th = นักจิตวิทยา",
        "exact_position_names": ["นักจิตวิทยา"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
    "clinical_psychologist_total": {
        "label_th": "นักจิตวิทยาคลินิก",
        "note_th": "นับเฉพาะ position_name_th = นักจิตวิทยาคลินิก",
        "exact_position_names": ["นักจิตวิทยาคลินิก"],
        "rate_per": 10000,
        "rate_unit_th": "คน/หมื่นปชก.",
    },
}


def render_metric_sql(metric_code: str) -> str:
    definition = HR_WORKFORCE_DICTIONARY[metric_code]
    quoted = ", ".join("'" + name.replace("'", "''") + "'" for name in definition["exact_position_names"])
    return (
        "WITH active_positions AS ("
        " SELECT p.position_name_th, p.position_group_name,"
        " COALESCE(NULLIF(TRIM(p.position_specialist_name), ''), 'ไม่ระบุสาขา') AS specialist_name,"
        " COUNT(DISTINCT a.personnel_id) AS headcount"
        " FROM assignment a"
        " JOIN position p ON p.position_id = a.position_id"
        " WHERE p.unit_id = :unit_id"
        "   AND a.status = 'active'"
        "   AND (a.end_date IS NULL OR a.end_date = '')"
        " GROUP BY p.position_name_th, p.position_group_name,"
        "          COALESCE(NULLIF(TRIM(p.position_specialist_name), ''), 'ไม่ระบุสาขา')"
        ")"
        f" SELECT position_name_th, position_group_name, specialist_name, headcount FROM active_positions WHERE TRIM(position_name_th) IN ({quoted})"
        " ORDER BY headcount DESC, position_name_th, position_group_name;"
    )
