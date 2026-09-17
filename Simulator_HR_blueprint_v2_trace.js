// Final v2 interpretation layer: formula trace, legacy-standard warning and UI styles.
(() => {
  "use strict";

  const previousTrace = window.renderTrace;
  window.renderTrace = function renderTraceProfessionSpecificV2() {
    const observedResults = state.results || [];
    const verified = observedResults.filter((row) => row.dataFitness === "Verified").length;
    const provisional = observedResults.filter((row) => row.dataFitness === "Provisional").length;
    const blocked = observedResults.filter((row) => row.dataFitness === "Blocked").length;

    $("formulaText").textContent = [
      "HR Blueprint WISN v2 — profession-specific formula trace",
      "1) Profession Workload Volume = ปริมาณงานจริงที่วิชาชีพนั้นทำตาม operational definition ที่กำหนด",
      "2) หน่วย Workload ต้องตรงกับหน่วย Activity Standard แบบ 1:1",
      "3) Demand Minutes = Σ(Profession Workload Volume × Activity Standard minutes/unit × Complexity Index)",
      "4) Service FTE = Demand Minutes / AWT",
      "5) CAF = 1 / (1 - CAS support % / 100)",
      "6) IAF = IAS hours/year × 60 / AWT",
      "7) Required FTE = (Service FTE × CAF) + IAF",
      "8) Actual Supply FTE = Actual Annual Headcount × FTE Factor",
      "9) HR GAP = Required FTE - Actual Supply FTE — แสดงเพื่อการตัดสินใจเฉพาะ Data Fitness = Verified",
      "10) WISN Ratio = Actual Supply FTE / Required FTE — ใช้เชิงบริหารเฉพาะ Data Fitness = Verified",
      "11) Suggested Add = ceil(max(HR GAP, 0)) — ซ่อนเมื่อข้อมูลยัง Provisional/Blocked",
      "",
      "สำคัญ: Facility totals เช่น Total OPD/IPD/ER เป็น reference/reconciliation เท่านั้น ไม่ถูกนำไปคูณกับทุกวิชาชีพ",
      "ตัวอย่าง: Doctor OPD = physician OPD encounters; Nurse IPD = patient-days; Pharmacist OPD = prescriptions/dispensing episodes",
      "Missing actualServed = unknown (N/A) ไม่ใช่ศูนย์ จึงไม่สร้าง Coverage Gap จากข้อมูลที่ไม่มี",
    ].join("\n");

    const province = state.provinceRow?.province || "-";
    const profileSchema = window.NCO_HR_PROFILE_SCHEMA_V2 || "nco-hr-profile-v2";
    $("sourceText").textContent = [
      `Scenario: ${$("scenarioName")?.value || "-"}`,
      `Profile schema: ${profileSchema}`,
      `Historical years: ${years().join(", ")}`,
      `Scope: ${province} / ${$("amphurName")?.value || "-"} / ${$("unitName")?.value || "-"} / ${$("scopeMode")?.value || "-"}`,
      `Data Fitness rows: Verified=${verified}, Provisional=${provisional}, Blocked=${blocked}`,
      "Workload source policy: ต้องเป็น profession-specific observed workload พร้อม source; ระบบไม่ fallback ไปใช้ facility totals อัตโนมัติ",
      "Unit policy: workload numerator และ Activity Standard ต้องเป็นหน่วยคู่เดียวกัน เช่น patient-days กับ minutes/patient-day",
      "Overlap policy: กิจกรรมที่อาจเป็น subset ของ encounter อื่นต้อง exclusive/deduplicated ก่อนสรุป เพื่อป้องกัน double counting",
      "WISN standards: ค่า illustrative defaults เป็นเพียงค่าเริ่มต้น ไม่ใช่มาตรฐานพื้นที่ และทำให้ Data Fitness ยังไม่ Verified จนกว่าจะมี source/status ที่ทวนสอบแล้ว",
      "Target need: ช่อง actual served ที่ว่างคงเป็น unknown/N/A ไม่ถูกแทนด้วย 0",
      "Health KPI: ใช้เป็น outcome/service context ประกอบการตีความ capacity; association ไม่ได้พิสูจน์ว่า staffing เป็นสาเหตุของ KPI",
      "Historical rule: missing facts remain blank/null; no interpolation, growth, back-cast or province-to-district allocation.",
      "WISN reference: WHO Workload Indicators of Staffing Need; local workload definitions and activity standards must be validated before policy use.",
    ].join("\n");

    // Keep any downstream KPI wrapper functional if it was installed before this layer.
    if (typeof previousTrace === "function" && previousTrace.__ncoAppendOnly) previousTrace();
  };

  function installV2Clarity() {
    const standardTable = $("standardTable");
    if (standardTable) {
      const shell = standardTable.closest(".table-shell");
      const head = shell?.previousElementSibling;
      if (head?.querySelector("h4")) {
        head.querySelector("h4").textContent = "Illustrative Activity Standard Matrix — NOT VALIDATED";
        const p = head.querySelector("p");
        if (p) p.innerHTML = "ตารางนี้เป็น <strong>ค่าเริ่มต้นประกอบหน้าจอเท่านั้น</strong> และไม่ควรใช้สรุปขาด/เกินโดยตรง เพราะหน่วยที่ถูกต้องขึ้นกับ workload ของแต่ละวิชาชีพ เช่น พยาบาล IPD ใช้ patient-days ไม่ใช่ admissions ให้กรอก/ยืนยันค่าที่จับคู่หน่วยจริงในตาราง Profession-specific Workload ด้านล่าง";
      }
      const details = document.createElement("details");
      details.className = "legacy-standard-reference";
      details.innerHTML = "<summary><strong>ดูตารางค่าเริ่มต้นเดิม (reference only)</strong></summary>";
      shell.parentNode.insertBefore(details, shell);
      details.appendChild(shell);
    }

    if (!document.getElementById("hrBlueprintV2Style")) {
      const style = document.createElement("style");
      style.id = "hrBlueprintV2Style";
      style.textContent = `
        .validation-banner{margin:12px 0;padding:12px 14px;border:1px solid #d7b24a;border-radius:10px;background:#fff9e8;line-height:1.55}
        .legacy-workload-reference,.legacy-standard-reference{margin:12px 0;padding:8px 12px;border:1px dashed #9aa7a2;border-radius:10px;background:#f7faf9}
        .legacy-workload-reference summary,.legacy-standard-reference summary{cursor:pointer}
        .risk.blocked{background:#37474f;color:#fff}.risk.provisional{background:#f0ad4e;color:#2b2100}.risk.verified{background:#16856b;color:#fff}
        #professionWorkloadTable small{display:block;min-width:210px;line-height:1.35;color:#53635e}
        #professionWorkloadTable input,#professionWorkloadTable select,#healthKpiPanel input,#healthKpiPanel select{min-width:120px}
        #dataFitnessSummary span{margin-left:8px}
      `;
      document.head.appendChild(style);
    }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(() => {
    installV2Clarity();
    window.renderTrace?.();
  }, 0));
})();
