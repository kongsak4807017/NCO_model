"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { data: null, province: "all" };
  const fmt = (v) => v == null ? "—" : Number(v).toLocaleString("th-TH");
  const setStatus = (text) => { $("status").textContent = text; };
  const cell = (row, text) => { const td = row.insertCell(); td.textContent = String(text ?? "—"); return td; };
  const clear = (node) => node.replaceChildren();
  const option = (value, text) => { const o = document.createElement("option"); o.value = value; o.textContent = text; return o; };
  const validate = (data) => {
    if (data?.schema_version !== "nco-physician-region1-aggregate-v1" ||
        !Array.isArray(data.provinces) || !Array.isArray(data.hospitals) ||
        data.privacy !== "aggregate_only_private_review") {
      throw Error("ไฟล์ไม่ใช่ผลสรุป Region 1 Physician Specialty ที่ผ่านตัวส่งออกของโครงการ");
    }
    return data;
  };
  function render() {
    const data = state.data; if (!data) return;
    $("source").textContent = data.source + " | " + data.year_be + " | " + data.provenance;
    $("uniqueDoctors").textContent = fmt(data.region.unique_doctors);
    $("hospitalCount").textContent = fmt(data.region.hospitals);
    $("mapped").textContent = fmt(data.region.mapped_assignments);
    $("verification").textContent = "ยังไม่ยืนยันจากแพทยสภา";
    const provinceSelect = $("province");
    const previous = provinceSelect.value || "all";
    clear(provinceSelect);
    provinceSelect.append(option("all", "ทุกจังหวัด (8 จังหวัด)"));
    for (const p of data.provinces) provinceSelect.append(option(p.province_code, p.province_name));
    provinceSelect.value = [...provinceSelect.options].some(x => x.value === previous) ? previous : "all";
    state.province = provinceSelect.value;
    const provincesBody = $("provinces").querySelector("tbody");
    clear(provincesBody);
    for (const p of data.provinces) {
      const tr = provincesBody.insertRow();
      [p.province_name, fmt(p.unique_doctors), fmt(p.hospitals),
       fmt(p.hospital_assignments), fmt(p.mapped_assignments), fmt(p.unmapped_assignments),
       p.specialties.slice(0, 3).map(s=>s.specialty_name+" ("+fmt(s.unique_headcount)+")").join(", ") || "ยังไม่มีข้อมูลสาขา"
      ].forEach(x => cell(tr,x));
    }
    drawHospitals();
  }
  function drawHospitals() {
    const data = state.data; if (!data) return;
    const query = $("search").value.trim().toLocaleLowerCase();
    const province = $("province").value;
    const filtered = data.hospitals.filter(h => (province === "all" || h.province_code === province)
      && (!query || [h.unit_name,h.hospital_code,h.province_name,
          ...h.specialties.map(x=>x.specialty_name)].join(" ").toLocaleLowerCase().includes(query)));
    const body = $("hospitals").querySelector("tbody"); clear(body);
    for (const h of filtered) {
      const tr = body.insertRow();
      [h.province_name,h.hospital_code||"ไม่มี HCODE",h.unit_name,fmt(h.total_doctors),
        fmt(h.mapped_doctors),fmt(h.unmapped_doctors+h.missing_specialty_doctors+h.conflict_doctors),
        h.specialties.map(s=>s.specialty_name+" "+fmt(s.headcount)+" คน"+(s.credential_proxy_mapped?" [วุฒิแทนตำแหน่ง]":"")).join(" · ") || "ไม่พบสาขาที่จับคู่ได้"
      ].forEach(x=>cell(tr,x));
    }
    $("visible").textContent="แสดงหน่วยบริการ "+fmt(filtered.length)+" แห่ง";
  }
  function ingest(json, name) {
    state.data=validate(json);
    render();
    setStatus("เปิดข้อมูลจาก "+name+" แล้ว — ใช้เพื่อทวนสอบภายในเท่านั้น ตัวเลขยังไม่ได้ตรวจสอบวุฒิบัตรจากแพทยสภา");
  }
  $("file").addEventListener("change", async (ev) => {
    const f=ev.target.files?.[0]; if (!f) return;
    try { ingest(JSON.parse(await f.text()), f.name); }
    catch(e) { setStatus("เปิดข้อมูลไม่ได้: "+e.message); }
  });
  $("province").addEventListener("change", drawHospitals);
  $("search").addEventListener("input", drawHospitals);
  // Approved, aggregated, non-personal publication may be hosted later by a system owner.
  // Absence is expected: the source HR database is not in the public repository.
  fetch("output/region1_physician_specialty_approved.json",{cache:"no-store"})
    .then(async res => { if (!res.ok) throw Error("no approved aggregate"); ingest(await res.json(),"ข้อมูลที่ได้รับอนุมัติ"); })
    .catch(() => setStatus("ยังไม่มีข้อมูลอัตรากำลังแยกสาขาจากฐานจริงบนเว็บสาธารณะ กรุณารันตัวส่งออกกับฐาน HR ภายใน แล้วเปิดไฟล์ JSON ที่ได้ในหน้านี้"));
})();
