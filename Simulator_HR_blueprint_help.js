(() => {
  "use strict";

  const D = window.NCO_HR_DATA_DICTIONARY || { helpItems: {} };
  const ACTIVITY_HELP_KEYS = ["activity-opdVisits", "activity-ipdAdmissions", "activity-erVisits", "activity-procedures", "activity-deliveries", "activity-chronicVisits", "activity-mentalVisits", "activity-outreachVisits"];

  const BASE_HELP_ITEMS = [
    { key:"scenario", title:"ชื่อ Scenario", category:"1. Historical Workspace", aliases:["ชื่อ Scenario"], definition:"ชื่อชุดวิเคราะห์ข้อมูลจริงย้อนหลัง ใช้แยกพื้นที่/รอบการทบทวนข้อมูล ไม่ได้หมายถึงการพยากรณ์อนาคต", unit:"ข้อความ", source:"ผู้วิเคราะห์กำหนด", example:"HR Blueprint 5Y Historical Actual", origin:"input" },
    { key:"start-year", title:"ปีอ้างอิงล่าสุด (พ.ศ.)", category:"1. Historical Workspace", aliases:["ปีอ้างอิงล่าสุด (พ.ศ.)","ปีเริ่มต้น (พ.ศ.)"], definition:"ปีข้อมูลจริงล่าสุดของชุดย้อนหลัง 5 ปี ระบบเรียงปีถอยหลังจากปีนี้", unit:"พ.ศ.", source:"ปีข้อมูลจริงที่ใช้ร่วมกัน", example:"2569 → วิเคราะห์ 2569–2565", origin:"input" },
    { key:"year-count", title:"จำนวนปี", category:"1. Historical Workspace", aliases:["จำนวนปี"], definition:"จำนวนปีข้อมูลย้อนหลังในโหมดนี้ ถูกกำหนดไว้ 5 ปี", unit:"ปี", source:"ระบบ", example:"5", origin:"input" },
    { key:"province", title:"จังหวัด", category:"2. Scope", aliases:["จังหวัด"], definition:"จังหวัดอ้างอิงของชุดข้อมูล", unit:"จังหวัด", source:"baseline ในระบบ/ข้อมูลพื้นที่", example:"เชียงราย", origin:"input" },
    { key:"district", title:"อำเภอ", category:"2. Scope", aliases:["อำเภอ","อำเภอจากฐานข้อมูล","ชื่ออำเภอ / แก้ไขเอง"], definition:"อำเภอที่ใช้กำหนดขอบเขตวิเคราะห์ ระบบใช้ district baseline เฉพาะข้อมูลที่มีจริง; ค่าที่ไม่มีจะไม่คัดลอกจากจังหวัด", unit:"พื้นที่", source:"district directory + ข้อมูลพื้นที่ที่ทวนสอบ", example:"แม่สาย", caution:"ถ้าไม่มี population/HR ระดับอำเภอจริง ให้เว้น/กรอกข้อมูลจริงเอง ไม่เฉลี่ยจากจังหวัด", origin:"input" },
    { key:"unit", title:"โรงพยาบาล/หน่วยบริการ", category:"2. Scope", aliases:["โรงพยาบาล/หน่วยบริการ"], definition:"หน่วยบริการเป้าหมายของการวิเคราะห์", unit:"ชื่อหน่วยบริการ", source:"ผู้ใช้ระบุ", example:"รพ.แม่สาย", origin:"input" },
    { key:"scope-mode", title:"ระดับการคำนวณ", category:"2. Scope", aliases:["ระดับการคำนวณ"], definition:"ระดับพื้นที่ของชุดข้อมูล: จังหวัด อำเภอ โรงพยาบาล หรือเครือข่ายบริการ", unit:"ระดับพื้นที่", source:"ผู้วิเคราะห์", example:"โรงพยาบาล", origin:"input" },
    { key:"population", title:"ประชากรรับผิดชอบ / Service Population", category:"3. Baseline / 5. Workload", aliases:["Population","ประชากรปีอ้างอิงล่าสุด","Service Population"], definition:"ประชากรจริงของขอบเขตที่วิเคราะห์ในปีนั้น ใช้เป็นข้อมูลอ้างอิงพื้นที่; historical workload และ target need ต้องกรอกจากข้อมูลจริงแยกต่างหาก", unit:"คน", source:"HDC / ทะเบียนราษฎร์ / ทะเบียนสิทธิ / catchment", example:"85,000 คน", caution:"ระบบไม่สร้าง workload ย้อนหลังจาก population", origin:"input" },
    { key:"vacancy", title:"Vacancy", category:"3. Baseline / 4. Profession", aliases:["Vacancy","Vacancy ทั้งหมด"], definition:"จำนวนตำแหน่งตามกรอบที่ยังไม่มีผู้ครองตำแหน่ง ณ จุดเวลาอ้างอิง", unit:"ตำแหน่ง", source:"HRIS/HROPS/กรอบอัตรากำลัง", example:"แพทย์ 4 ตำแหน่ง", caution:"Vacancy เป็นข้อมูลประกอบ ไม่ถูกนับเป็น Actual Supply FTE", origin:"input" },
    { key:"retire5", title:"เกษียณภายใน 5 ปี", category:"3. Baseline / 4. Profession", aliases:["Retire <= 5Y","Retire <=5Y","เกษียณ <=5 ปี ทั้งหมด"], definition:"จำนวนบุคลากรตามทะเบียนที่อยู่ในช่วงเกษียณภายใน 5 ปี ใช้เป็น replacement risk", unit:"คน", source:"ทะเบียน HR", example:"พยาบาล 12 คน", caution:"ระบบ historical ไม่กระจายยอดนี้ย้อนหลังอัตโนมัติ; การเกษียณรายปีต้องกรอกตามข้อมูลจริง", origin:"input" },
    { key:"confidence", title:"Confidence", category:"3. Baseline", aliases:["Confidence"], definition:"ระดับคุณภาพ/การทวนสอบของชุดข้อมูล: A=verified, B=usable, C=provisional", unit:"A/B/C", source:"ทีมข้อมูล", example:"A เมื่อ reconcile แล้ว", caution:"เป็น metadata ไม่เปลี่ยนสูตรคำนวณ", origin:"input" },
    { key:"current-headcount", title:"Current headcount", category:"4. Profession", aliases:["Current headcount","Current"], definition:"จำนวนบุคลากรจริงของปีอ้างอิงล่าสุดในหน้า Profession; historical supply รายปีใช้ Actual Headcount ของแต่ละปี", unit:"คน", source:"HRIS/HROPS/จ.18", example:"แพทย์ 18 คน", origin:"input" },
    { key:"opd", title:"OPD Visits", category:"5. Workload", aliases:["OPD Visits"], definition:"จำนวน OPD visit จริงทั้งหมดในปีนั้น เป็น Workload Volume ไม่ใช่ Activity Standard", unit:"visits/ปี", source:"HIS/HDC", example:"120,000 visits/ปี", formula:"OPD visits × Activity Standard OPD × Complexity Index", origin:"input" },
    { key:"ipd", title:"IPD Admits", category:"5. Workload", aliases:["IPD Admits"], definition:"จำนวน IPD admission จริงในปีนั้น", unit:"admissions/ปี", source:"HIS/DRG", example:"6,500 admissions/ปี", formula:"IPD admissions × Activity Standard IPD × Complexity Index", origin:"input" },
    { key:"er", title:"ER Visits", category:"5. Workload", aliases:["ER Visits"], definition:"จำนวน ER visit จริงในปีนั้น", unit:"visits/ปี", source:"ER report/HIS", example:"18,000 visits/ปี", formula:"ER visits × Activity Standard ER × Complexity Index", origin:"input" },
    { key:"procedure", title:"OR / Procedure", category:"5. Workload", aliases:["OR/Procedure"], definition:"จำนวน OR/Procedure case จริงในปีนั้น โดยนิยาม case ต้องตรงกับ Activity Standard", unit:"cases/ปี", source:"OR log/HIS", example:"2,400 cases/ปี", origin:"input" },
    { key:"delivery", title:"Delivery", category:"5. Workload", aliases:["Delivery"], definition:"จำนวนการคลอดจริงที่หน่วยบริการดูแลในปีนั้น", unit:"deliveries/ปี", source:"ห้องคลอด/HIS", example:"850 deliveries/ปี", origin:"input" },
    { key:"chronic", title:"Chronic Visits", category:"5. Workload", aliases:["Chronic Visits"], definition:"จำนวน chronic/NCD service visit จริงในปีนั้น", unit:"visits/ปี", source:"HIS/HDC/NCD registry", example:"35,000 visits/ปี", origin:"input" },
    { key:"mental", title:"Mental Visits", category:"5. Workload", aliases:["Mental Visits"], definition:"จำนวน mental health/psychiatric service visit จริงในปีนั้น", unit:"visits/ปี", source:"HIS/mental health registry", example:"4,200 visits/ปี", origin:"input" },
    { key:"outreach", title:"Outreach / PP", category:"5. Workload", aliases:["Outreach/PP"], definition:"จำนวนกิจกรรม/contact Outreach/PP จริงในปีนั้น โดยหน่วยนับต้องตรงกับ Activity Standard", unit:"กิจกรรมหรือ contacts/ปี", source:"PP/HDC/ทะเบียนเยี่ยมบ้าน", example:"12,000 contacts/ปี", origin:"input" },
    { key:"target-pop", title:"Target Population / Cases", category:"5. Target Need", aliases:["Target Population / Cases"], definition:"จำนวนคน/cases ในกลุ่มเป้าหมายจริงของปีนั้น ก่อนคูณ Coverage %", unit:"คน/cases", source:"registry/HDC/program report", example:"1,500 คน", origin:"input" },
    { key:"actual-served", title:"Actual Served", category:"5. Target Need", aliases:["Actual Served"], definition:"จำนวนคน/cases ในกลุ่มเป้าหมายที่ได้รับบริการจริงในปีนั้น", unit:"คน/cases", source:"HIS/HDC/registry", example:"900 คน", origin:"input" },
    { key:"coverage", title:"Target Coverage %", category:"5. Target Need", aliases:["Target Coverage %"], definition:"ร้อยละของ Target Population ที่ควรได้รับบริการ", unit:"%", source:"Service Plan/CPG", example:"80%", formula:"Target Cases = Target Population × Coverage %", origin:"input" },
    { key:"frequency", title:"Service Freq / Year", category:"5. Target Need", aliases:["Service Freq / Year"], definition:"จำนวนครั้งบริการที่กลุ่มเป้าหมาย 1 รายควรได้รับต่อปี", unit:"ครั้ง/คน/ปี", source:"CPG/service model", example:"3 ครั้ง/ปี", origin:"input" },
    { key:"placement", title:"Placement", category:"5. Target Need", aliases:["Placement"], definition:"ระดับหน่วยบริการที่เหมาะสม ใช้ประกอบการออกแบบระบบบริการ ปัจจุบันไม่เปลี่ยนสูตรอัตโนมัติ", unit:"ข้อความ", source:"Service Plan/referral network", example:"รพท./รพช.ใหญ่", origin:"input" },
    { key:"recruit", title:"Recruit", category:"6. Supply", aliases:["Recruit"], definition:"จำนวนรับเข้าจริงในปีนั้น ใช้เป็น movement record; historical supply ไม่ back-calculate headcount จากช่องนี้", unit:"คน/ปี", source:"HRIS/คำสั่ง", example:"2 คน", origin:"input" },
    { key:"transfer-in", title:"Transfer In", category:"6. Supply", aliases:["Transfer In"], definition:"จำนวนย้ายเข้าจริงในปีนั้น เป็น movement record", unit:"คน/ปี", source:"HRIS/คำสั่งย้าย", example:"1 คน", origin:"input" },
    { key:"return-in", title:"Return In", category:"6. Supply", aliases:["Return In"], definition:"จำนวนกลับเข้าปฏิบัติงานจริงในปีนั้น เป็น movement record", unit:"คน/ปี", source:"HRIS", example:"1 คน", origin:"input" },
    { key:"retire", title:"Retire", category:"6. Supply", aliases:["Retire"], definition:"จำนวนเกษียณจริงในปีนั้น", unit:"คน/ปี", source:"HRIS", example:"3 คน", origin:"input" },
    { key:"resign", title:"Resign", category:"6. Supply", aliases:["Resign"], definition:"จำนวนลาออกจริงในปีนั้น", unit:"คน/ปี", source:"HRIS", example:"1 คน", origin:"input" },
    { key:"transfer-out", title:"Transfer Out", category:"6. Supply", aliases:["Transfer Out"], definition:"จำนวนย้ายออกจริงในปีนั้น", unit:"คน/ปี", source:"HRIS", example:"1 คน", origin:"input" },
    { key:"study-leave", title:"Study Leave", category:"6. Supply", aliases:["Study Leave"], definition:"จำนวนลาศึกษาที่ออกจากกำลังให้บริการจริงในปีนั้น", unit:"คน/ปี", source:"HRIS", example:"1 คน", origin:"input" },
    { key:"risk", title:"Risk", category:"7. Results", aliases:["Risk","High Risk Rows"], definition:"ระดับเตือน shortage จากเกณฑ์ใน simulator", unit:"green/yellow/red", source:"rule-based logic", example:"red เมื่อ ratio ต่ำหรือ gap สูง", caution:"เป็นสัญญาณประกอบ ไม่ใช่คำสั่งบริหารบุคลากร", origin:"output" },
    { key:"recommendation", title:"Recommendation", category:"7. Results", aliases:["Recommendation"], definition:"ข้อความช่วยตีความเชิง rule-based จาก gap/risk/coverage ใช้เป็นจุดเริ่มวางแผน", unit:"ข้อความ", source:"ระบบ", example:"ทำ replacement pipeline", caution:"ไม่ใช่ข้อสรุปแทนผู้บริหาร", origin:"output" },
  ];

  const sharedItems = Object.values(D.helpItems || {});
  const sharedByKey = new Map(sharedItems.map((item) => [item.key, item]));
  const HELP_ITEMS = BASE_HELP_ITEMS
    .map((item) => sharedByKey.get(item.key) || item)
    .concat(sharedItems.filter((item) => !BASE_HELP_ITEMS.some((base) => base.key === item.key)));

  const ORIGIN_LABELS = { input:"ข้อมูลจริง/กรอกหรือทวนสอบ", assumption:"ค่ามาตรฐาน/สมมติฐาน", output:"ระบบคำนวณ" };
  const byAlias = new Map();
  const byKey = new Map(HELP_ITEMS.map((item) => [item.key, item]));
  let activeButton = null;
  let helpVisible = true;
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").replace(/[?*:]/g, "").trim().toLowerCase();
  HELP_ITEMS.forEach((item) => (item.aliases || []).forEach((alias) => {
    const key = normalize(alias);
    if (!byAlias.has(key)) byAlias.set(key, item);
  }));
  const escapeHtml = (value) => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  function itemForText(text) {
    const clean = normalize(text);
    if (byAlias.has(clean)) return byAlias.get(clean);
    for (const [alias, item] of byAlias) {
      if (clean === alias || clean.startsWith(`${alias} `) || alias.startsWith(`${clean} `)) return item;
    }
    return null;
  }

  function itemForHost(host) {
    const explicitKey = host?.dataset?.helpKey;
    if (explicitKey && byKey.has(explicitKey)) return byKey.get(explicitKey);
    return itemForText(host?.childNodes?.[0]?.textContent || host?.textContent || "");
  }

  function createHelpButton(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hr-help-btn";
    button.textContent = "?";
    button.setAttribute("aria-label", `คำอธิบาย ${item.title}`);
    button.dataset.helpKey = item.key;
    button.setAttribute("aria-expanded", "false");
    return button;
  }

  function enhanceTextHost(host) {
    if (!host || host.dataset.helpEnhanced === "1" || host.querySelector(":scope > .hr-help-btn")) return;
    const item = itemForHost(host);
    if (!item) return;
    host.dataset.helpEnhanced = "1";
    host.appendChild(createHelpButton(item));
  }

  function enhanceLabels() {
    document.querySelectorAll(".field > span,.metric > span,.subsection-head h4,.data-table th").forEach(enhanceTextHost);
  }

  function addProfessionHelp() {
    [["[data-prof-current]","current-headcount"],["[data-prof-awt]","awt"],["[data-prof-cas]","cas"],["[data-prof-ias]","ias"],["[data-prof-vacant]","vacancy"],["[data-prof-retire]","retire5"]]
      .forEach(([selector,key]) => document.querySelectorAll(selector).forEach((input) => {
        const host = input.closest(".field")?.querySelector("span");
        const item = byKey.get(key);
        if (host && item && !host.querySelector(".hr-help-btn")) {
          host.dataset.helpEnhanced = "1";
          host.appendChild(createHelpButton(item));
        }
      }));
  }

  function tooltipHtml(item) {
    return `<strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.definition)}</div><dl><dt>หน่วย:</dt><dd>${escapeHtml(item.unit || "-")}</dd><dt>แหล่งข้อมูล:</dt><dd>${escapeHtml(item.source || "-")}</dd><dt>ตัวอย่าง:</dt><dd>${escapeHtml(item.example || "-")}</dd>${item.formula ? `<dt>ใช้ในสูตร:</dt><dd>${escapeHtml(item.formula)}</dd>` : ""}</dl>${item.caution ? `<div class="hr-help-caution"><b>ข้อควรระวัง:</b> ${escapeHtml(item.caution)}</div>` : ""}`;
  }

  function positionTooltip(button, tip) {
    const rect = button.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(420, window.innerWidth - 24);
    tip.style.width = `${width}px`;
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));
    let top = rect.bottom + margin;
    if (top + tipRect.height > window.innerHeight - 12) top = Math.max(12, rect.top - tipRect.height - margin);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function showTooltip(button) {
    const item = byKey.get(button.dataset.helpKey);
    const tip = document.getElementById("hrHelpTooltip");
    if (!item || !tip) return;
    if (activeButton && activeButton !== button) activeButton.setAttribute("aria-expanded", "false");
    activeButton = button;
    button.setAttribute("aria-expanded", "true");
    tip.innerHTML = tooltipHtml(item);
    tip.classList.add("visible");
    positionTooltip(button, tip);
  }

  function hideTooltip() {
    const tip = document.getElementById("hrHelpTooltip");
    if (tip) tip.classList.remove("visible");
    if (activeButton) activeButton.setAttribute("aria-expanded", "false");
    activeButton = null;
  }

  function injectStartGuide() {
    if (document.getElementById("hrHelpStart")) return;
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    const guide = document.createElement("section");
    guide.className = "hr-help-start";
    guide.id = "hrHelpStart";
    guide.innerHTML = `<div class="hr-help-start__head"><div><h3>เริ่มใช้งาน: เตรียมข้อมูลจริง + มาตรฐาน WISN ให้แยกกัน</h3><p>วางเมาส์หรือแตะ <b>?</b> เพื่อดูนิยาม หน่วย แหล่งข้อมูล และสูตรของแต่ละช่อง</p></div><div class="hr-help-actions"><button class="btn secondary" type="button" id="hrOpenDictionary">คู่มือข้อมูล / Data Dictionary</button><button class="btn ghost" type="button" id="hrToggleHelp">ซ่อนปุ่ม ?</button></div></div><div class="hr-help-steps"><div class="hr-help-step"><strong>1. Scope</strong><span>จังหวัด → อำเภอ → หน่วยบริการ</span></div><div class="hr-help-step"><strong>2. Actual Workload</strong><span>จำนวนบริการจริงรายปี</span></div><div class="hr-help-step"><strong>3. WISN Standard</strong><span>AWT, CAS, IAS, นาทีต่อกิจกรรม</span></div><div class="hr-help-step"><strong>4. Target Need</strong><span>กลุ่มเป้าหมายจริง + coverage/frequency</span></div><div class="hr-help-step"><strong>5. Supply</strong><span>Actual Headcount รายปี × FTE Factor</span></div><div class="hr-help-step"><strong>6. Results</strong><span>Required FTE, Supply, GAP, Ratio</span></div></div><div class="hr-help-notice"><b>สำคัญ:</b> Historical observations ต้องมาจากข้อมูลจริง ส่วน AWT/CAS/IAS/Activity Standard/Coverage/Frequency/Complexity เป็นค่ามาตรฐานหรือสมมติฐานที่ต้องทวนสอบก่อนใช้ตัดสินใจ</div>`;
    topbar.insertAdjacentElement("afterend", guide);
  }

  function injectSectionNotes() {
    const notes = {
      baseline:"<b>Baseline เป็นจุดอ้างอิง:</b> ใช้เฉพาะข้อมูลระดับพื้นที่ที่มีหลักฐาน; ค่าที่ไม่มีไม่ถูกเฉลี่ยจากจังหวัดลงอำเภอ",
      profession:"<b>Activity Standard = นาทีต่อ 1 หน่วยกิจกรรม:</b> ไม่ใช่จำนวน visits/ปี; สูตรใช้ Workload Volume × Activity Standard × Complexity Index",
      need:"<b>Workload จริง ≠ Target Need:</b> actual workload มาจากบริการที่เกิดขึ้นจริง ส่วน target need ใช้ตรวจ under-service โดยไม่ forecast ย้อนหลัง",
      supply:"<b>Historical Supply:</b> Actual Supply FTE = Actual Headcount ของปีนั้น × FTE Factor; movement เป็นหลักฐานประกอบ ไม่ back-calculate headcount",
      results:"<b>อ่านผลให้แยก demand กับ supply:</b> Planning Required FTE เป็นฝั่งความต้องการ; Actual Supply FTE เป็นกำลังคนที่มีจริง; GAP = Required − Supply",
    };
    Object.entries(notes).forEach(([id, html]) => {
      const section = document.getElementById(id);
      const header = section?.querySelector(".panel-header");
      if (section && header && !section.querySelector(".hr-help-section-note")) {
        const note = document.createElement("div");
        note.className = "hr-help-section-note";
        note.innerHTML = html;
        header.insertAdjacentElement("afterend", note);
      }
    });
  }

  function injectTooltip() {
    if (document.getElementById("hrHelpTooltip")) return;
    const tip = document.createElement("div");
    tip.id = "hrHelpTooltip";
    tip.className = "hr-help-tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }

  function injectDictionary() {
    if (document.getElementById("hrHelpModal")) return;
    const modal = document.createElement("div");
    modal.className = "hr-help-modal";
    modal.id = "hrHelpModal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="hr-help-dialog" role="dialog" aria-modal="true" aria-labelledby="hrHelpTitle"><div class="hr-help-dialog__head"><div><h2 id="hrHelpTitle">Data Dictionary — HR Blueprint WISN</h2><p>นิยาม • หน่วย • แหล่งข้อมูล • สูตร • ข้อควรระวัง</p></div><button type="button" class="hr-help-close" id="hrHelpClose" aria-label="ปิด">×</button></div><div class="hr-help-search"><input id="hrHelpSearch" type="search" placeholder="ค้นหา เช่น Activity Standard, OPD, AWT, CAS, GAP..."></div><div class="hr-help-list" id="hrHelpList"></div></div>`;
    document.body.appendChild(modal);
    const floating = document.createElement("button");
    floating.type = "button";
    floating.className = "hr-help-floating";
    floating.id = "hrHelpFloating";
    floating.textContent = "? คู่มือข้อมูล";
    document.body.appendChild(floating);
  }

  function renderDictionary(query = "") {
    const list = document.getElementById("hrHelpList");
    if (!list) return;
    const normalized = normalize(query);
    const items = HELP_ITEMS.filter((item) => !normalized || normalize([item.title,item.category,item.definition,item.unit,item.source,item.example,item.formula,...(item.aliases || [])].join(" ")).includes(normalized));
    list.innerHTML = items.length ? items.map((item) => `<article class="hr-help-entry"><div><h3>${escapeHtml(item.title)}</h3><span class="hr-help-entry__tag">${escapeHtml(item.category)}</span><span class="hr-help-origin ${item.origin || "input"}">${escapeHtml(ORIGIN_LABELS[item.origin] || ORIGIN_LABELS.input)}</span></div><div><p>${escapeHtml(item.definition)}</p><p><b>หน่วย:</b> ${escapeHtml(item.unit || "-")}</p><p><b>แหล่งข้อมูล:</b> ${escapeHtml(item.source || "-")}</p><p><b>ตัวอย่าง:</b> ${escapeHtml(item.example || "-")}</p>${item.formula ? `<p><b>ใช้ในสูตร:</b> ${escapeHtml(item.formula)}</p>` : ""}${item.caution ? `<p><b>ข้อควรระวัง:</b> ${escapeHtml(item.caution)}</p>` : ""}</div></article>`).join("") : `<div class="hr-help-empty">ไม่พบคำที่ค้นหา</div>`;
  }

  function openDictionary() {
    const modal = document.getElementById("hrHelpModal");
    if (!modal) return;
    hideTooltip();
    renderDictionary(document.getElementById("hrHelpSearch")?.value || "");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => document.getElementById("hrHelpSearch")?.focus(), 0);
  }
  function closeDictionary() { const modal = document.getElementById("hrHelpModal"); if (modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); } }
  function toggleHelp() { helpVisible = !helpVisible; document.body.classList.toggle("hr-help-off", !helpVisible); const button = document.getElementById("hrToggleHelp"); if (button) button.textContent = helpVisible ? "ซ่อนปุ่ม ?" : "แสดงปุ่ม ?"; if (!helpVisible) hideTooltip(); }

  function bindHelpEvents() {
    document.addEventListener("mouseover", (event) => { const button = event.target.closest(".hr-help-btn"); if (button && helpVisible) showTooltip(button); });
    document.addEventListener("focusin", (event) => { const button = event.target.closest(".hr-help-btn"); if (button && helpVisible) showTooltip(button); });
    document.addEventListener("click", (event) => { const button = event.target.closest(".hr-help-btn"); if (button) { event.preventDefault(); event.stopPropagation(); activeButton === button ? hideTooltip() : helpVisible && showTooltip(button); return; } if (!event.target.closest("#hrHelpTooltip")) hideTooltip(); });
    document.getElementById("hrOpenDictionary")?.addEventListener("click", openDictionary);
    document.getElementById("hrHelpFloating")?.addEventListener("click", openDictionary);
    document.getElementById("hrHelpClose")?.addEventListener("click", closeDictionary);
    document.getElementById("hrToggleHelp")?.addEventListener("click", toggleHelp);
    document.getElementById("hrHelpSearch")?.addEventListener("input", (event) => renderDictionary(event.target.value));
    document.getElementById("hrHelpModal")?.addEventListener("click", (event) => { if (event.target.id === "hrHelpModal") closeDictionary(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDictionary(); hideTooltip(); } });
    window.addEventListener("resize", () => { if (activeButton) { const tip = document.getElementById("hrHelpTooltip"); if (tip?.classList.contains("visible")) positionTooltip(activeButton, tip); } });
    window.addEventListener("scroll", hideTooltip, true);
  }

  function observeDynamicContent() {
    const observer = new MutationObserver(() => { enhanceLabels(); addProfessionHelp(); });
    ["professionGrid","standardTable","needTable","targetNeedTable","supplyTable","resultTable"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList:true, subtree:true });
    });
  }

  function bootHelp() {
    injectStartGuide();
    injectSectionNotes();
    injectTooltip();
    injectDictionary();
    enhanceLabels();
    addProfessionHelp();
    renderDictionary();
    bindHelpEvents();
    observeDynamicContent();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", bootHelp) : bootHelp();
})();
